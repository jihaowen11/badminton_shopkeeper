/**
 * 静态资源地址工具
 *
 * 服务端只存相对路径（/avatar/xxx.jpg），展示时统一拼上 globalData.staticUrl。
 * 真正的拼接规则仍在 app.js 的 fun.joinStaticUrl 里（保证只有一个实现），
 * 这里只负责“拿不到 app 时别抛错”这层防御——原先这段 try/catch 在 8 个页面里各写一遍。
 */

/** 无头像时的占位图 */
const DEFAULT_AVATAR = '/images/noheader.jpg'

/** 相对路径 → 可访问地址；已是完整地址或本地图片则原样返回 */
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

/** 头像专用：空值回落到占位图，避免 wxml 里写 `|| DEFAULT_AVATAR` */
function toAvatarUrl(rawPath) {
  return toStaticUrl(rawPath) || DEFAULT_AVATAR
}

/** 提交前反向剥离 staticUrl 前缀，与 toStaticUrl 对称 */
function stripStaticUrl(fullOrRelative) {
  const p = fullOrRelative == null ? '' : String(fullOrRelative).trim()
  if (!p) return ''
  try {
    const app = getApp()
    if (app && app.fun && typeof app.fun.stripStaticUrl === 'function') {
      return app.fun.stripStaticUrl(p)
    }
  } catch (e) {}
  return p
}

module.exports = {
  DEFAULT_AVATAR,
  toStaticUrl,
  toAvatarUrl,
  stripStaticUrl,
}
