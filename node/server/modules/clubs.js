const { DataTypes } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const clubs = require('../schema/clubs')(Sequelize, DataTypes);

clubs.sync({ force: false });

class ClubModel {
    static async create(data) {
        return await clubs.create({
            name: data.name,
            residence: data.residence,
            intro: data.intro,
            joinMethod: data.joinMethod,
            creator: data.creator
        })
    }

    static async update(id, data) {
        return await clubs.update({
            name: data.name,
            residence: data.residence,
            intro: data.intro,
            joinMethod: data.joinMethod,
            creator: data.creator
        }, {
            where: {
                id
            }
        })
    }

    static async detail(id) {
        return await clubs.findOne({
            where: {
                id
            }
        })
    }

    static async list() {
        return await clubs.findAll({
            order: [['id', 'DESC']]
        })
    }

    static async delete(id) {
        return await clubs.destroy({
            where: {
                id
            }
        })
    }
}

module.exports = ClubModel;
