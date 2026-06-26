const { DataTypes, Op } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const matches = require('../schema/matches')(Sequelize, DataTypes);
const MatchParticipantModel = require('./matchParticipants');
const UserModel = require('./users');
const ClubModel = require('./clubs');
const ClubMemberModel = require('./clubMembers');

matches.sync({ force: false });

function pickCreatorOpenId(data) {
    if (!data) return '';
    if (data.openId != null && data.openId !== '') return String(data.openId).trim();
    if (data.openid != null && data.openid !== '') return String(data.openid).trim();
    if (data.userId != null && data.userId !== '') return String(data.userId).trim();
    if (data.createdBy != null && data.createdBy !== '') return String(data.createdBy).trim();
    return '';
}

class MatchModel {
    static async create(data) {
        const t = await Sequelize.transaction();
        try {
            const match = await matches.create({
                clubId: data.clubId,
                activityId: data.activityId,
                type: data.type,
                organizeMode: data.organizeMode,
                name: data.name,
                competitionFormat: data.competitionFormat,
                targetScore: data.targetScore,
                bestOf: data.bestOf,
                status: data.status,
                startTime: data.startTime,
                endTime: data.endTime,
                address: data.address,
                views: data.views,
                createdBy: data.createdBy,
                playerCount: data.playerCount,
                sessionCount: data.sessionCount,
                remark: data.remark
            }, { transaction: t });

            const openId = pickCreatorOpenId(data);
            if (openId) {
                const existed = await MatchParticipantModel.detailByMatchUser(match.id, openId, { transaction: t });
                if (!existed) {
                    let userName = null;
                    let userAvatar = null;
                    const u = await UserModel.detailByOpenId(openId);
                    if (u) {
                        const plain = u.get({ plain: true });
                        userName = plain.nickName || plain.name || null;
                        userAvatar = plain.avatar || null;
                    }
                    await MatchParticipantModel.create({
                        matchId: match.id,
                        userId: openId,
                        userName,
                        userAvatar,
                        number: 1,
                        teamId: null,
                        status: 1
                    }, { transaction: t });
                }
            }

            await t.commit();
            return match;
        } catch (e) {
            await t.rollback();
            throw e;
        }
    }

    static async update(id, data) {
        return await matches.update({
            clubId: data.clubId,
            activityId: data.activityId,
            type: data.type,
            organizeMode: data.organizeMode,
            name: data.name,
            competitionFormat: data.competitionFormat,
            targetScore: data.targetScore,
            bestOf: data.bestOf,
            status: data.status,
            startTime: data.startTime,
            endTime: data.endTime,
            address: data.address,
            views: data.views,
            createdBy: data.createdBy,
            playerCount: data.playerCount,
            sessionCount: data.sessionCount,
            remark: data.remark
        }, {
            where: {
                id
            }
        })
    }

    static async detail(id) {
        return await matches.findOne({
            where: {
                id
            }
        })
    }

    /**
     * 比赛详情：基本信息 + 组织者(users) + 报名人员(match_participants + user)
     * @returns {Promise<{ match: object, organizer: object|null, participants: object[] }|null>}
     */
    static async detailWithExtras(id) {
        const matchRow = await matches.findOne({ where: { id } });
        if (!matchRow) return null;
        const match = matchRow.get({ plain: true });

        const createdBy = match.createdBy != null ? String(match.createdBy).trim() : '';
        let organizer = null;
        if (createdBy) {
            const map = await UserModel.mapProfileByOpenIds([createdBy]);
            organizer = map.get(createdBy) || null;
        }

        const partRows = await MatchParticipantModel.listByMatchIds([id]);
        const plains = partRows.map((r) => r.get({ plain: true }));
        const openIds = plains.map((p) => p.userId).filter(Boolean);
        const userMap = await UserModel.mapProfileByOpenIds(openIds);
        const participants = plains.map((p) => {
            const uid = p.userId != null ? String(p.userId).trim() : '';
            const user = uid ? userMap.get(uid) || null : null;
            return { ...p, user };
        });

        let club = null;
        if (match.clubId != null && match.clubId !== '') {
            const cid = Number(match.clubId);
            if (Number.isFinite(cid)) {
                const clubMap = await ClubModel.mapPlainByIds([cid]);
                club = clubMap.get(cid) || null;
            }
        }

        return { match, organizer, participants, club };
    }

