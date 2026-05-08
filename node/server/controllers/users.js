const axios = require('axios');
const path = require('path');
const fs = require('fs');
const UserModel = require("../modules/users");
const R = require("../utils/responseBeautifier")

const AVATAR_DIR = path.join(__dirname, '../public/avatar');

function sanitizeOpenIdForFile(openId) {
    return String(openId).trim().replace(/[^a-zA-Z0-9_-]/g, '');
}

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

    /**
     * multipart：字段 openId，文件字段名 file
     * 保存为 public/avatar/{openId}{扩展名}，同名覆盖；返回不含域名的路径，如 /avatar/xxx.jpg
     */
    static async uploadAvatar(ctx) {
        const openIdRaw = ctx.req.body && ctx.req.body.openId;
        const file = ctx.req.file;
        if (!openIdRaw || !file || !file.buffer) {
            ctx.body = R.error(416);
            return;
        }
        const safeOpenId = sanitizeOpenIdForFile(openIdRaw);
        if (!safeOpenId) {
            ctx.body = R.error(416);
            return;
        }
        try {
            fs.mkdirSync(AVATAR_DIR, { recursive: true });
            const ext = path.extname(file.originalname || '') || '.jpg';
            const newName = safeOpenId + ext;
            const newPath = path.join(AVATAR_DIR, newName);
            for (const name of fs.readdirSync(AVATAR_DIR)) {
                const base = path.basename(name, path.extname(name));
                if (base === safeOpenId) {
                    fs.unlinkSync(path.join(AVATAR_DIR, name));
                }
            }
            fs.writeFileSync(newPath, file.buffer);
            const publicPath = `/avatar/${newName}`;
            ctx.body = R.set({ path: publicPath }, 200);
        } catch (err) {
            ctx.body = R.error(412, err);
        }
    }
}

module.exports = UserController;