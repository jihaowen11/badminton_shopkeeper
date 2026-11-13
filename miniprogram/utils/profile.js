/**
 * 个人资料完整度 + 操作闸门
 *
 * 判定规则（与后端默认值对齐，两边只认这一份）：
 * - 头像：空值视为未设置（未上传时 users.avatar 为 null）
 * - 昵称：注册时后端自动生成 "羽球人_XXXXXX"（controllers/users.js:190），
 *         仍是这个默认格式就视为未设置
 * - **任一项完善即算完成**，两项都是默认值才算未完善
 *
 * 数据来源只认 app.globalData.userInfo（登录时由 /users/find 拉回），
 * 不在本地缓存判断结果——用户改完资料后 globalData 会被更新，重新判断即可。
 */

/**
 * 默认昵称形如 "羽球人_aB3xK9"：后端 controllers/users.js 用
 * randomUsername('羽球人_', 6) 生成，前缀 + 最多 6 位字母数字。
 * 这里把 0~6 位都算作默认值——空壳（"羽球人_"）、生成失败留下的残值都该让用户重填；
 * 用户自己改过的昵称即使也以"羽球人_"开头，多带中文或超过 6 位就不会命中，
 * 宁可少拦也不少提示。
 */
const NICK_DEFAULT_RE = /^羽球人_?[A-Za-z0-9]{0,6}$/

function toText(v) {
  return v == null ? '' : String(v).trim()
}

/** 昵称是否仍是后端生成的默认值 */
function isDefaultNickName(nickName) {
  const n = toText(nickName)
  if (!n) return true
  return NICK_DEFAULT_RE.test(n)
}

/** 是否已上传头像；小程序内置占位图不算 */
function hasAvatar(user) {
  const a = toText(user && user.avatar)
  if (!a) return false
  if (a.indexOf('/images/') === 0) return false
  return true
}

/** 当前登录用户；登录未完成时返回 null */
function getCurrentUser() {
  try {
    const app = getApp()
    const u = app && app.globalData && app.globalData.userInfo
    if (u && typeof u === 'object' && Object.keys(u).length > 0) return u
  } catch (e) {}
  return null
}

/**
 * @param {object|null} user 不传则取 globalData.userInfo
 * @returns {{known: boolean, complete: boolean, avatarOk: boolean, nickOk: boolean, missing: string[], missingText: string}}
 *  known=false 表示还拿不到用户（登录中或登录失败），此时不应提示
 */
function checkProfile(user) {
  const u = arguments.length > 0 ? user : getCurrentUser()
  if (!u || typeof u !== 'object') {
    return { known: false, complete: false, avatarOk: false, nickOk: false, missing: [], missingText: '' }
  }
  const avatarOk = hasAvatar(u)
  const nickOk = !isDefaultNickName(u.nickName)
  const complete = avatarOk || nickOk
  const missing = complete ? [] : ['头像', '昵称']
  return {
    known: true,
    complete,
    avatarOk,
    nickOk,
    missing,
    missingText: missing.join('和'),
  }
}

/** 只要布尔值的场合用它 */
function isProfileComplete(user) {
  return checkProfile(user).complete
}

/**
 * 操作闸门：创建比赛 / 建俱乐部 / 报名 / 加俱乐部这类"会留下身份痕迹"的动作
 * 要求资料已完善，未完善时弹强提示并把用户引到资料页。
 *
 * @param {string} actionText 动作名，用来说文案，如"创建比赛"
 * @param {object} [opts] { title, content, confirmText, onNeed }
 *        onNeed：用户点「去完善」时回调，页面可借此记下"待续动作"，
 *        等用户从资料页回来自动把原操作继续做完。
 * @returns {boolean} true = 允许继续；false = 已拦截（已弹窗）
 *
 * 拿不到用户信息时放行：登录慢不该把正常操作堵死，后端仍会按令牌校验身份。
 */
function requireProfile(actionText, opts) {
  const o = opts && typeof opts === 'object' ? opts : {}
  const res = checkProfile(getCurrentUser())
  if (!res.known || res.complete) return true

  wx.showModal({
    title: o.title || '先完善资料',
    content:
      o.content ||
      `完善头像或昵称（填一个就行）后再${actionText || '继续'}，球友才认得出你。`,
    confirmText: o.confirmText || '去完善',
    cancelText: '取消',
    confirmColor: '#0a8f3e',
    success: (r) => {
      if (!r || !r.confirm) return
      if (typeof o.onNeed === 'function') {
        try {
          o.onNeed()
        } catch (e) {}
      }
      wx.navigateTo({ url: '/pages/user/info/index' })
    },
  })
  return false
}

module.exports = {
  NICK_DEFAULT_RE,
  getCurrentUser,
  isDefaultNickName,
  hasAvatar,
  checkProfile,
  isProfileComplete,
  requireProfile,
}
