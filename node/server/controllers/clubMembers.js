const ClubMemberModel = require("../modules/clubMembers");
const ClubModel = require("../modules/clubs");
const UserModel = require("../modules/users");
const R = require("../utils/responseBeautifier")

function pickClubIdUserId(req) {
    const body = req || {};
    const clubId = body.club_id != null && body.club_id !== '' ? body.club_id : body.clubId;
    const userId = body.user_id != null && body.user_id !== '' ? body.user_id : body.userId;
    return { clubId, userId };
}

/** 当前登录用户（由 auth 中间件写入） */
function currentOpenId(ctx) {
    const oid = ctx && ctx.state && ctx.state.openId;
    return oid != null ? String(oid).trim() : '';
}

function plain(row) {
    if (!row) return null;
    return typeof row.get === 'function' ? row.get({ plain: true }) : row;
}

/** 读某俱乐部下当前用户的成员记录，返回 { member, role } */
async function loadMyMembership(clubId, openId) {
    const member = plain(await ClubMemberModel.detailByClubUser(clubId, openId));
    const role = member && member.role ? String(member.role).toLowerCase() : '';
    return { member, role };
}

/** 是否是俱乐部会长（以 clubs.creator 为准，兼容 role=owner） */
async function isClubOwner(clubId, openId) {
    const club = plain(await ClubModel.detail(clubId));
    if (!club) return { club: null, isOwner: false };
    if (String(club.creator || '') === openId) return { club, isOwner: true };
    const { role } = await loadMyMembership(clubId, openId);
    return { club, isOwner: role === 'owner' };
}

