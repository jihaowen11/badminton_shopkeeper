const MatchParticipantModel = require("../modules/matchParticipants");
const MatchModel = require("../modules/matches");
const UserModel = require("../modules/users");
const R = require("../utils/responseBeautifier")

/** 报名中 */
const MATCH_STATUS_OPEN = 1;

/** 当前登录用户（由 auth 中间件写入） */
function currentOpenId(ctx) {
    const oid = ctx && ctx.state && ctx.state.openId;
    return oid != null ? String(oid).trim() : '';
}

function plain(row) {
    if (!row) return null;
    return typeof row.get === 'function' ? row.get({ plain: true }) : row;
}

class MatchParticipantController {
    /**
     * 报名：身份取自登录态，服务端复核比赛状态、是否重复、是否满员
     * 这三条以前只在前端判断，抓包就能绕过
     */
    static async create(ctx) {
        const req = ctx.request.body || {};
        const openId = currentOpenId(ctx);
        if (!openId) {
            ctx.body = R.error(401);
            return;
        }
        const matchId = req.matchId;
        if (matchId == null || String(matchId).trim() === '') {
            ctx.body = R.error(416);
            return;
        }
        try {
            const match = plain(await MatchModel.detail(matchId));
            if (!match) {
                ctx.body = R.error(412, "比赛不存在");
                return;
            }
            if (Number(match.status) !== MATCH_STATUS_OPEN) {
                ctx.body = R.error(412, "当前比赛不在报名中，无法报名");
                return;
            }

            const existed = await MatchParticipantModel.detailByMatchUser(matchId, openId);
            if (existed) {
                ctx.body = R.set(existed, 200, "已报名");
                return;
            }

            const capacity = Number(match.playerCount || 0);
            const stats = await MatchParticipantModel.statsByMatch(matchId);
            if (capacity > 0 && stats.count >= capacity) {
                ctx.body = R.error(412, "报名人数已满");
                return;
            }

            const profile = plain(await UserModel.detailByOpenId(openId));

            let ret;
            try {
                ret = await MatchParticipantModel.create({
                    matchId,
                    userId: openId,
                    // 昵称头像以用户表为准，避免用请求体伪造他人姓名
                    userName: profile ? (profile.nickName || profile.name || null) : req.userName,
                    userAvatar: profile ? (profile.avatar || null) : req.userAvatar,
                    number: stats.maxNumber + 1,
                    teamId: req.teamId,
                    status: 1
                });
            } catch (err) {
                // 双击报名 / 弱网重试会并发走到这里，唯一索引挡住第二条。
                // 对用户来说结果仍然是"已报名"，不该报错。
                if (err && err.name === 'SequelizeUniqueConstraintError') {
                    const dup = await MatchParticipantModel.detailByMatchUser(matchId, openId);
                    ctx.body = R.set(dup, 200, "已报名");
                    return;
                }
                throw err;
            }
            const object = await MatchParticipantModel.detail(ret.id);
            ctx.body = R.set(object, 200, "报名成功");
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }

    static async update(ctx) {
        const req = ctx.request.body || {};
        const openId = currentOpenId(ctx);
        if (!req.id) {
            ctx.body = R.error(416);
            return;
        }
        try {
            const row = plain(await MatchParticipantModel.detail(req.id));
            if (!row) {
                ctx.body = R.error(412, "报名记录不存在");
                return;
            }
            // 只能改自己的报名记录，或由比赛组织者代改
            const match = plain(await MatchModel.detail(row.matchId));
            const isSelf = String(row.userId) === openId;
            const isOrganizer = match && String(match.createdBy) === openId;
            if (!isSelf && !isOrganizer) {
                ctx.body = R.error(403);
                return;
            }
            await MatchParticipantModel.update(req.id, req);
            const object = await MatchParticipantModel.detail(req.id);
            ctx.body = R.set(object, 200, "更新成功");
        } catch (err) {
            ctx.body = R.error(412, err);
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

    /**
     * 取消报名：本人可退，比赛组织者可代退
     */
    static async delete(ctx) {
        const req = ctx.request.body || {};
        const openId = currentOpenId(ctx);
        if (!req.id) {
            ctx.body = R.error(416);
            return;
        }
        try {
            const row = plain(await MatchParticipantModel.detail(req.id));
            if (!row) {
                ctx.body = R.error(412, "报名记录不存在");
                return;
            }
            const isSelf = String(row.userId) === openId;
            if (!isSelf) {
                const match = plain(await MatchModel.detail(row.matchId));
                const isOrganizer = match && String(match.createdBy) === openId;
                if (!isOrganizer) {
                    ctx.body = R.error(403);
                    return;
                }
            }
            const ret = await MatchParticipantModel.delete(req.id);
            ctx.body = R.set({ deleted: ret }, 200, "已取消报名");
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }
}

module.exports = MatchParticipantController;
