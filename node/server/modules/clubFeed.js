const { QueryTypes } = require('sequelize');
const db = require('../config/db');
const UserModel = require('./users');

/**
 * 俱乐部动态（P0 自动流）
 *
 * 设计取舍：不建 feed 表，直接实时聚合 matches / club_members。
 * 理由：
 *   1. 单俱乐部量级很小（几十到几千条），三路查询各带 LIMIT 足够；
 *   2. 不建表就永远不会出现"动态和事实不一致"，也不用写回填脚本；
 *   3. 比赛被回收删除后，相关动态自动消失，不需要级联清理。
 *
 * 三路来源：
 *   match_create  发起比赛   matches.createdAt
 *   match_finish  比赛结束   matches.status = 3，时间 COALESCE(end_time, updatedAt)
 *   member_join   新成员加入  club_members.joined_at（老数据回落 createdAt）
 *
 * 分页用 keyset 而非 offset：条件写成 (time < t OR (time = t AND id < i))。
 * 一开始用 `time < cursor+1ms` 的写法，结果同一秒内批量加入的成员（测试数据 8 人同秒）
 * 会整批漏掉 —— MySQL DATETIME 只精确到秒，+1ms 会被截断成"同一秒"从而被排除。
 */

/** 每页条数上限，防止前端传 9999 把库拖死 */
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

/** 已取消的比赛不作为"发起"动态展示，避免动态流被垃圾数据占据 */
const MATCH_STATUS_CANCELLED = 5;

/** 没有游标时用一个远期时间 + 超大 id，SQL 条件自然全部命中 */
const FAR_FUTURE = new Date('2999-12-31T00:00:00Z');
const MAX_ID = 2147483647;

