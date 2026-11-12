/**
 * 用户战绩统计
 *
 * 唯一的数据源是 match_rounds（已经录了比分的场次）。
 * 之所以不复用 match_scores：那张表没有轮次/场地信息，是历史遗留的独立计分器数据，
 * 两者并存会出现"两个真相"，所以统计只认 match_rounds。
 */
const { DataTypes, Op } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const matchRounds = require('../schema/matchRounds')(Sequelize, DataTypes);
const matches = require('../schema/matches')(Sequelize, DataTypes);
const clubs = require('../schema/clubs')(Sequelize, DataTypes);
const users = require('../schema/users')(Sequelize, DataTypes);
const MatchParticipantModel = require('./matchParticipants');

const PROFILE_ATTRS = ['openId', 'nickName', 'name', 'avatar'];

function str(v) {
    return v != null ? String(v).trim() : '';
}

function plain(row) {
    return row && row.get ? row.get({ plain: true }) : row;
}

/** 一场比赛里"我"在哪一边、赢没赢 */
function splitSides(row, openId) {
    const team1 = [str(row.team1P1), str(row.team1P2)].filter(Boolean);
    const team2 = [str(row.team2P1), str(row.team2P2)].filter(Boolean);
    const s1 = row.team1Score == null ? null : Number(row.team1Score);
    const s2 = row.team2Score == null ? null : Number(row.team2Score);

    let mySide = '';
    if (team1.indexOf(openId) !== -1) mySide = 'team1';
    else if (team2.indexOf(openId) !== -1) mySide = 'team2';
    if (!mySide || s1 == null || s2 == null || s1 === s2) return null;

    const mine = mySide === 'team1' ? s1 : s2;
    const theirs = mySide === 'team1' ? s2 : s1;
    return {
        mySide,
        mine,
        theirs,
        win: mine > theirs,
        score1: s1,
        score2: s2,
        team1,
        team2,
    };
}

class UserStatsModel {
    /** 我参与过、且已经录了比分的所有场次（新→旧按比赛时间排） */
    static async finishedRoundsOf(openId) {
        const id = str(openId);
        if (!id) return [];
        const or = [
            { team1P1: id },
            { team1P2: id },
            { team2P1: id },
            { team2P2: id },
        ];
        const rows = await matchRounds.findAll({
            where: {
                status: 1,
                team1Score: { [Op.ne]: null },
                team2Score: { [Op.ne]: null },
                [Op.or]: or,
            },
            order: [['matchId', 'DESC'], ['roundNo', 'DESC'], ['courtNo', 'ASC']],
        });
        return rows.map(plain);
    }

    /** 只算汇总，不查任何附属表，够快也够简单 */
    static computeSummary(rounds, openId) {
        let played = 0;
        let win = 0;
        let lose = 0;
        let pointsFor = 0;
        let pointsAgainst = 0;

        rounds.forEach((row) => {
            const sides = splitSides(row, openId);
            if (!sides) return;
            played += 1;
            pointsFor += sides.mine;
            pointsAgainst += sides.theirs;
            if (sides.win) win += 1;
            else lose += 1;
        });

        const diff = pointsFor - pointsAgainst;
        return {
            played,
            win,
            lose,
            pointsFor,
            pointsAgainst,
            diff,
            // 胜率保留一位小数，没打过返回 null（前端显示 "--"，不是 0%）
            winRate: played > 0 ? Math.round((win / played) * 1000) / 10 : null,
            streakText: lose === 0 && win > 0 ? `${win}连胜` : '',
        };
    }

