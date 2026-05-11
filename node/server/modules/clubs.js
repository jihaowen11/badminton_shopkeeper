const { DataTypes, Op } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const clubs = require('../schema/clubs')(Sequelize, DataTypes);
const UserModel = require('./users');
const ClubMemberModel = require('./clubMembers');

clubs.sync({ force: false });

/** 成员行 + users 表关联资料（club_members.user_id = users.open_id） */
async function membersPlainWithUserProfiles(memberInstances) {
    const plains = memberInstances.map((m) => m.get({ plain: true }));
    const openIds = plains.map((row) => row.userId).filter(Boolean);
    const userMap = await UserModel.mapProfileByOpenIds(openIds);
    return plains.map((row) => {
        const key = row.userId != null ? String(row.userId) : '';
        const user = key ? (userMap.get(key) || null) : null;
        return { ...row, user };
    });
}

/** 会长(owner) → 管理员(admin) → 成员(member)，同角色按 id 升序 */
const MEMBER_ROLE_ORDER = { owner: 0, admin: 1, member: 2 };

function sortMembersByRole(members) {
    return [...members].sort((a, b) => {
        const ra = MEMBER_ROLE_ORDER[String(a.role || '').toLowerCase()] ?? 99;
        const rb = MEMBER_ROLE_ORDER[String(b.role || '').toLowerCase()] ?? 99;
        if (ra !== rb) return ra - rb;
        return (Number(a.id) || 0) - (Number(b.id) || 0);
    });
}

class ClubModel {
    static async create(data) {
        if (!data || !data.creator) {
            throw new Error('缺少创建者 creator(openId)');
        }
        const user = await UserModel.detailByOpenId(data.creator);
        if (!user) {
            throw new Error('用户不存在');
        }
        const accountLevel = user.accountLevel != null ? Number(user.accountLevel) : 0;
        if (accountLevel === 0) {
            const createdCount = await clubs.count({
                where: { creator: data.creator }
            });
            if (createdCount >= 3) {
                throw new Error('该账号创建俱乐部已达上限');
            }
        }
        const t = await Sequelize.transaction();
        try {
            const club = await clubs.create({
                name: data.name,
                type: data.type,
                residence: data.residence,
                intro: data.intro,
                joinMethod: data.joinMethod,
                creator: data.creator
            }, { transaction: t });
            await ClubMemberModel.create({
                clubId: club.id,
                userId: user.openId,
                userName: user.nickName || user.name || null,
                userAvatar: user.avatar || null,
                role: 'owner',
                status: 1,
                activity: 0,
                joinedAt: new Date(),
                remark: null
            }, { transaction: t });
            await t.commit();
            return club;
        } catch (e) {
            await t.rollback();
            throw e;
        }
    }

    static async update(id, data) {
        return await clubs.update({
            name: data.name,
            type: data.type,
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

    /** 俱乐部基本信息 + 成员列表（平铺对象，供接口返回）；成员含 users 关联字段 user */
    static async detailWithMembers(id) {
        const club = await clubs.findOne({ where: { id } });
        if (!club) return null;
        const members = await ClubMemberModel.list({ clubId: id });
        const membersOut = sortMembersByRole(await membersPlainWithUserProfiles(members));
        return {
            club: club.get({ plain: true }),
            members: membersOut
        };
    }

    static async list() {
        return await clubs.findAll({
            order: [['id', 'DESC']]
        })
    }

    /**
     * 当前用户（openId）所在俱乐部：先查 club_members，再查 clubs，并附带各俱乐部成员列表
     * @param {string} openId
     * @returns {Promise<Array<{ club: object, members: object[] }>>}
     */
    static async listMineByOpenId(openId) {
        const oid = openId != null ? String(openId).trim() : '';
        if (!oid) return [];

        const myRows = await ClubMemberModel.list({ userId: oid });
        const seen = new Set();
        const clubIds = [];
        for (const row of myRows) {
            const cid = row.clubId;
            if (cid == null || seen.has(cid)) continue;
            seen.add(cid);
            clubIds.push(cid);
        }
        if (clubIds.length === 0) return [];

        const clubRows = await clubs.findAll({
            where: { id: { [Op.in]: clubIds } }
        });
        const clubById = new Map(clubRows.map((c) => [c.id, c]));

        const out = [];
        for (const clubId of clubIds) {
            const club = clubById.get(clubId);
            if (!club) continue;
            const members = await ClubMemberModel.list({ clubId });
            const membersOut = sortMembersByRole(await membersPlainWithUserProfiles(members));
            out.push({
                club: club.get({ plain: true }),
                members: membersOut
            });
        }
        return out;
    }

    static async delete(id) {
        const t = await Sequelize.transaction();
        try {
            await ClubMemberModel.deleteByClubId(id, { transaction: t });
            const deleted = await clubs.destroy({
                where: { id },
                transaction: t
            });
            await t.commit();
            return deleted;
        } catch (e) {
            await t.rollback();
            throw e;
        }
    }
}

module.exports = ClubModel;
