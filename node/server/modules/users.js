const { DataTypes } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const users = require('../schema/users')(Sequelize, DataTypes);


users.sync({force: false});

class UserModel {
    static async create(data) {
        return await users.create({
            openId: data.openId,
            nickName: data.nickName,
            avatar: data.avatar,
            gender: data.gender,
            badmintonLevel: data.badmintonLevel,
            name: data.name,
            phone: data.phone
        })
    }

    static async detail(id) {
        return await users.findOne({
            where: {
                id
            }
        })
    }

    static async detailByOpenId(openId) {
        return await users.findOne({
            where: {
                openId
            }
        })
    }

    static async update(openId, data) {
        return await users.update({
            nickName: data.nickName,
            avatar: data.avatar,
            gender: data.gender,
            badmintonLevel: data.badmintonLevel,
            name: data.name,
            phone: data.phone
        }, {
            where: {
                openId
            }
        })
    }

    static async delete(openId) {
        return await users.destroy({
            where: {
                openId
            }
        })
    }
}

module.exports = UserModel;