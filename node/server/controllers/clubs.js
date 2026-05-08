const ClubModel = require("../modules/clubs");
const R = require("../utils/responseBeautifier")

class ClubController {
    static async create(ctx) {
        const req = ctx.request.body;
        if (req && req.name && req.creator) {
            try {
                const ret = await ClubModel.create(req);
                const object = await ClubModel.detail(ret.id);
                ctx.body = R.set(object, 200, "创建成功");
            } catch (err) {
                const tip = err && err.message ? err.message : String(err);
                ctx.body = R.error(412, tip);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    static async update(ctx) {
        const req = ctx.request.body;
        if (req && req.id) {
            try {
                await ClubModel.update(req.id, req);
                const object = await ClubModel.detail(req.id);
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
                const object = await ClubModel.detailWithMembers(req.id);
                ctx.body = R.set(object, 200);
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    static async list(ctx) {
        try {
            const object = await ClubModel.list();
            ctx.body = R.set(object, 200);
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }

    /** body: openId 或 openid（微信 openId，与 club_members.user_id 一致） */
    static async myList(ctx) {
        const req = ctx.request.body;
        const openId = req && (req.openId != null && req.openId !== ''
            ? String(req.openId).trim()
            : (req.openid != null && req.openid !== '' ? String(req.openid).trim() : ''));
        if (openId) {
            try {
                const list = await ClubModel.listMineByOpenId(openId);
                ctx.body = R.set(list, 200);
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    static async delete(ctx) {
        const req = ctx.request.body;
        if (req && req.id) {
            try {
                const ret = await ClubModel.delete(req.id);
                ctx.body = R.set({ deleted: ret }, 200, "删除成功");
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }
}

module.exports = ClubController;
