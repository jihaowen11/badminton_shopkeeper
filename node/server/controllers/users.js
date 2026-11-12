const axios = require('axios');
const path = require('path');
const fs = require('fs');
const UserModel = require("../modules/users");
const R = require("../utils/responseBeautifier")
const env = require("../config/env");
const { signToken } = require("../utils/token");

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

/** 当前登录用户（由 auth 中间件写入）；没有则返回空串 */
function currentOpenId(ctx) {
    const oid = ctx && ctx.state && ctx.state.openId;
    return oid != null ? String(oid).trim() : '';
}

/**
 * 调用微信开放接口时的代理配置。
 * 默认强制直连（proxy: false）：axios 会自动读取 HTTP(S)_PROXY 环境变量，
 * 国内开发机常挂着本地代理，一旦代理不通就会报 socket hang up，
 * 而 api.weixin.qq.com 是国内服务，本来也不该走代理。
 * 确有需要时在 .env 里设置 WX_HTTP_PROXY=http://host:port 显式指定。
 */
function wxProxyConfig() {
    const raw = String(env.get('WX_HTTP_PROXY', '') || '').trim();
    if (!raw) return false;
    try {
        const u = new URL(raw);
        return {
            protocol: u.protocol.replace(':', ''),
            host: u.hostname,
            port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80),
        };
    } catch (e) {
        console.warn('[wx] WX_HTTP_PROXY 格式不合法，已忽略：', raw);
        return false;
    }
}

/** 把网络异常翻译成能指导排查的提示 */
function describeWxNetworkError(err) {
    const code = (err && (err.code || (err.cause && err.cause.code))) || '';
    const map = {
        ECONNRESET: '连接被重置',
        ECONNREFUSED: '连接被拒绝',
        ETIMEDOUT: '连接超时',
        ESOCKETTIMEDOUT: '连接超时',
        ENOTFOUND: '域名解析失败',
        EAI_AGAIN: '域名解析暂时失败',
        EHOSTUNREACH: '主机不可达',
        ENETUNREACH: '网络不可达',
        CERT_HAS_EXPIRED: '证书已过期',
        UNABLE_TO_VERIFY_LEAF_SIGNATURE: '证书校验失败',
    };
    const reason = map[code] || (err && err.message) || '未知错误';
    return `无法连接微信服务器（${code || 'NETWORK_ERROR'}：${reason}）。请检查服务器出网与代理设置，可在 .env 中设置 WX_HTTP_PROXY 显式指定代理`;
}

/** 请求微信开放接口，返回解析后的 JSON；网络层错误抛 Error（message 可直接展示） */
async function wxApiGet(pathname, params) {
    const timeout = env.getNumber('WX_API_TIMEOUT', 10000);
    let ret;
    try {
        ret = await axios.get(`https://api.weixin.qq.com${pathname}`, {
            params,
            timeout,
            proxy: wxProxyConfig(),
            // 微信接口必须直连国内网关，禁用 KeepAlive 复用避免长连接被中间设备掐断
            headers: { Connection: 'close' },
        });
    } catch (err) {
        throw new Error(describeWxNetworkError(err));
    }
    if (!ret || ret.status !== 200) {
        throw new Error(`微信服务器返回异常状态码 ${ret && ret.status}`);
    }
    const data = ret.data;
    if (typeof data === 'string') {
        try {
            return JSON.parse(data);
        } catch (e) {
            throw new Error('微信服务器返回了无法解析的内容，请稍后重试');
        }
    }
    return data || {};
}

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

    /**
     * 用 wx.login 的 code 换 openid，并签发登录令牌。
     * 返回 { openid, token, expiresIn }，前端把 token 存起来，后续请求带上。
     */
    static async openid(ctx) {
        let req = ctx.request.body;
        if (!req || !req.code) {
            ctx.body = R.error(416);
            return;
        }
        const appId = env.get('WX_APPID', '');
        const appSecret = env.get('WX_APPSECRET', '');
        if (!appId || !appSecret) {
            ctx.body = R.error(412, '服务端未配置小程序 appId/appSecret');
            return;
        }
        try {
            const data = await wxApiGet('/sns/jscode2session', {
                appid: appId,
                secret: appSecret,
                js_code: req.code,
                grant_type: 'authorization_code'
            });
            if (data.errcode) {
                const hint = data.errcode === 40029 || data.errcode === 40163
                    ? '登录凭证已失效，请重新进入小程序'
                    : (data.errmsg || ('微信登录失败(' + data.errcode + ')'));
                ctx.body = R.error(412, hint);
                return;
            }
            const openid = data.openid != null ? String(data.openid).trim() : '';
            if (!openid) {
                ctx.body = R.error(412, '微信未返回 openid');
                return;
            }
            const { token, expiresIn } = signToken(openid);
            ctx.body = R.set({ openid, token, expiresIn }, 200);
        } catch (err) {
            const tip = err && err.message ? err.message : String(err);
            console.error('[users/openid] 换取 openid 失败：', tip);
            ctx.body = R.error(412, tip);
        }
    }

    /** 只能改自己的资料：openId 一律取自登录态，忽略请求体里的 openId */
    static async updata(ctx) {
        let req = ctx.request.body || {};
        const openId = currentOpenId(ctx);
        if (!openId) {
            ctx.body = R.error(401);
            return;
        }
        try {
            const object = await UserModel.detailByOpenId(openId);
            if (object) {
                await UserModel.update(openId, req);
            } else {
                await UserModel.create(Object.assign({}, req, { openId }));
            }
            const obj = await UserModel.detailByOpenId(openId);
            ctx.body = R.set(obj, 200, object ? "更新成功" : "创建成功");
        } catch (err) {
            ctx.body = R.error(412, err);
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
     * multipart：文件字段名 file
     * 头像归谁由登录态决定（忽略表单里的 openId，防止替别人改头像）
     * 保存为 public/avatar/{openId}{扩展名}，同名覆盖；返回不含域名的路径，如 /avatar/xxx.jpg
     */
    static async uploadAvatar(ctx) {
        const openIdRaw = currentOpenId(ctx) || (ctx.req.body && ctx.req.body.openId);
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