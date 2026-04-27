const { DataTypes } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const clubMembers = require('../schema/clubMembers')(Sequelize, DataTypes);

clubMembers.sync({ force: false });

class ClubMemberModel {
    static async create(data) {
        return await clubMembers.create({
            clubId: data.clubId,
            userId: data.userId,
            role: data.role,
            status: data.status,
            activity: data.activity,
            joinedAt: data.joinedAt,
            remark: data.remark
        })
    }

    static async update(id, data) {
        return await clubMembers.update({
            clubId: data.clubId,
            userId: data.userId,
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

    static async delete(id) {
        return await clubMembers.destroy({
            where: {
                id
            }
        })
    }
}

module.exports = ClubMemberModel;
