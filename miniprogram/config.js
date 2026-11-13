/**
 * 环境配置
 *
 * 改后端地址只改这里，不要把地址散落到各个页面。
 * 注意：真机调试与上线必须使用 https，且域名要加入小程序后台的
 * request 合法域名 / uploadFile 合法域名白名单。
 */
const ENV = 'prod' // dev | prod

const PROFILES = {
  dev: {
    serverUrl: 'http://192.168.80.107:3000',
    staticUrl: 'http://192.168.80.107:3000',
    code: 'v0.9',
  },
  prod: {
    // 已部署到腾讯云：Nginx 以 /api/badminton 前缀反代到 127.0.0.1:3001
    // 注意这里带路径前缀，而微信后台的 request/uploadFile 合法域名只填 https://esccry.top
    serverUrl: 'https://esccry.top/api/badminton',
    staticUrl: 'https://esccry.top/api/badminton',
    code: 'v0.9',
  },
}

module.exports = Object.assign({ env: ENV }, PROFILES[ENV] || PROFILES.dev)
