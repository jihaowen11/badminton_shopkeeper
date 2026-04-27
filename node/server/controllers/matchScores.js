const MatchScoreModel = require("../modules/matchScores");
const R = require("../utils/responseBeautifier")

class MatchScoreController {
    static async create(ctx) {
        const req = ctx.request.body;
        if (req && req.matchId && req.gameNumber !== undefined && req.gameNumber !== null) {
            try {
                const ret = await MatchScoreModel.create(req);
                const object = await MatchScoreModel.detail(ret.id);
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
                await MatchScoreModel.update(req.id, req);
                const object = await MatchScoreModel.detail(req.id);
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
                const object = await MatchScoreModel.detail(req.id);
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
            const object = await MatchScoreModel.list(req);
            ctx.body = R.set(object, 200);
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }

    static async delete(ctx) {
        const req = ctx.request.body;
        if (req && req.id) {
            try {
                const ret = await MatchScoreModel.delete(req.id);
                ctx.body = R.set({ deleted: ret }, 200, "删除成功");
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }
}

module.exports = MatchScoreController;
