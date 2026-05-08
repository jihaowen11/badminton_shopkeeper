const { DataTypes, Op } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const users = require('../schema/users')(Sequelize, DataTypes);

/** 与俱乐部成员等场景对接的用户展示字段（对应 users 表） */
const PROFILE_ATTRS = [
    'openId',
    'nickName',
    'avatar',
    'gender',
    'badmintonLevel',
    'name',
    'phone',
    'accountLevel',
    'points'
];


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

    /**
     * 按 openId 批量查询用户资料，返回 Map<openId, plainObject>
     * @param {string[]} openIds
     * @returns {Promise<Map<string, object>>}
     */
    static async mapProfileByOpenIds(openIds) {
        const ids = [...new Set((openIds || []).map((id) => String(id).trim()).filter(Boolean))];
        if (ids.length === 0) return new Map();
        const rows = await users.findAll({
            where: { openId: { [Op.in]: ids } },
            attributes: PROFILE_ATTRS
        });
        const map = new Map();
        for (const row of rows) {
            const plain = row.get({ plain: true });
            if (plain.openId != null) map.set(String(plain.openId), plain);
        }
        return map;
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