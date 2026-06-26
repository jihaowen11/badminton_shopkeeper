const MatchModel = require("../modules/matches");
const R = require("../utils/responseBeautifier")

class MatchController {
    static async create(ctx) {
        const req = ctx.request.body;
        if (req && req.type && req.name) {
            try {
                const ret = await MatchModel.create(req);
                const object = await MatchModel.detail(ret.id);
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
                await MatchModel.update(req.id, req);
                const object = await MatchModel.detail(req.id);
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
                const object = await MatchModel.detailWithExtras(req.id);
                if (!object) {
                    ctx.body = R.error(412, "比赛不存在");
                    return;
                }
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
            const object = await MatchModel.list(req);
            ctx.body = R.set(object, 200);
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }

    /** body: { id } 比赛 id，浏览量 +1 */
    static async incrementViews(ctx) {
        const req = ctx.request.body;
        if (req && req.id) {
            try {
                const object = await MatchModel.incrementViews(req.id);
                if (!object) {
                    ctx.body = R.error(412, "比赛不存在");
                    return;
                }
                ctx.body = R.set(object, 200, "浏览量+1");
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    /** body: { id, status } 状态：1报名中 2进行中 3已结束 4中断 5取消 */
    static async updateStatus(ctx) {
        const req = ctx.request.body;
        const hasStatus =
            req &&
            req.status !== undefined &&
            req.status !== null &&
            req.status !== '';
        if (req && req.id && hasStatus) {
            try {
                const object = await MatchModel.updateStatus(req.id, req.status);
                if (!object) {
                    ctx.body = R.error(412, "比赛不存在");
                    return;
                }
                ctx.body = R.set(object, 200, "状态已更新");
            } catch (err) {
                const tip = err && err.message ? err.message : String(err);
                ctx.body = R.error(412, tip);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    static async delete(ctx) {
        const req = ctx.request.body;
        if (req && req.id) {
            try {
                const ret = await MatchModel.delete(req.id);
                ctx.body = R.set({ deleted: ret }, 200, "删除成功");
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    /** body: { clubId, matchId, openIds: string[] } 邀请俱乐部成员加入比赛 */
    static async inviteClubMembers(ctx) {
        const req = ctx.request.body || {};
        const clubId = req.clubId;
        const matchId = req.matchId;
        const openIds = req.openIds;

        const hasClub = clubId != null && String(clubId).trim() !== '';
        const hasMatch = matchId != null && String(matchId).trim() !== '';
        const hasOpenIds = Array.isArray(openIds) && openIds.length > 0;

        if (!hasClub || !hasMatch || !hasOpenIds) {
            ctx.body = R.error(416);
            return;
        }

        try {
            const result = await MatchModel.inviteClubMembers(clubId, matchId, openIds);
            ctx.body = R.set(result, 200, "邀请成功");
        } catch (err) {
            const tip = err && err.message ? err.message : String(err);
            ctx.body = R.error(412, tip);
        }
    }
}

module.exports = MatchController;
