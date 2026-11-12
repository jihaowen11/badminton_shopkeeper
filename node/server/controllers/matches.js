const MatchModel = require("../modules/matches");
const ClubMemberModel = require("../modules/clubMembers");
const R = require("../utils/responseBeautifier")

/** 合法状态：1报名中 2进行中 3已结束 4中断 5取消 */
const VALID_STATUS = [1, 2, 3, 4, 5];

/** 当前登录用户（由 auth 中间件写入） */
function currentOpenId(ctx) {
    const oid = ctx && ctx.state && ctx.state.openId;
    return oid != null ? String(oid).trim() : '';
}

function plain(row) {
    if (!row) return null;
    return typeof row.get === 'function' ? row.get({ plain: true }) : row;
}

/** 比赛是否存在且由当前用户创建 */
async function loadOwnedMatch(id, openId) {
    const match = plain(await MatchModel.detail(id));
    if (!match) return { match: null, owned: false };
    return { match, owned: String(match.createdBy || '') === openId };
}

class MatchController {
    static async create(ctx) {
        const req = ctx.request.body;
        const openId = currentOpenId(ctx);
        if (!openId) {
            ctx.body = R.error(401);
            return;
        }
        if (req && req.type && req.name) {
            try {
                // 创建人一律取登录态，忽略请求体里的 createdBy/openId
                const ret = await MatchModel.create(Object.assign({}, req, { openId }));
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
        const openId = currentOpenId(ctx);
        if (req && req.id) {
            try {
                const { match, owned } = await loadOwnedMatch(req.id, openId);
                if (!match) {
                    ctx.body = R.error(412, "比赛不存在");
                    return;
                }
                if (!owned) {
                    ctx.body = R.error(403, "只有组织者可以修改比赛");
                    return;
                }
                await MatchModel.update(req.id, Object.assign({}, req, { createdBy: match.createdBy }));
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
        const openId = currentOpenId(ctx);
        try {
            // "我的比赛"按登录用户过滤，不信请求体里的 openId
            const object = await MatchModel.list(Object.assign({}, req, { openId }));
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
        const openId = currentOpenId(ctx);
        const hasStatus =
            req &&
            req.status !== undefined &&
            req.status !== null &&
            req.status !== '';
        if (req && req.id && hasStatus) {
            const status = Number(req.status);
            if (!VALID_STATUS.includes(status)) {
                ctx.body = R.error(416, "状态值不合法");
                return;
            }
            try {
                const { match, owned } = await loadOwnedMatch(req.id, openId);
                if (!match) {
                    ctx.body = R.error(412, "比赛不存在");
                    return;
                }
                if (!owned) {
                    ctx.body = R.error(403, "只有组织者可以变更比赛状态");
                    return;
                }
                const object = await MatchModel.updateStatus(req.id, status);
                ctx.body = R.set(object, 200, "状态已更新");
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    static async delete(ctx) {
        const req = ctx.request.body;
        const openId = currentOpenId(ctx);
        if (req && req.id) {
            try {
                const { match, owned } = await loadOwnedMatch(req.id, openId);
                if (!match) {
                    ctx.body = R.error(412, "比赛不存在");
                    return;
                }
                if (!owned) {
                    ctx.body = R.error(403, "只有组织者可以删除比赛");
                    return;
                }
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
        const openId = currentOpenId(ctx);
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
            // 只有比赛组织者能代报名
            const { match, owned } = await loadOwnedMatch(matchId, openId);
            if (!match) {
                ctx.body = R.error(412, "比赛不存在");
                return;
            }
            if (!owned) {
                ctx.body = R.error(403, "只有组织者可以邀请成员报名");
                return;
            }
            // 邀请人与该俱乐部要有管理关系
            const member = plain(await ClubMemberModel.detailByClubUser(clubId, openId));
            const role = member && member.role ? String(member.role).toLowerCase() : '';
            if (!member || (role !== 'owner' && role !== 'admin')) {
                ctx.body = R.error(403, "只有俱乐部会长或管理员可以邀请成员");
                return;
            }

            const result = await MatchModel.inviteClubMembers(clubId, matchId, openIds);
            ctx.body = R.set(result, 200, "邀请成功");
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }
}

module.exports = MatchController;