    /**
     * 最近 N 场（含双方选手信息，供前端直接渲染卡片）
     * @param {string} openId
     * @param {number} limit
     */
    static async recent(openId, limit = 5) {
        const id = str(openId);
        const all = await this.finishedRoundsOf(id);
        if (all.length === 0) return [];

        // 只取最近这些场次需要的比赛信息，避免全表扫
        const picked = all.slice(0, Math.max(1, Math.min(20, Number(limit) || 5)));
        const matchIds = [...new Set(picked.map((r) => Number(r.matchId)).filter(Boolean))];

        const matchRows = await matches.findAll({
            where: { id: { [Op.in]: matchIds } },
            attributes: ['id', 'name', 'clubId', 'startTime', 'createdAt', 'type'],
        });
        const matchMap = new Map();
        matchRows.forEach((row) => {
            const p = plain(row);
            matchMap.set(Number(p.id), p);
        });

        const clubIds = [...new Set(
            Array.from(matchMap.values()).map((m) => Number(m.clubId)).filter(Boolean)
        )];
        const clubMap = new Map();
        if (clubIds.length > 0) {
            const clubRows = await clubs.findAll({
                where: { id: { [Op.in]: clubIds } },
                attributes: ['id', 'name'],
            });
            clubRows.forEach((row) => {
                const p = plain(row);
                clubMap.set(Number(p.id), str(p.name));
            });
        }

        const openIds = [...new Set(
            picked.reduce((acc, r) => {
                acc.push(str(r.team1P1), str(r.team1P2), str(r.team2P1), str(r.team2P2));
                return acc;
            }, []).filter(Boolean)
        )];
        const profileMap = new Map();
        if (openIds.length > 0) {
            const userRows = await users.findAll({
                where: { openId: { [Op.in]: openIds } },
                attributes: PROFILE_ATTRS,
            });
            userRows.forEach((row) => {
                const p = plain(row);
                if (p.openId != null) profileMap.set(str(p.openId), p);
            });
        }

        // 用户表没有记录时，回落到报名时留下的昵称头像
        const snapshotMap = new Map();
        if (matchIds.length > 0) {
            const partRows = await MatchParticipantModel.listByMatchIds(matchIds);
            partRows.forEach((row) => {
                const p = plain(row);
                const key = str(p.userId);
                if (key && !snapshotMap.has(key)) {
                    snapshotMap.set(key, { name: str(p.userName), avatar: str(p.userAvatar) });
                }
            });
        }

        const playerOf = (oid) => {
            const profile = profileMap.get(oid) || {};
            const snapshot = snapshotMap.get(oid) || {};
            return {
                openId: oid,
                name: str(profile.nickName) || str(profile.name) || snapshot.name || '球友',
                avatar: str(profile.avatar) || snapshot.avatar || '',
            };
        };

        const list = [];
        for (const row of picked) {
            const sides = splitSides(row, id);
            if (!sides) continue;
            const match = matchMap.get(Number(row.matchId)) || {};
            list.push({
                roundId: Number(row.id),
                matchId: Number(row.matchId),
                matchName: str(match.name) || '羽毛球活动',
                clubName: clubMap.get(Number(match.clubId)) || str(match.name) || '—',
                startTime: match.startTime || match.createdAt || null,
                roundNo: Number(row.roundNo),
                courtNo: Number(row.courtNo),
                roundLabel: `第${row.roundNo}轮 · ${row.courtNo}号场`,
                result: sides.win ? 'win' : 'lose',
                mySide: sides.mySide,
                score1: sides.score1,
                score2: sides.score2,
                scoreText: `${sides.mine}:${sides.theirs}`,
                team1: sides.team1.map(playerOf),
                team2: sides.team2.map(playerOf),
            });
        }

        // 比赛时间新的在前；同一场里轮次大的在前
        list.sort((a, b) => {
            const ta = a.startTime ? new Date(a.startTime).getTime() : 0;
            const tb = b.startTime ? new Date(b.startTime).getTime() : 0;
            if (tb !== ta) return tb - ta;
            if (b.matchId !== a.matchId) return b.matchId - a.matchId;
            return b.roundNo - a.roundNo;
        });

        return list;
    }

    /** 平台总量：给首页那几个数字用，全部来自真实表 */
    static async overview() {
        const [userCount, roundCount, matchCount, clubCount] = await Promise.all([
            users.count(),
            matchRounds.count({ where: { status: 1 } }),
            matches.count(),
            clubs.count(),
        ]);
        return {
            users: userCount,
            finishedRounds: roundCount,
            matches: matchCount,
            clubs: clubCount,
        };
    }
}

module.exports = UserStatsModel;
