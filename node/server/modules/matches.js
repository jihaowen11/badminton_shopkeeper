const { DataTypes } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const matches = require('../schema/matches')(Sequelize, DataTypes);

matches.sync({ force: false });

class MatchModel {
    static async create(data) {
        return await matches.create({
            clubId: data.clubId,
            activityId: data.activityId,
            type: data.type,
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
            playerCount: data.playerCount
        })
    }

    static async update(id, data) {
        return await matches.update({
            clubId: data.clubId,
            activityId: data.activityId,
            type: data.type,
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
            playerCount: data.playerCount
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

    static async list(data = {}) {
        const where = {};
        if (data.clubId) where.clubId = data.clubId;
        if (data.activityId) where.activityId = data.activityId;
        if (data.type) where.type = data.type;
        if (data.status !== undefined && data.status !== null && data.status !== '') where.status = data.status;

        return await matches.findAll({
            where,
            order: [['id', 'DESC']]
        })
    }

    static async delete(id) {
        return await matches.destroy({
            where: {
                id
            }
        })
    }
}

module.exports = MatchModel;
