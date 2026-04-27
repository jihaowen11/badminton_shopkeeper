const ClubMemberModel = require("../modules/clubMembers");
const R = require("../utils/responseBeautifier")

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

    static async delete(ctx) {
        const req = ctx.request.body;
        if (req && req.id) {
            try {
                const ret = await ClubMemberModel.delete(req.id);
                ctx.body = R.set({ deleted: ret }, 200, "删除成功");
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }
}

module.exports = ClubMemberController;
