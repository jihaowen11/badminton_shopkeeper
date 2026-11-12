const { DataTypes, Op } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const matchParticipants = require('../schema/matchParticipants')(Sequelize, DataTypes);

// 老库里若已有重复报名，建唯一索引会失败；这里不能让它变成未捕获的 Promise 拒绝，
// 交给 config/indexes.js 先去重再补索引
matchParticipants.sync({ force: false }).catch((err) => {
    console.error(
        '[match_participants] 建表/索引未完成，将由索引任务重试：',
        err && err.message ? err.message : err
    );
});

class MatchParticipantModel {
    static async create(data, options) {
        return await matchParticipants.create({
            matchId: data.matchId,
            userId: data.userId,
            userName: data.userName,
            userAvatar: data.userAvatar,
            number: data.number,
            teamId: data.teamId != null ? data.teamId : null,
            status: data.status
        }, options)
    }

    static async update(id, data) {
        return await matchParticipants.update({
            matchId: data.matchId,
            userId: data.userId,
            number: data.number,
            teamId: data.teamId,
            status: data.status
        }, {
            where: {
                id
            }
        })
    }

    static async detail(id) {
        return await matchParticipants.findOne({
            where: {
                id
            }
        })
    }

    static async detailByMatchUser(matchId, userId, options = {}) {
        return await matchParticipants.findOne({
            where: {
                matchId,
                userId
            },
            transaction: options.transaction
        })
    }

    static async list(data = {}) {
        const where = {};
        if (data.matchId) where.matchId = data.matchId;
        if (data.userId) where.userId = data.userId;
        if (data.teamId) where.teamId = data.teamId;
        if (data.status !== undefined && data.status !== null && data.status !== '') where.status = data.status;

        return await matchParticipants.findAll({
            where,
            order: [['id', 'DESC']]
        })
    }

    /** 某用户（openId）作为参赛者出现过的比赛 id（去重） */
    static async matchIdsByUserOpenId(openId) {
        const oid = openId != null ? String(openId).trim() : '';
        if (!oid) return [];
        const rows = await matchParticipants.findAll({
            where: { userId: oid },
            attributes: ['matchId'],
        });
        return [...new Set(rows.map((r) => r.matchId).filter((id) => id != null))];
    }

    /**
     * 某场比赛的报名情况：人数 + 当前最大编号
     * 供报名时做容量校验和顺延分配编号
     * @returns {Promise<{count: number, maxNumber: number}>}
     */
    static async statsByMatch(matchId) {
        const rows = await matchParticipants.findAll({
            where: { matchId },
            attributes: ['number'],
        });
        let maxNumber = 0;
        for (const row of rows) {
            const n = Number(row.number);
            if (Number.isFinite(n) && n > maxNumber) maxNumber = n;
        }
        return { count: rows.length, maxNumber };
    }

    /** 批量按比赛 id 拉取成员，按比赛 id、记录 id 升序 */
    static async listByMatchIds(matchIds, options = {}) {
        if (!matchIds || matchIds.length === 0) return [];
        return await matchParticipants.findAll({
            where: { matchId: { [Op.in]: matchIds } },
            order: [['matchId', 'ASC'], ['id', 'ASC']],
            transaction: options.transaction,
        });
    }

    static async delete(id) {
        return await matchParticipants.destroy({
            where: {
                id
            }
        })
    }

    /** 删除某场比赛的全部报名记录（比赛删除时级联清理，避免孤儿数据） */
    static async deleteByMatchId(matchId, options = {}) {
        return await matchParticipants.destroy({
            where: { matchId },
            ...options
        })
    }
}

module.exports = MatchParticipantModel;
