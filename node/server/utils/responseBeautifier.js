/**
 * 统一响应结构 { code, object, message }
 *
 * 注意：message 一定要是字符串。历史代码里大量出现 R.error(412, err)，
 * 直接把 Error 对象传进来，JSON 序列化后前端拿到的是 {}，用户只会看到空白提示。
 * 这里统一做一次安全转换，避免逐处修改调用方。
 */
const FALLBACK_MESSAGE = '服务器开小差了，请稍后重试';

function toMessage(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Error) {
        return (value.message || '').trim() || value.name || '';
    }
    if (typeof value === 'object') {
        const msg = value.message != null ? String(value.message).trim() : '';
        if (msg) return msg;
        if (value.errMsg) return String(value.errMsg);
        try {
            const json = JSON.stringify(value);
            return json === '{}' ? '' : json;
        } catch (e) {
            return '';
        }
    }
    return String(value);
}

let responseBeautifier = new class {
    constructor() {
        this.response = {
            code: "",
            object: {},
            message: ""
        },
            this.StatusCode = new Map();
        this.registeStatusCode("0", "OK");
        this.registeStatusCode("-1", "ERROR");
    }
    registeStatusCode(code, description) {
        this.StatusCode.set(code, description);
    }
    registeStatusCodes(arr) {
        for (let [code, description] of arr) {
            this.StatusCode.set(code, description);
        }
    }
    /** 组装统一响应；set 与 error 只差默认 object 和默认 code */
    respond(object, code, message) {
        const key = String(code);
        const text = toMessage(message);
        const fallback = this.StatusCode.has(key)
            ? this.StatusCode.get(key)
            : "Unresolvable Status Code :" + key;
        return {
            code: key,
            object,
            message: text || fallback,
        };
    }
    set(object, code = "0", message) {
        return this.respond(object, code, message);
    }
    error(code = "-1", message) {
        return this.respond({}, code, message);
    }
}();

//registe Status Code 

responseBeautifier.registeStatusCodes([
    ["-1", "未知错误"],
    ["401", "登录已失效，请重新进入小程序"],
    ["404", "NtFound"],
    ["200", "成功"],
    ["403", "没有操作权限"],
    ["412", "操作失败，请稍后重试"],
    ["416", "参数不齐全"],
])

module.exports = responseBeautifier;
module.exports.toMessage = toMessage;
module.exports.FALLBACK_MESSAGE = FALLBACK_MESSAGE;
