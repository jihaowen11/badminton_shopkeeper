const { DataTypes, Op } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const matchRounds = require('../schema/matchRounds')(Sequelize, DataTypes);
const { generateRotation } = require('../utils/rotation');
const { safeSync } = require('../utils/safeSync');

safeSync(matchRounds, 'matchRounds');

/** 把四列 openId 摊平成数组，方便统一处理 */
function quadOf(row) {
    const p = row.get ? row.get({ plain: true }) : row;
    return [p.team1P1, p.team1P2, p.team2P1, p.team2P2].map((x) =>
        x != null ? String(x).trim() : ''
    );
}

class MatchRoundModel {
    static async listByMatchId(matchId) {
        return await matchRounds.findAll({
            where: { matchId },
            order: [['roundNo', 'ASC'], ['courtNo', 'ASC']],
        });
    }

    static async detail(id) {
        return await matchRounds.findOne({ where: { id } });
    }

    static async deleteByMatchId(matchId, options = {}) {
        return await matchRounds.destroy({
            where: { matchId },
            transaction: options.transaction,
        });
    }

    /** 该比赛是否已经有打过的场次（有比分就不该随便重排） */
    static async countScored(matchId) {
        return await matchRounds.count({
            where: {
                matchId,
                status: 1,
            },
        });
    }

    static async countByMatchId(matchId) {
        return await matchRounds.count({ where: { matchId } });
    }

    /**
     * 生成并落库排期（覆盖旧排期）
     * @param {number} matchId
     * @param {string[]} players 参赛者 openId
     * @param {number} roundCount 轮数
     * @param {number} courts 场地片数，不传按 1 片
     * @returns {Promise<{ courts: number, rounds: number, stats: object, replaced: number }>}
     */
    static async generate(matchId, players, roundCount, courts) {
        const result = generateRotation(players, {
            rounds: roundCount,
            courts,
            // 用比赛 id 当种子的一部分，同一场比赛重排结果稳定可复现
            seed: Number(matchId) * 7919 + players.length,
        });

        const rows = [];
        result.schedule.forEach((round) => {
            round.courts.forEach((court) => {
                rows.push({
                    matchId,
                    roundNo: round.no,
                    courtNo: court.courtNo,
                    team1P1: court.team1[0],
                    team1P2: court.team1[1],
                    team2P1: court.team2[0],
                    team2P2: court.team2[1],
                    team1Score: null,
                    team2Score: null,
                    status: 0,
                });
            });
        });

        const t = await Sequelize.transaction();
        try {
            const replaced = await matchRounds.destroy({
                where: { matchId },
                transaction: t,
            });
            await matchRounds.bulkCreate(rows, { transaction: t });
            await t.commit();
            return {
                courts: result.courts,
                rounds: result.rounds,
                stats: result.stats,
                replaced,
                matches: rows.length,
            };
        } catch (e) {
            await t.rollback();
            throw e;
        }
    }

    /**
     * 记录比分，返回更新后的行；不存在返回 null
     */
    static async updateScore(id, team1Score, team2Score) {
        const row = await matchRounds.findOne({ where: { id } });
        if (!row) return null;
        await matchRounds.update(
            {
                team1Score,
                team2Score,
                status: 1,
            },
            { where: { id } }
        );
        return await matchRounds.findOne({ where: { id } });
    }

    /** 撤销比分，回到"待开始" */
    static async clearScore(id) {
        const row = await matchRounds.findOne({ where: { id } });
        if (!row) return null;
        await matchRounds.update(
            {
                team1Score: null,
                team2Score: null,
                status: 0,
            },
            { where: { id } }
        );
        return await matchRounds.findOne({ where: { id } });
    }

    /** 某场比赛里某个用户参与的所有场次 id（用于权限判断） */
    static async isPlayerInRound(id, openId) {
        const row = await matchRounds.findOne({ where: { id } });
        if (!row) return false;
        const quad = quadOf(row);
        return quad.indexOf(String(openId)) !== -1;
    }

    /**
     * 由已结束的场次计算排名
     * 排序：胜场 → 净胜分 → 得分 → 姓名
     * @param {object[]} roundRows match_rounds 行
     * @param {Map<string, object>} playerMap openId -> { openId, name, avatar }
     */
    static computeRankings(roundRows, playerMap) {
        const stat = new Map();
        playerMap.forEach((p, openId) => {
            stat.set(openId, {
                openId,
                name: p.name,
                avatar: p.avatar || '',
                played: 0,
                win: 0,
                lose: 0,
                pointsFor: 0,
                pointsAgainst: 0,
                diff: 0,
            });
        });

        const ensure = (openId) => {
            if (!stat.has(openId)) {
                stat.set(openId, {
                    openId,
                    name: '',
                    avatar: '',
                    played: 0,
                    win: 0,
                    lose: 0,
                    pointsFor: 0,
                    pointsAgainst: 0,
                    diff: 0,
                });
            }
            return stat.get(openId);
        };

        roundRows.forEach((row) => {
            const p = row.get ? row.get({ plain: true }) : row;
            if (Number(p.status) !== 1) return;
            if (p.team1Score == null || p.team2Score == null) return;
            const s1 = Number(p.team1Score);
            const s2 = Number(p.team2Score);
            if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 === s2) return;

            const team1 = [p.team1P1, p.team1P2].map((x) => String(x).trim());
            const team2 = [p.team2P1, p.team2P2].map((x) => String(x).trim());

            const apply = (ids, mine, theirs, won) => {
                ids.forEach((openId) => {
                    const item = ensure(openId);
                    item.played += 1;
                    item.pointsFor += mine;
                    item.pointsAgainst += theirs;
                    item.diff = item.pointsFor - item.pointsAgainst;
                    if (won) item.win += 1;
                    else item.lose += 1;
                });
            };
            apply(team1, s1, s2, s1 > s2);
            apply(team2, s2, s1, s2 > s1);
        });

        const list = Array.from(stat.values()).sort((a, b) => {
            if (b.win !== a.win) return b.win - a.win;
            if (b.diff !== a.diff) return b.diff - a.diff;
            if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
            return String(a.name).localeCompare(String(b.name), 'zh-Hans-CN');
        });

        // 只给打过比赛的人排名次，没上过场的并列显示为 "-"
        let rank = 0;
        let lastKey = null;
        list.forEach((item, index) => {
            const key = `${item.win}|${item.diff}|${item.pointsFor}`;
            if (item.played > 0) {
                if (key !== lastKey) {
                    rank = index + 1;
                    lastKey = key;
                }
                item.rank = rank;
            } else {
                item.rank = null;
            }
        });

        return list;
    }
}

module.exports = MatchRoundModel;
