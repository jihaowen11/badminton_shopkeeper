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
    set(object, code = "0", message) {
        code = code.toString()
        if (this.StatusCode.has(code)) {
            return {
                code,
                object,
                message: message || this.StatusCode.get(code),
            }
        } else {
            // log Something ,here is an unique code
            return {
                code,
                object,
                message: message || "Unresolvable Status Code :" + code,
            }
        }
    }
    error(code = "-1", message) {
        code = code.toString()
        if (this.StatusCode.has(code)) {
            return {
                code,
                object: {},
                message: message || this.StatusCode.get(code),
            }
        } else {
            // log Something ,here is an unique code
            return {
                code,
                object: {},
                message: message || "Unresolvable Status Code :" + code,
            }
        }
    }
}();

//registe Status Code 

responseBeautifier.registeStatusCodes([
    ["-1", "未知错误"],
    ["404", "NtFound"],
    ["200", "成功"],
    ["412", "失败"],
    ["416", "参数不齐全"],
])


module.exports = responseBeautifier;