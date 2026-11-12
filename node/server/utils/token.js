/**
 * 轻量登录令牌（HMAC-SHA256 签名，结构类似 JWT，不引入额外依赖）
 *
 * token = base64url(payload) + '.' + base64url(signature)
 * payload = { openId, iat, exp }
 *
 * 之所以不直接用 jsonwebtoken：本项目没有装这个包，离线环境装依赖风险更大。
 * 签名算法与校验逻辑已足够（防篡改 + 过期控制），后续要换标准 JWT 只需替换本文件。
 */
const crypto = require('crypto');
const env = require('../config/env');

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 16;

let cachedSecret = '';

function getSecret() {
    if (cachedSecret) return cachedSecret;
    const secret = env.get('JWT_SECRET', '');
    if (!secret) {
        throw new Error('缺少 JWT_SECRET：请在 node/server/.env 中配置（可参考 .env.example）');
    }
    if (secret.length < MIN_SECRET_LENGTH) {
        throw new Error(`JWT_SECRET 过短（至少 ${MIN_SECRET_LENGTH} 位），请换成长随机串`);
    }
    cachedSecret = secret;
    return cachedSecret;
}

function base64UrlEncode(input) {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input) {
    const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + pad, 'base64');
}

function hmac(data) {
    return crypto.createHmac('sha256', getSecret()).update(data).digest();
}

function getTtlSeconds() {
    const raw = Number(env.get('JWT_EXPIRES_IN', DEFAULT_TTL_SECONDS));
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_TTL_SECONDS;
}

/**
 * 签发令牌
 * @param {string} openId 微信 openId
 * @returns {{token: string, expiresIn: number}}
 */
function signToken(openId) {
    const oid = openId != null ? String(openId).trim() : '';
    if (!oid) throw new Error('签发令牌需要 openId');

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = getTtlSeconds();
    const payload = { openId: oid, iat: now, exp: now + expiresIn };

    const body = base64UrlEncode(JSON.stringify(payload));
    const signature = base64UrlEncode(hmac(body));
    return { token: `${body}.${signature}`, expiresIn };
}

/** 去掉可能存在的 "Bearer " 前缀 */
function normalizeToken(token) {
    const raw = token != null ? String(token).trim() : '';
    if (!raw) return '';
    return /^bearer\s+/i.test(raw) ? raw.replace(/^bearer\s+/i, '').trim() : raw;
}

/**
 * 校验令牌
 * @returns {{openId: string, iat: number, exp: number}|null} 非法或过期返回 null
 */
function verifyToken(token) {
    const raw = normalizeToken(token);
    if (!raw) return null;

    const parts = raw.split('.');
    if (parts.length !== 2) return null;

    const [body, signature] = parts;
    if (!body || !signature) return null;

    let expected;
    try {
        expected = hmac(body);
    } catch (e) {
        // 密钥缺失等配置问题，当作未登录处理，避免把 500 抛给客户端
        console.error('[token] 校验失败：', e && e.message ? e.message : e);
        return null;
    }

    const actual = base64UrlDecode(signature);
    if (actual.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(actual, expected)) return null;

    let payload;
    try {
        payload = JSON.parse(base64UrlDecode(body).toString('utf8'));
    } catch (e) {
        return null;
    }
    if (!payload || !payload.openId) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > Number(payload.exp)) return null;

    return {
        openId: String(payload.openId),
        iat: Number(payload.iat) || 0,
        exp: Number(payload.exp) || 0,
    };
}

module.exports = {
    signToken,
    verifyToken,
    normalizeToken,
    getSecret,
};
