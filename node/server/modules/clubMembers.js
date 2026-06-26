const { DataTypes, Op } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const clubMembers = require('../schema/clubMembers')(Sequelize, DataTypes);

clubMembers.sync({ force: false });

class ClubMemberModel {
    static async create(data, options) {
        return await clubMembers.create({
            clubId: data.clubId,
            userId: data.userId,
            userName: data.userName,
            userAvatar: data.userAvatar,
            role: data.role,
            status: data.status,
            activity: data.activity,
            joinedAt: data.joinedAt,
            remark: data.remark
        }, options)
    }

    static async update(id, data) {
        return await clubMembers.update({
            clubId: data.clubId,
            userId: data.userId,
            userName: data.userName,
            userAvatar: data.userAvatar,
            role: data.role,
            status: data.status,
            activity: data.activity,
            joinedAt: data.joinedAt,
            remark: data.remark
        }, {
            where: {
                id
            }
        })
    }

    static async detail(id) {
        return await clubMembers.findOne({
            where: {
                id
            }
        })
    }

    static async detailByClubUser(clubId, userId) {
        return await clubMembers.findOne({
            where: {
                clubId,
                userId
            }
        })
    }

    static async list(data = {}) {
        const where = {};
        if (data.clubId) where.clubId = data.clubId;
        if (data.userId) where.userId = data.userId;
        if (data.status !== undefined && data.status !== null && data.status !== '') where.status = data.status;

        return await clubMembers.findAll({
            where,
            order: [['id', 'DESC']]
        })
    }

    /** 某俱乐部下指定 openId 成员，返回 Map<openId, plainObject> */
    static async mapByClubAndOpenIds(clubId, openIds, options = {}) {
        const ids = [...new Set((openIds || []).map((id) => String(id).trim()).filter(Boolean))];
        if (ids.length === 0) return new Map();
        const rows = await clubMembers.findAll({
            where: {
                clubId,
                userId: { [Op.in]: ids },
            },
            transaction: options.transaction,
        });
        const map = new Map();
        for (const row of rows) {
            const plain = row.get({ plain: true });
            if (plain.userId != null) map.set(String(plain.userId), plain);
        }
        return map;
    }

    static async delete(id) {
        return await clubMembers.destroy({
            where: {
                id
            }
        })
    }

    /** 按俱乐部 + 用户（openId）删除一条成员记录 */
    static async deleteByClubUser(clubId, userId) {
        return await clubMembers.destroy({
            where: { clubId, userId }
        })
    }

    /** 删除某俱乐部下全部成员（可与 transaction 搭配） */
    static async deleteByClubId(clubId, options = {}) {
        return await clubMembers.destroy({
            where: { clubId },
            ...options
        })
    }

    /**
     * 设为管理员 role=admin（创建者 owner 不可改）
     * @returns {Promise<object|null>} 更新后的成员行，不存在返回 null
     */
    static async setAdmin(clubId, userId) {
        const row = await clubMembers.findOne({ where: { clubId, userId } });
        if (!row) return null;
        const plain = row.get({ plain: true });
        if (plain.role === 'owner') {
            throw new Error('创建者不能设置为管理员');
        }
        await clubMembers.update({ role: 'admin' }, { where: { clubId, userId } });
        return clubMembers.findOne({ where: { clubId, userId } });
    }

    /**
     * 移除管理员：admin → member（owner 不可改；已是 member 则不变）
     * @returns {Promise<object|null>} 当前成员行，不存在返回 null
     */
    static async removeAdmin(clubId, userId) {
        const row = await clubMembers.findOne({ where: { clubId, userId } });
        if (!row) return null;
        const plain = row.get({ plain: true });
        if (plain.role === 'owner') {
            throw new Error('不能变更创建者角色');
        }
        if (plain.role === 'admin') {
            await clubMembers.update({ role: 'member' }, { where: { clubId, userId } });
        }
        return clubMembers.findOne({ where: { clubId, userId } });
    }
}

module.exports = ClubMemberModel;