    static async list(data = {}) {
        const openIdRaw =
            data.openId != null && data.openId !== ''
                ? String(data.openId).trim()
                : data.openid != null && data.openid !== ''
                    ? String(data.openid).trim()
                    : '';

        const baseWhere = {};
        if (data.clubId != null && data.clubId !== '') baseWhere.clubId = data.clubId;
        if (data.activityId != null && data.activityId !== '') baseWhere.activityId = data.activityId;
        if (data.type != null && data.type !== '') baseWhere.type = data.type;
        if (data.status !== undefined && data.status !== null && data.status !== '') {
            baseWhere.status = data.status;
        }

        const order = [['createdAt', 'DESC']];

        if (!openIdRaw) {
            const rows = await matches.findAll({
                where: baseWhere,
                order,
            });
            const clubIds = [...new Set(
                rows.map((r) => r.get({ plain: true }).clubId).filter((cid) => cid != null && cid !== '')
            )];
            const clubMap = await ClubModel.mapPlainByIds(clubIds);
            return rows.map((r) => {
                const match = r.get({ plain: true });
                const cid = match.clubId != null ? Number(match.clubId) : NaN;
                const club = Number.isFinite(cid) ? (clubMap.get(cid) || null) : null;
                return { ...match, club };
            });
        }

        const participatedIds = await MatchParticipantModel.matchIdsByUserOpenId(openIdRaw);
        const orConds = [{ createdBy: openIdRaw }];
        if (participatedIds.length > 0) {
            orConds.push({ id: { [Op.in]: participatedIds } });
        }
        const where = { ...baseWhere, [Op.or]: orConds };

        const page = Math.max(1, parseInt(data.page, 10) || 1);
        const pageSizeRaw = parseInt(data.pageSize ?? data.limit, 10);
        const pageSize = Math.min(
            100,
            Math.max(1, Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 20)
        );
        const offset = (page - 1) * pageSize;

        const total = await matches.count({ where });
        const matchRows = await matches.findAll({
            where,
            order,
            limit: pageSize,
            offset,
        });

        const matchIds = matchRows.map((m) => m.id);
        const allParts = await MatchParticipantModel.listByMatchIds(matchIds);
        const partsByMatch = new Map();
        for (const row of allParts) {
            const mid = row.matchId;
            if (!partsByMatch.has(mid)) partsByMatch.set(mid, []);
            partsByMatch.get(mid).push(row.get({ plain: true }));
        }

        const organizerIds = matchRows.map((m) => m.createdBy).filter((x) => x != null && String(x).trim() !== '');
        const participantIds = allParts.map((p) => p.userId).filter(Boolean);
        const allProfileIds = [...new Set([...organizerIds, ...participantIds].map((x) => String(x).trim()))];
        const userMap = await UserModel.mapProfileByOpenIds(allProfileIds);

        const clubIds = [...new Set(
            matchRows.map((m) => m.get({ plain: true }).clubId).filter((cid) => cid != null && cid !== '')
        )];
        const clubMap = await ClubModel.mapPlainByIds(clubIds);

        const list = matchRows.map((m) => {
            const match = m.get({ plain: true });
            const oby = match.createdBy != null ? String(match.createdBy).trim() : '';
            const organizer = oby ? userMap.get(oby) || null : null;
            const rawParts = partsByMatch.get(m.id) || [];
            const participants = rawParts.map((p) => {
                const uid = p.userId != null ? String(p.userId).trim() : '';
                const user = uid ? userMap.get(uid) || null : null;
                return { ...p, user };
            });
            const cid = match.clubId != null ? Number(match.clubId) : NaN;
            const club = Number.isFinite(cid) ? (clubMap.get(cid) || null) : null;
            return { match, organizer, participants, club };
        });

        return { total, list, page, pageSize };
    }

    /** 浏览量 +1，返回更新后的比赛行 */
    static async incrementViews(id) {
        const exists = await matches.findOne({ where: { id }, attributes: ['id'] });
        if (!exists) return null;
        await matches.increment('views', { by: 1, where: { id } });
        return await matches.findOne({ where: { id } });
    }

    /** 仅更新状态，返回更新后的比赛行；无该 id 返回 null */
    static async updateStatus(id, status) {
        const exists = await matches.findOne({ where: { id }, attributes: ['id'] });
        if (!exists) return null;
        const st = Number(status);
        if (!Number.isFinite(st)) {
            throw new Error('状态无效');
        }
        await matches.update({ status: st }, { where: { id } });
        return await matches.findOne({ where: { id } });
    }

    static async delete(id) {
        return await matches.destroy({
            where: {
                id
            }
        })
    }

    /**
     * 邀请俱乐部成员加入比赛（按 openId 查用户资料后写入 match_participants）
     * @returns {Promise<{ created: object[], skipped: { openId: string, reason: string }[] }>}
     */
    static async inviteClubMembers(clubId, matchId, openIds) {
        const matchRow = await matches.findOne({ where: { id: matchId } });
        if (!matchRow) {
            throw new Error('比赛不存在');
        }
        const match = matchRow.get({ plain: true });
        if (Number(match.clubId) !== Number(clubId)) {
            throw new Error('比赛不属于该俱乐部');
        }

        const ids = [...new Set((openIds || []).map((id) => String(id).trim()).filter(Boolean))];
        if (ids.length === 0) {
            throw new Error('openIds 不能为空');
        }

        const userMap = await UserModel.mapProfileByOpenIds(ids);
        const t = await Sequelize.transaction();
        try {
            const clubMemberMap = await ClubMemberModel.mapByClubAndOpenIds(clubId, ids, { transaction: t });
            const existingParts = await MatchParticipantModel.listByMatchIds([matchId], { transaction: t });
            let maxNumber = 0;
            for (const row of existingParts) {
                const n = Number(row.number);
                if (Number.isFinite(n) && n > maxNumber) maxNumber = n;
            }

            const created = [];
            const skipped = [];

            for (const openId of ids) {
                const existed = await MatchParticipantModel.detailByMatchUser(matchId, openId, { transaction: t });
                if (existed) {
                    skipped.push({ openId, reason: '已报名' });
                    continue;
                }

                const clubMember = clubMemberMap.get(openId);
                if (!clubMember) {
                    skipped.push({ openId, reason: '非俱乐部成员' });
                    continue;
                }

                const user = userMap.get(openId);
                if (!user) {
                    skipped.push({ openId, reason: '用户不存在' });
                    continue;
                }

                maxNumber += 1;
                const ret = await MatchParticipantModel.create({
                    matchId,
                    userId: openId,
                    userName: user.nickName || user.name || clubMember.userName || null,
                    userAvatar: user.avatar || clubMember.userAvatar || null,
                    number: maxNumber,
                    teamId: null,
                    status: 1,
                }, { transaction: t });
                created.push(ret.get({ plain: true }));
            }

            await t.commit();
            return { created, skipped };
        } catch (e) {
            await t.rollback();
            throw e;
        }
    }
}

module.exports = MatchModel;
