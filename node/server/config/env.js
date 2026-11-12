/**
 * 极简 .env 加载器（无第三方依赖）
 *
 * 优先级：process.env（真实环境变量） > .env 文件 > 代码里的默认值
 * 这样本地开发只需复制 .env.example 为 .env，线上用真实环境变量覆盖即可。
 */
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');

function parseEnvContent(content) {
    const result = {};
    String(content || '')
        .split(/\r?\n/)
        .forEach((rawLine) => {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) return;
            const eq = line.indexOf('=');
            if (eq <= 0) return;
            const key = line.slice(0, eq).trim();
            let value = line.slice(eq + 1).trim();
            const quoted =
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"));
            if (quoted && value.length >= 2) value = value.slice(1, -1);
            if (key) result[key] = value;
        });
    return result;
}

function loadEnvFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return {};
        return parseEnvContent(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error('[env] 读取 .env 失败：', e && e.message ? e.message : e);
        return {};
    }
}

const fileVars = loadEnvFile(ENV_FILE);

function get(key, fallback) {
    const fromProcess = process.env[key];
    if (fromProcess !== undefined && fromProcess !== '') return fromProcess;
    const fromFile = fileVars[key];
    if (fromFile !== undefined && fromFile !== '') return fromFile;
    return fallback;
}

function getNumber(key, fallback) {
    const raw = get(key, undefined);
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}

function isProduction() {
    return String(get('NODE_ENV', 'development')).toLowerCase() === 'production';
}

const env = {
    get,
    getNumber,
    isProduction,
    /** 对外可访问的服务地址，用于拼接头像等静态资源 */
    publicBaseUrl: () => String(get('PUBLIC_BASE_URL', '')).replace(/\/+$/, ''),
};

module.exports = env;
module.exports.parseEnvContent = parseEnvContent;
