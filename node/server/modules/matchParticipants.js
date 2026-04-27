const { DataTypes } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const matchParticipants = require('../schema/matchParticipants')(Sequelize, DataTypes);

matchParticipants.sync({ force: false });

class MatchParticipantModel {
    static async create(data) {
        return await matchParticipants.create({
            matchId: data.matchId,
            userId: data.userId,
            number: data.number,
            teamId: data.teamId,
            status: data.status
        })
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

    static async detailByMatchUser(matchId, userId) {
        return await matchParticipants.findOne({
            where: {
                matchId,
                userId
            }
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

    static async delete(id) {
        return await matchParticipants.destroy({
            where: {
                id
            }
        })
    }
}

module.exports = MatchParticipantModel;
