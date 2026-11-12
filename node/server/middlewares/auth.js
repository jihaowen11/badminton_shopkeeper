/**
 * 登录态中间件
 *
 * 作用：把"你是谁"从请求体挪到服务端。校验 Authorization 头里的令牌，
 * 通过后写入 ctx.state.openId，业务层一律读这个值，不再相信 body 里的 openId。
 *
 * 读接口（POST /xxx/list、/xxx/detail）本身也走这里，方便业务层按当前用户过滤数据。
 */
const R = require('../utils/responseBeautifier');
const { verifyToken } = require('../utils/token');

/** 无需登录即可访问的路径（登录接口本身 + 首页） */
const PUBLIC_PATHS = new Set(['/', '/users/openid', '/users/findUserByOpenid']);

/** 需要身份的业务前缀 */
const PROTECTED_PREFIXES = [
    '/users',
    '/clubs',
    '/clubMembers',
    '/matches',
    '/matchParticipants',
    '/matchScores',
    '/matchRounds',
];

function isProtected(ctx) {
    if (ctx.method !== 'POST') return false;
    const path = ctx.path;
    if (PUBLIC_PATHS.has(path)) return false;
    return PROTECTED_PREFIXES.some(
        (prefix) => path === prefix || path.indexOf(prefix + '/') === 0
    );
}

function pickToken(ctx) {
    const header = ctx.headers && ctx.headers.authorization;
    const fromHeader = header != null ? String(header).trim() : '';
    if (fromHeader) return fromHeader;
    // 兼容小程序 wx.uploadFile 等场景下把 token 放进 body 的历史写法
    const body = ctx.request && ctx.request.body;
    if (body && typeof body === 'object' && body.token) return String(body.token).trim();
    return '';
}

module.exports = function authMiddleware() {
    return async (ctx, next) => {
        ctx.state.openId = '';

        const payload = verifyToken(pickToken(ctx));
        if (payload) ctx.state.openId = payload.openId;

        if (isProtected(ctx) && !ctx.state.openId) {
            ctx.body = R.error(401, '登录已失效，请重新进入小程序');
            return;
        }

        await next();
    };
};

module.exports.PUBLIC_PATHS = PUBLIC_PATHS;
module.exports.PROTECTED_PREFIXES = PROTECTED_PREFIXES;
