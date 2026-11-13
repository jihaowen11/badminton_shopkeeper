const { DataTypes } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const matchScores = require('../schema/matchScores')(Sequelize, DataTypes);
const { safeSync } = require('../utils/safeSync');

safeSync(matchScores, 'matchScores');

class MatchScoreModel {
    static async create(data) {
        return await matchScores.create({
            matchId: data.matchId,
            gameNumber: data.gameNumber,
            team1: data.team1,
            team2: data.team2,
            team1Score: data.team1Score,
            team2Score: data.team2Score,
            referee: data.referee
        })
    }

    static async update(id, data) {
        return await matchScores.update({
            matchId: data.matchId,
            gameNumber: data.gameNumber,
            team1: data.team1,
            team2: data.team2,
            team1Score: data.team1Score,
            team2Score: data.team2Score,
            referee: data.referee
        }, {
            where: {
                id
            }
        })
    }

    static async detail(id) {
        return await matchScores.findOne({
            where: {
                id
            }
        })
    }

    static async list(data = {}) {
        const where = {};
        if (data.matchId) where.matchId = data.matchId;
        if (data.gameNumber) where.gameNumber = data.gameNumber;

        return await matchScores.findAll({
            where,
            order: [['id', 'ASC']]
        })
    }

    static async delete(id) {
        return await matchScores.destroy({
            where: {
                id
            }
        })
    }
}

module.exports = MatchScoreModel;
