const ClubMemberModel = require("../modules/clubMembers");
const R = require("../utils/responseBeautifier")

function pickClubIdUserId(req) {
    const body = req || {};
    const clubId = body.club_id != null && body.club_id !== '' ? body.club_id : body.clubId;
    const userId = body.user_id != null && body.user_id !== '' ? body.user_id : body.userId;
    return { clubId, userId };
}

class ClubMemberController {
    static async create(ctx) {
        const req = ctx.request.body;
        if (req && req.clubId && req.userId) {
            try {
                const existed = await ClubMemberModel.detailByClubUser(req.clubId, req.userId);
                if (existed) {
                    ctx.body = R.set(existed, 200, "已存在");
                    return;
                }
                const ret = await ClubMemberModel.create(req);
                const object = await ClubMemberModel.detail(ret.id);
                ctx.body = R.set(object, 200, "创建成功");
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    static async update(ctx) {
        const req = ctx.request.body;
        if (req && req.id) {
            try {
                await ClubMemberModel.update(req.id, req);
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

    /** body: club_id + user_id，或 clubId + userId（与库字段 club_id、user_id 一致） */
    static async delete(ctx) {
        const req = ctx.request.body || {};
        const { clubId, userId } = pickClubIdUserId(req);
        const hasClub = clubId != null && String(clubId).trim() !== '';
        const hasUser = userId != null && String(userId).trim() !== '';
        if (hasClub && hasUser) {
            try {
                const ret = await ClubMemberModel.deleteByClubUser(clubId, String(userId).trim());
                ctx.body = R.set({ deleted: ret }, 200, "删除成功");
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    /** body: club_id + user_id 或 clubId + userId，将成员设为 role=admin */
    static async setAdmin(ctx) {
        const { clubId, userId } = pickClubIdUserId(ctx.request.body);
        const hasClub = clubId != null && String(clubId).trim() !== '';
        const hasUser = userId != null && String(userId).trim() !== '';
        if (!hasClub || !hasUser) {
            ctx.body = R.error(416);
            return;
        }
        try {
            const object = await ClubMemberModel.setAdmin(clubId, String(userId).trim());
            if (!object) {
                ctx.body = R.error(412, "成员不存在");
                return;
            }
            ctx.body = R.set(object, 200, "已设为管理员");
        } catch (err) {
            const tip = err && err.message ? err.message : String(err);
            ctx.body = R.error(412, tip);
        }
    }

    /** body: club_id + user_id 或 clubId + userId，admin → member */
    static async removeAdmin(ctx) {
        const { clubId, userId } = pickClubIdUserId(ctx.request.body);
        const hasClub = clubId != null && String(clubId).trim() !== '';
        const hasUser = userId != null && String(userId).trim() !== '';
        if (!hasClub || !hasUser) {
            ctx.body = R.error(416);
            return;
        }
        try {
            const object = await ClubMemberModel.removeAdmin(clubId, String(userId).trim());
            if (!object) {
                ctx.body = R.error(412, "成员不存在");
                return;
            }
            ctx.body = R.set(object, 200, "已移除管理员");
        } catch (err) {
            const tip = err && err.message ? err.message : String(err);
            ctx.body = R.error(412, tip);
        }
    }
}

module.exports = ClubMemberController;
