/**
 * 环境配置
 *
 * 改后端地址只改这里，不要把地址散落到各个页面。
 * 注意：真机调试与上线必须使用 https，且域名要加入小程序后台的
 * request 合法域名 / uploadFile 合法域名白名单。
 */
const ENV = 'dev' // dev | prod

const PROFILES = {
  dev: {
    serverUrl: 'http://192.168.80.107:3000',
    staticUrl: 'http://192.168.80.107:3000',
    code: 'v0.9',
  },
  prod: {
    // TODO: 换成正式域名（需备案 + https）
    serverUrl: 'https://api.example.com',
    staticUrl: 'https://api.example.com',
    code: 'v0.9',
  },
}

module.exports = Object.assign({ env: ENV }, PROFILES[ENV] || PROFILES.dev)
