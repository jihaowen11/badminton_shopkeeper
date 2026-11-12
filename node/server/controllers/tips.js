const TipsModel = require('../modules/tips');
const R = require('../utils/responseBeautifier');

class TipsController {
    /** 今日贴士（公开接口，首页未登录也要能看到） */
    static async daily(ctx) {
        try {
            const obj = await TipsModel.daily();
            if (!obj) {
                ctx.body = R.error(412, '暂无贴士内容');
                return;
            }
            ctx.body = R.set(obj, 200);
        } catch (err) {
            const tip = err && err.message ? err.message : String(err);
            ctx.body = R.error(412, tip);
        }
    }

    /** 全部贴士，body: { page?, pageSize? } */
    static async list(ctx) {
        const req = ctx.request.body || {};
        try {
            const rows = await TipsModel.list(req);
            ctx.body = R.set(rows, 200);
        } catch (err) {
            const tip = err && err.message ? err.message : String(err);
            ctx.body = R.error(412, tip);
        }
    }
}

module.exports = TipsController;
