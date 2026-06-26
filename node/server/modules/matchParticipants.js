const { DataTypes, Op } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const matchParticipants = require('../schema/matchParticipants')(Sequelize, DataTypes);

matchParticipants.sync({ force: false });

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
}

module.exports = MatchParticipantModel;
