const axios = require('axios');
const UserModel = require("../modules/users");
const R = require("../utils/responseBeautifier")

function randomUsername(prefix = "", length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let username = prefix;
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        username += chars[randomIndex];
    }
    return username;
}

const appId = 'wxbd77ad3a1bd4ad03';
const appSecret = '1ef4225fb6b838b3e0dcf40022a2730b';

class UserController {
    static async create(ctx) {
        let req = ctx.request.body;
        if (req.nickName && req.openId) {
            try {
                const ret = await UserModel.create(req);
                const object = await UserModel.detail(ret.id);
                ctx.body = R.set(object, 200);
            } catch (err) {
                ctx.body = R.error(412);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    static async openid(ctx) {
        let req = ctx.request.body;
        if (req.code) {
            try {
                const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${req.code}&grant_type=authorization_code`;
                const ret = await axios.get(url);
                ctx.body = R.set(ret.data, 200);
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    static async updata(ctx) {
        let req = ctx.request.body;
        if (req.openId) {
            try {
                const object = await UserModel.detailByOpenId(req.openId);
                let ret;
                if (object) {
                    ret = await UserModel.update(req.openId, req);
                } else {
                    ret = await UserModel.create(req);
                }
                const obj = await UserModel.detailByOpenId(req.openId);
                ctx.body = R.set(obj, 200, object ? "更新成功" : "创建成功");
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }

    static async findUserByOpenid(ctx) {
        let req = ctx.request.body;
        if (req.openId) {
            try {
                let object = await UserModel.detailByOpenId(req.openId);
                if (!object) {
                    const nickName = randomUsername('羽球人_', 6);
                    const ret = await UserModel.create({
                        openId: req.openId,
                        nickName
                    });
                    object = await UserModel.detail(ret.id);
                }
                ctx.body = R.set(object, 200);
            } catch (err) {
                ctx.body = R.error(412, err);
            }
        } else {
            ctx.body = R.error(416);
        }
    }
}

module.exports = UserController;