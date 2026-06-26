const MatchParticipantModel = require("../modules/matchParticipants");
const R = require("../utils/responseBeautifier")

class MatchParticipantController {
    static async create(ctx) {
        const req = ctx.request.body;
        if (req && req.matchId && req.userId) {
            try {
                const existed = await MatchParticipantModel.detailByMatchUser(req.matchId, req.userId);
                if (existed) {
                    ctx.body = R.set(existed, 200, "已报名");
                    return;
                }
                const ret = await MatchParticipantModel.create(req);
                const object = await MatchParticipantModel.detail(ret.id);
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
                await MatchParticipantModel.update(req.id, req);
                const object = await MatchParticipantModel.detail(req.id);
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
                const object = await MatchParticipantModel.detail(req.id);
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
            const object = await MatchParticipantModel.list(req);
            ctx.body = R.set(object, 200);
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }

    static async delete(ctx) {
        const req = ctx.request.body;
        if (req && req.id) {
            try {
                const ret = await MatchParticipantModel.delete(req.id);
                ctx.body = R.set({ deleted: ret }, 200, "删除成功");
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }
}

module.exports = MatchParticipantController;
