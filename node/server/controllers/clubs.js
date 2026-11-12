const ClubModel = require("../modules/clubs");
const R = require("../utils/responseBeautifier")

/** 当前登录用户（由 auth 中间件写入） */
function currentOpenId(ctx) {
    const oid = ctx && ctx.state && ctx.state.openId;
    return oid != null ? String(oid).trim() : '';
}

function plain(row) {
    if (!row) return null;
    return typeof row.get === 'function' ? row.get({ plain: true }) : row;
}

/** 俱乐部是否存在且由当前用户创建 */
async function loadOwnedClub(id, openId) {
    const club = plain(await ClubModel.detail(id));
    if (!club) return { club: null, owned: false };
    return { club, owned: String(club.creator || '') === openId };
}

class ClubController {
    static async create(ctx) {
        const req = ctx.request.body || {};
        const openId = currentOpenId(ctx);
        if (!openId) {
            ctx.body = R.error(401);
            return;
        }
        if (req.name) {
            try {
                // 创建者一律取登录态
                const ret = await ClubModel.create(Object.assign({}, req, { creator: openId }));
                const object = await ClubModel.detail(ret.id);
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
                const { club, owned } = await loadOwnedClub(req.id, openId);
                if (!club) {
                    ctx.body = R.error(412, "俱乐部不存在");
                    return;
                }
                if (!owned) {
                    ctx.body = R.error(403, "只有会长可以修改俱乐部信息");
                    return;
                }
                await ClubModel.update(req.id, Object.assign({}, req, { creator: club.creator }));
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

    /** 我的俱乐部：按登录用户查询，忽略请求体里的 openId */
    static async myList(ctx) {
        const openId = currentOpenId(ctx);
        if (!openId) {
            ctx.body = R.error(401);
            return;
        }
        try {
            const list = await ClubModel.listMineByOpenId(openId);
            ctx.body = R.set(list, 200);
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }

    static async delete(ctx) {
        const req = ctx.request.body;
        const openId = currentOpenId(ctx);
        if (req && req.id) {
            try {
                const { club, owned } = await loadOwnedClub(req.id, openId);
                if (!club) {
                    ctx.body = R.error(412, "俱乐部不存在");
                    return;
                }
                if (!owned) {
                    ctx.body = R.error(403, "只有会长可以解散俱乐部");
                    return;
                }
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
