const UserStatsModel = require('../modules/userStats');
const R = require('../utils/responseBeautifier');

function str(v) {
    return v != null ? String(v).trim() : '';
}

function currentOpenId(ctx) {
    return ctx && ctx.state && ctx.state.openId ? String(ctx.state.openId).trim() : '';
}

class UserStatsController {
    /**
     * 我的战绩 + 最近比赛
     * body: { openId?, limit? }
     *
     * openId 主要用于看别人的个人主页；不传就是看自己。
     * 看别人的战绩本来就是公开信息（个人主页本身就是分享出去的），所以不额外限制。
     */
    static async mine(ctx) {
        const req = ctx.request.body || {};
        const openId = str(req.openId) || currentOpenId(ctx);
        if (!openId) {
            ctx.body = R.error(416, '缺少用户标识');
            return;
        }
        const limit = Number(req.limit) > 0 ? Math.min(20, Number(req.limit)) : 5;

        try {
            const rounds = await UserStatsModel.finishedRoundsOf(openId);
            const summary = UserStatsModel.computeSummary(rounds, openId);
            const recent = await UserStatsModel.recent(openId, limit);
            ctx.body = R.set({ openId, summary, recent }, 200);
        } catch (err) {
            const tip = err && err.message ? err.message : String(err);
            ctx.body = R.error(412, tip);
        }
    }

    /** 首页总量统计（公开接口，不含任何个人数据） */
    static async overview(ctx) {
        try {
            const data = await UserStatsModel.overview();
            ctx.body = R.set(data, 200);
        } catch (err) {
            const tip = err && err.message ? err.message : String(err);
            ctx.body = R.error(412, tip);
        }
    }
}

module.exports = UserStatsController;
