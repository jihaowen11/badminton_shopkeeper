/**
 * 登录态辅助
 *
 * 服务端身份以令牌为准，页面只需要在发请求前确保登录已完成，
 * 不再依赖“openId 有没有值 + 定时重试”这种写法。
 */

/** 等登录就绪；拿不到 app 时按已完成处理，避免阻塞页面 */
function whenLoginReady() {
  try {
    const app = getApp()
    if (app && app.loginReady && typeof app.loginReady.then === 'function') {
      return Promise.resolve(app.loginReady).catch(() => null)
    }
  } catch (e) {}
  return Promise.resolve(null)
}

/** 当前登录用户 openId，仅用于界面展示与旧接口兼容 */
function pickOpenId() {
  try {
    const app = getApp()
    const gd = (app && app.globalData) || {}
    const direct = gd.openid && String(gd.openid).trim()
    if (direct) return direct
    const u = gd.userInfo || {}
    const fromUser = u.openId || u.openid || u.openID
    return fromUser ? String(fromUser).trim() : ''
  } catch (e) {
    return ''
  }
}

/** 头像等静态资源转完整地址 */
function toStaticUrl(rawPath) {
  const p = rawPath == null ? '' : String(rawPath).trim()
  if (!p) return ''
  try {
    const app = getApp()
    if (app && app.fun && typeof app.fun.joinStaticUrl === 'function') {
      return app.fun.joinStaticUrl(p)
    }
  } catch (e) {}
  return p
}

module.exports = {
  whenLoginReady,
  pickOpenId,
  toStaticUrl,
}