function toInt(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/** 游标：<毫秒时间戳>_<type>_<refId> */
function parseCursor(raw) {
    const text = raw != null ? String(raw).trim() : '';
    if (!text) return null;
    const parts = text.split('_');
    const time = Number(parts[0]);
    const refId = Number(parts[2]);
    if (!Number.isFinite(time) || time <= 0) return null;
    return {
        time,
        type: parts[1] || '',
        refId: Number.isFinite(refId) ? refId : 0,
    };
}

function buildCursor(item) {
    return `${item.time}_${item.type}_${item.refId}`;
}

/** 把数据库时间（Date / 字符串 / 秒级时间戳）统一成毫秒数 */
function toTime(value) {
    if (value == null || value === '') return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/** 时间倒序；同一秒内按 id 倒序，和 SQL 的 ORDER BY 完全一致，跨页不会重复 */
function compareDesc(a, b) {
    if (b.time !== a.time) return b.time - a.time;
    if (b.refId !== a.refId) return b.refId - a.refId;
    const ka = String(a.type);
    const kb = String(b.type);
    if (ka === kb) return 0;
    return ka < kb ? 1 : -1;
}

class ClubFeedModel {
    /**
     * keyset 条件：比游标更早的记录
     * @param {string} timeExpr 时间列表达式
     */
    static keysetWhere(timeExpr) {
        return `${timeExpr} < :before OR (${timeExpr} = :before AND id < :beforeId)`;
    }

    static cursorParams(cursor) {
        return {
            before: cursor ? new Date(cursor.time) : FAR_FUTURE,
            beforeId: cursor ? cursor.refId : MAX_ID,
        };
    }

    /** 发起比赛 */
    static async selectMatchCreates(clubId, limit, cursor) {
        return await db.sequelize.query(
            `SELECT id, name, status, player_count, address, start_time, end_time,
                    createdAt, updatedAt, created_by
             FROM matches
             WHERE club_id = :clubId
               AND status <> :cancelled
               AND (${this.keysetWhere('createdAt')})
             ORDER BY createdAt DESC, id DESC
             LIMIT ${Number(limit)}`,
            {
                replacements: Object.assign(
                    { clubId, cancelled: MATCH_STATUS_CANCELLED },
                    this.cursorParams(cursor)
                ),
                type: QueryTypes.SELECT,
            }
        );
    }

    /** 比赛结束（用 end_time 为基准，没填则退回 updatedAt） */
    static async selectMatchFinishes(clubId, limit, cursor) {
        const timeExpr = 'COALESCE(end_time, updatedAt)';
        return await db.sequelize.query(
            `SELECT id, name, status, player_count, address, start_time, end_time,
                    createdAt, updatedAt, created_by
             FROM matches
             WHERE club_id = :clubId
               AND status = 3
               AND (${this.keysetWhere(timeExpr)})
             ORDER BY ${timeExpr} DESC, id DESC
             LIMIT ${Number(limit)}`,
            {
                replacements: Object.assign({ clubId }, this.cursorParams(cursor)),
                type: QueryTypes.SELECT,
            }
        );
    }

    /**
     * 新成员加入
     * limit 放宽到 3 倍：同一秒加入的一批人要一次取全，否则合并成一条时人数会少。
     */
    static async selectMemberJoins(clubId, limit, cursor) {
        const timeExpr = 'COALESCE(joined_at, createdAt, updatedAt)';
        return await db.sequelize.query(
            `SELECT id, user_id, user_name, user_avatar, joined_at, createdAt
             FROM club_members
             WHERE club_id = :clubId
               AND (status = 1 OR status IS NULL)
               AND (${this.keysetWhere(timeExpr)})
             ORDER BY ${timeExpr} DESC, id DESC
             LIMIT ${Number(limit)}`,
            {
                replacements: Object.assign({ clubId }, this.cursorParams(cursor)),
                type: QueryTypes.SELECT,
            }
        );
    }

    static async countMatchCreates(clubId) {
        const rows = await db.sequelize.query(
            `SELECT COUNT(*) AS total FROM matches
             WHERE club_id = :clubId AND status <> :cancelled`,
            {
                replacements: { clubId, cancelled: MATCH_STATUS_CANCELLED },
                type: QueryTypes.SELECT,
            }
        );
        return toInt(rows[0] && rows[0].total, 0);
    }

    static async countMatchFinishes(clubId) {
        const rows = await db.sequelize.query(
            `SELECT COUNT(*) AS total FROM matches WHERE club_id = :clubId AND status = 3`,
            { replacements: { clubId }, type: QueryTypes.SELECT }
        );
        return toInt(rows[0] && rows[0].total, 0);
    }

    static async countMemberJoins(clubId) {
        // 按秒聚合：同一秒加入的一批人只算一条动态，保证 tab 上的数字和列表条数对得上
        const rows = await db.sequelize.query(
            `SELECT COUNT(DISTINCT UNIX_TIMESTAMP(COALESCE(joined_at, createdAt, updatedAt, '1970-01-01'))) AS total
             FROM club_members
             WHERE club_id = :clubId AND (status = 1 OR status IS NULL)`,
            { replacements: { clubId }, type: QueryTypes.SELECT }
        );
        return toInt(rows[0] && rows[0].total, 0);
    }

    /**
     * 批量算这些比赛的战果：已打场次 + 冠军
     * 只对当前页出现的比赛算，一页最多几十场，两次查询搞定，不会随历史增长变慢。
     * @returns {Promise<Map<number, { finishedMatches: number, champion: object|null }>>}
     */
    static async statsOfMatches(matchIds) {
        const ids = [...new Set((matchIds || []).map((id) => Number(id)).filter((id) => id > 0))];
        const result = new Map();
        if (ids.length === 0) return result;

        ids.forEach((id) => result.set(id, { finishedMatches: 0, champion: null }));

        const rows = await db.sequelize.query(
            `SELECT match_id, team1_p1, team1_p2, team2_p1, team2_p2, team1_score, team2_score
             FROM match_rounds
             WHERE match_id IN (:ids) AND status = 1`,
            { replacements: { ids }, type: QueryTypes.SELECT }
        );
        if (rows.length === 0) return result;

        const perMatch = new Map();
        rows.forEach((row) => {
            const matchId = Number(row.match_id);
            const entry = result.get(matchId);
            if (!entry) return;
            const s1 = Number(row.team1_score);
            const s2 = Number(row.team2_score);
            const scored = Number.isFinite(s1) && Number.isFinite(s2) && s1 !== s2;
            if (!scored) return;
            entry.finishedMatches += 1;
            if (!perMatch.has(matchId)) perMatch.set(matchId, new Map());
            const stat = perMatch.get(matchId);
            const apply = (ids4, mine, theirs, won) => {
                ids4.forEach((openId) => {
                    if (openId == null) return;
                    const key = String(openId).trim();
                    if (!key) return;
                    if (!stat.has(key)) stat.set(key, { openId: key, win: 0, diff: 0, pointsFor: 0 });
                    const item = stat.get(key);
                    item.pointsFor += mine;
                    item.diff += mine - theirs;
                    if (won) item.win += 1;
                });
            };
            apply([row.team1_p1, row.team1_p2], s1, s2, s1 > s2);
            apply([row.team2_p1, row.team2_p2], s2, s1, s2 > s1);
        });

        // 冠军口径与比赛详情页排名一致：胜场 → 净胜分 → 得分 → openId
        const championIds = [];
        perMatch.forEach((stat, matchId) => {
            const rank = Array.from(stat.values()).sort((a, b) => {
                if (b.win !== a.win) return b.win - a.win;
                if (b.diff !== a.diff) return b.diff - a.diff;
                if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
                return String(a.openId).localeCompare(String(b.openId));
            });
            const entry = result.get(matchId);
            if (entry && rank.length > 0) entry.champion = rank[0];
            if (entry && entry.champion) championIds.push(entry.champion.openId);
        });

        if (championIds.length > 0) {
            const profileMap = await UserModel.mapProfileByOpenIds(championIds);
            result.forEach((entry) => {
                if (!entry.champion) return;
                const profile = profileMap.get(entry.champion.openId);
                entry.champion.name =
                    profile && profile.nickName ? String(profile.nickName) : '球友';
                entry.champion.avatar = profile && profile.avatar ? String(profile.avatar) : '';
            });
        }

        return result;
    }

    /**
     * 拉取一页动态
     * @param {number} clubId
     * @param {{ cursor?: string, pageSize?: number }} options
     * @returns {Promise<{ list: object[], nextCursor: string, hasMore: boolean, total: number }>}
     */
    static async page(clubId, options = {}) {
        const id = Number(clubId);
        if (!id) throw new Error('缺少俱乐部编号');

        const pageSize = Math.min(
            MAX_PAGE_SIZE,
            Math.max(1, toInt(options.pageSize, DEFAULT_PAGE_SIZE))
        );
        const cursor = parseCursor(options.cursor);
        const need = pageSize + 1;

        const [createRows, finishRows, joinRows, createTotal, finishTotal, joinTotal] =
            await Promise.all([
                this.selectMatchCreates(id, need, cursor),
                this.selectMatchFinishes(id, need, cursor),
                this.selectMemberJoins(id, need * 3, cursor),
                this.countMatchCreates(id),
                this.countMatchFinishes(id),
                this.countMemberJoins(id),
            ]);

        const items = [];

        // 同一秒加入的一批人合并成一条动态，避免"XX 加入了俱乐部"刷屏
        const joinBatch = [];
        joinRows.forEach((row) => {
            const time = toTime(row.joined_at || row.createdAt);
            const last = joinBatch[joinBatch.length - 1];
            if (last && last.time === time) {
                last.rows.push(row);
                if (Number(row.id) < last.refId) last.refId = Number(row.id);
            } else {
                joinBatch.push({ time, refId: Number(row.id), rows: [row] });
            }
        });
        // 取满了说明最后一批可能被 LIMIT 截断（同一时间的记录连续排列），
        // 这时整批留给下一页，否则会显示"5 人加入"但实际进来 8 人。
        if (joinRows.length >= need * 3 && joinBatch.length >= 2) {
            const lastBatch = joinBatch[joinBatch.length - 1];
            const prevBatch = joinBatch[joinBatch.length - 2];
            if (lastBatch.time === prevBatch.time) joinBatch.pop();
        }

        createRows.forEach((row) => {
            items.push({
                type: 'match_create',
                refId: Number(row.id),
                time: toTime(row.createdAt),
                actorId: row.created_by != null ? String(row.created_by) : '',
                match: {
                    id: Number(row.id),
                    name: row.name != null ? String(row.name) : '',
                    playerCount: toInt(row.player_count, 0),
                    address: row.address != null ? String(row.address) : '',
                    startTime: row.start_time || null,
                    status: toInt(row.status, 0),
                },
            });
        });

        finishRows.forEach((row) => {
            items.push({
                type: 'match_finish',
                refId: Number(row.id),
                time: toTime(row.end_time || row.updatedAt),
                actorId: row.created_by != null ? String(row.created_by) : '',
                match: {
                    id: Number(row.id),
                    name: row.name != null ? String(row.name) : '',
                    playerCount: toInt(row.player_count, 0),
                    address: row.address != null ? String(row.address) : '',
                    startTime: row.start_time || null,
                    status: toInt(row.status, 0),
                },
            });
        });

        joinBatch.forEach((batch) => {
            items.push({
                type: batch.rows.length > 1 ? 'member_batch' : 'member_join',
                refId: batch.refId,
                time: batch.time,
                actorId: '',
                members: batch.rows.map((row) => ({
                    openId: row.user_id != null ? String(row.user_id) : '',
                    name: row.user_name != null ? String(row.user_name) : '',
                    avatar: row.user_avatar != null ? String(row.user_avatar) : '',
                })),
            });
        });

        const sorted = items.sort(compareDesc);
        const pageItems = sorted.slice(0, pageSize);
        const hasMore = sorted.length > pageSize;

        // 补齐头像/昵称：比赛事件只有 openId，成员事件的冗余字段可能为空
        const openIds = [];
        pageItems.forEach((item) => {
            if (item.actorId) openIds.push(item.actorId);
            if (item.members) item.members.forEach((m) => m.openId && openIds.push(m.openId));
        });
        const profileMap =
            openIds.length > 0 ? await UserModel.mapProfileByOpenIds(openIds) : new Map();

        // 只有当前页出现的已结束比赛才算战果
        const finishIds = pageItems
            .filter((i) => i.type === 'match_finish')
            .map((i) => i.match.id);
        const statsMap = await this.statsOfMatches(finishIds);

        const list = pageItems.map((item) => {
            if (item.members) {
                const members = item.members.map((m) => {
                    const profile = m.openId ? profileMap.get(m.openId) : null;
                    return {
                        openId: m.openId,
                        name: (profile && profile.nickName) || m.name || '新成员',
                        avatar: (profile && profile.avatar) || m.avatar || '',
                    };
                });
                return {
                    id: `${item.type}_${item.refId}`,
                    type: item.type,
                    at: new Date(item.time).toISOString(),
                    actor: null,
                    members,
                    member: members[0] || null,
                    match: null,
                };
            }

            const actorProfile = item.actorId ? profileMap.get(item.actorId) : null;
            const actor = {
                openId: item.actorId,
                name: actorProfile && actorProfile.nickName ? String(actorProfile.nickName) : '',
                avatar: actorProfile && actorProfile.avatar ? String(actorProfile.avatar) : '',
            };
            const stats = statsMap.get(item.match.id) || { finishedMatches: 0, champion: null };
            return {
                id: `${item.type}_${item.refId}`,
                type: item.type,
                at: new Date(item.time).toISOString(),
                actor,
                members: null,
                member: null,
                match: Object.assign({}, item.match, {
                    finishedMatches: stats.finishedMatches,
                    champion: stats.champion
                        ? {
                              openId: stats.champion.openId,
                              name: stats.champion.name || '球友',
                              avatar: stats.champion.avatar || '',
                          }
                        : null,
                }),
            };
        });

        const last = pageItems[pageItems.length - 1];
        return {
            list,
            nextCursor: hasMore && last ? buildCursor(last) : '',
            hasMore,
            total: createTotal + finishTotal + joinTotal,
        };
    }
}

module.exports = ClubFeedModel;