class ClubMemberController {
    /**
     * 加入俱乐部：身份取自登录态，角色固定 member
     * 以前 userId 和 role 都来自请求体，等于可以自己把自己设成 owner
     */
    static async create(ctx) {
        const req = ctx.request.body || {};
        const openId = currentOpenId(ctx);
        if (!openId) {
            ctx.body = R.error(401);
            return;
        }
        const clubId = req.clubId != null && req.clubId !== '' ? req.clubId : req.club_id;
        if (clubId == null || String(clubId).trim() === '') {
            ctx.body = R.error(416);
            return;
        }
        try {
            const club = plain(await ClubModel.detail(clubId));
            if (!club) {
                ctx.body = R.error(412, "俱乐部不存在");
                return;
            }
            const existed = await ClubMemberModel.detailByClubUser(clubId, openId);
            if (existed) {
                ctx.body = R.set(existed, 200, "已加入该俱乐部");
                return;
            }
            const profile = plain(await UserModel.detailByOpenId(openId));
            const ret = await ClubMemberModel.create({
                clubId,
                userId: openId,
                // 昵称头像以用户表为准，避免用请求体伪造
                userName: profile ? (profile.nickName || profile.name || null) : req.userName,
                userAvatar: profile ? (profile.avatar || null) : req.userAvatar,
                role: 'member',
                status: 1,
                activity: 0,
                joinedAt: new Date(),
                remark: null
            });
            const object = await ClubMemberModel.detail(ret.id);
            ctx.body = R.set(object, 200, "加入成功");
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }

    static async update(ctx) {
        const req = ctx.request.body;
        const openId = currentOpenId(ctx);
        if (req && req.id) {
            try {
                const row = plain(await ClubMemberModel.detail(req.id));
                if (!row) {
                    ctx.body = R.error(412, "成员不存在");
                    return;
                }
                const { isOwner } = await isClubOwner(row.clubId, openId);
                if (!isOwner) {
                    ctx.body = R.error(403, "只有会长可以修改成员信息");
                    return;
                }
                // 角色变更走 setAdmin/removeAdmin，这里不放开 role
                const payload = Object.assign({}, req, {
                    clubId: row.clubId,
                    userId: row.userId,
                    role: row.role
                });
                await ClubMemberModel.update(req.id, payload);
                const object = await ClubMemberModel.detail(req.id);
                ctx.body = R.set(object, 200, "更新成功");
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    static async detail(ctx) {
        const req = ctx.request.body;
        if (req && req.id) {
            try {
                const object = await ClubMemberModel.detail(req.id);
                ctx.body = R.set(object, 200);
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    static async list(ctx) {
        const req = ctx.request.body || {};
        try {
            const object = await ClubMemberModel.list(req);
            ctx.body = R.set(object, 200);
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }

    /**
     * 移出 / 退出俱乐部
     * 允许：本人退出、会长或管理员移出他人；会长不能被他人移出
     */
    static async delete(ctx) {
        const req = ctx.request.body || {};
        const openId = currentOpenId(ctx);
        const { clubId, userId } = pickClubIdUserId(req);
        const hasClub = clubId != null && String(clubId).trim() !== '';
        const hasUser = userId != null && String(userId).trim() !== '';
        if (!hasClub || !hasUser) {
            ctx.body = R.error(416);
            return;
        }
        const targetId = String(userId).trim();
        try {
            const isSelf = targetId === openId;
            if (!isSelf) {
                const { club, isOwner } = await isClubOwner(clubId, openId);
                if (!club) {
                    ctx.body = R.error(412, "俱乐部不存在");
                    return;
                }
                let canManage = isOwner;
                if (!canManage) {
                    const mine = await loadMyMembership(clubId, openId);
                    canManage = mine.role === 'admin';
                }
                if (!canManage) {
                    ctx.body = R.error(403, "没有权限移出该成员");
                    return;
                }
                // 会长不能被移出，只能走解散
                const target = await loadMyMembership(clubId, targetId);
                if (target.role === 'owner' || String(club.creator || '') === targetId) {
                    ctx.body = R.error(403, "会长不能被移出，请使用解散俱乐部");
                    return;
                }
            }
            const ret = await ClubMemberModel.deleteByClubUser(clubId, targetId);
            if (!ret) {
                ctx.body = R.error(412, "成员不存在");
                return;
            }
            ctx.body = R.set({ deleted: ret }, 200, isSelf ? "已退出俱乐部" : "已移出俱乐部");
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }

    /** body: club_id + user_id 或 clubId + userId，将成员设为 role=admin（仅会长） */
    static async setAdmin(ctx) {
        const { clubId, userId } = pickClubIdUserId(ctx.request.body);
        const openId = currentOpenId(ctx);
        const hasClub = clubId != null && String(clubId).trim() !== '';
        const hasUser = userId != null && String(userId).trim() !== '';
        if (!hasClub || !hasUser) {
            ctx.body = R.error(416);
            return;
        }
        try {
            const { club, isOwner } = await isClubOwner(clubId, openId);
            if (!club) {
                ctx.body = R.error(412, "俱乐部不存在");
                return;
            }
            if (!isOwner) {
                ctx.body = R.error(403, "只有会长可以设置管理员");
                return;
            }
            const object = await ClubMemberModel.setAdmin(clubId, String(userId).trim());
            if (!object) {
                ctx.body = R.error(412, "成员不存在");
                return;
            }
            ctx.body = R.set(object, 200, "已设为管理员");
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }

    /** body: club_id + user_id 或 clubId + userId，admin → member（仅会长） */
    static async removeAdmin(ctx) {
        const { clubId, userId } = pickClubIdUserId(ctx.request.body);
        const openId = currentOpenId(ctx);
        const hasClub = clubId != null && String(clubId).trim() !== '';
        const hasUser = userId != null && String(userId).trim() !== '';
        if (!hasClub || !hasUser) {
            ctx.body = R.error(416);
            return;
        }
        try {
            const { club, isOwner } = await isClubOwner(clubId, openId);
            if (!club) {
                ctx.body = R.error(412, "俱乐部不存在");
                return;
            }
            if (!isOwner) {
                ctx.body = R.error(403, "只有会长可以取消管理员");
                return;
            }
            const object = await ClubMemberModel.removeAdmin(clubId, String(userId).trim());
            if (!object) {
                ctx.body = R.error(412, "成员不存在");
                return;
            }
            ctx.body = R.set(object, 200, "已移除管理员");
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }
}

module.exports = ClubMemberController;
