// pages/user/info/index.js

const { UPLOAD_AVATAR, UPDATA_USER } = require('../../../request/api')

const LEVEL_OPTIONS = ['萌新', '1级', '2级', '3级', '4级', '5级', '6级', '7级', '8级', '9级', '专业级']

function pickAvatarUrl(result) {
  if (result == null) return ''
  if (typeof result === 'string') return result
  if (typeof result === 'object') {
    return (
      result.url ||
      result.avatar ||
      result.avatarUrl ||
      result.fileUrl ||
      result.path ||
      (result.data && (typeof result.data === 'string' ? result.data : result.data.url)) ||
      ''
    )
  }
  return ''
}

function levelIndexFromBadmintonLevel(levelText, levelOptions) {
  if (levelText == null || levelText === '') return 0
  const s = String(levelText).trim()
  const idx = levelOptions.indexOf(s)
  return idx >= 1 ? idx : 0
}

Page({
  data: {
    pageScrollTop: 0,

    userId: null,
    openId: '',

    avatarUrl: '',
    nickName: '',
    nickTouched: false,

    genderOptions: [
      { id: 0, title: '未知', icon: '' },
      { id: 1, title: '男', icon: '/images/icon/nan.png' },
      { id: 2, title: '女', icon: '/images/icon/nv.png' },
    ],
    /** 0 未知 1 男 2 女 */
    gender: 0,

    levelValue: '',
    levelText: '',
    levelOptions: ['不选择'].concat(LEVEL_OPTIONS),
    levelIndex: 0,

    realName: '',
    phone: '',
  },

  onLoad() {
    this.hydrateFromGlobalUser()
  },

  onShow() {
    this.hydrateFromGlobalUser()
  },

  hydrateFromGlobalUser() {
    const app = getApp()
    const u = (app.globalData && app.globalData.userInfo) || {}
    const join =
      app.fun && typeof app.fun.joinStaticUrl === 'function'
        ? (p) => app.fun.joinStaticUrl(p)
        : (p) => p

    const rawAvatar = u.avatar != null && String(u.avatar).trim() !== '' ? String(u.avatar).trim() : ''
    const avatarUrl = rawAvatar ? join(rawAvatar) : ''

    const g = Number(u.gender)
    const gender = g === 1 || g === 2 ? g : 0

    const levelText =
      u.badmintonLevel != null && String(u.badmintonLevel).trim() !== ''
        ? String(u.badmintonLevel).trim()
        : ''
    const levelOptions = this.data.levelOptions || ['不选择'].concat(LEVEL_OPTIONS)
    const levelIndex = levelText ? levelIndexFromBadmintonLevel(levelText, levelOptions) : 0
    const levelValue = levelIndex > 0 && levelOptions[levelIndex] !== '不选择' ? levelOptions[levelIndex] : ''

    const nickName = u.nickName != null ? String(u.nickName) : ''
    const realName = u.name != null ? String(u.name) : ''
    const phone = u.phone != null ? String(u.phone) : ''

    this.setData({
      userId: u.id != null ? u.id : null,
      openId: (u.openId || u.openid || app.globalData.openid || '').trim(),
      avatarUrl,
      nickName,
      nickTouched: false,
      gender,
      levelIndex,
      levelValue,
      levelText: levelIndex > 0 ? levelText : '',
      realName,
      phone,
    })
  },

  onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st !== this.data.pageScrollTop) {
      this.setData({ pageScrollTop: st })
    }
  },

  onChooseAvatar(e) {
    const localPath = e && e.detail ? e.detail.avatarUrl : ''
    if (!localPath) return
    const app = getApp()
    const openid = (app && app.globalData && app.globalData.openid) || ''
    if (!openid) {
      wx.showToast({ title: '登录未完成，请稍后重试', icon: 'none' })
      return
    }
    const prev = this.data.avatarUrl
    this.setData({ avatarUrl: localPath })
    wx.showLoading({ title: '上传中…', mask: true })
    UPLOAD_AVATAR(localPath, { openId: String(openid) })
      .then((obj) => {
        const serverUrl = pickAvatarUrl(obj)
        if (serverUrl) {
          const display =
            app.fun && typeof app.fun.joinStaticUrl === 'function'
              ? app.fun.joinStaticUrl(serverUrl)
              : serverUrl
          this.setData({ avatarUrl: display })
        } else {
          this.setData({ avatarUrl: prev })
          wx.showToast({ title: '未返回头像地址', icon: 'none' })
        }
      })
      .catch(() => {
        this.setData({ avatarUrl: prev })
      })
      .finally(() => {
        wx.hideLoading()
      })
  },

  onNickInput(e) {
    const v = (e.detail.value || '').slice(0, 20)
    this.setData({ nickName: v, nickTouched: true })
  },

  onNickBlur(e) {
    const v = (e.detail.value || '').slice(0, 20)
    if (!this.data.nickTouched && v) {
      this.setData({ nickName: v })
    }
  },

  onSelectGender(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (id !== 0 && id !== 1 && id !== 2) return
    this.setData({ gender: id })
  },

  onLevelChange(e) {
    const idx = Number(e.detail.value)
    if (!Number.isFinite(idx)) return
    const options = this.data.levelOptions || []
    const t = options[idx] || ''
    if (idx === 0 || t === '不选择') {
      this.setData({ levelIndex: 0, levelValue: '', levelText: '' })
      return
    }
    this.setData({ levelIndex: idx, levelValue: t, levelText: t })
  },

  onRealNameInput(e) {
    const v = (e.detail.value || '').slice(0, 20)
    this.setData({ realName: v })
  },

  onPhoneInput(e) {
    const v = (e.detail.value || '').slice(0, 20)
    this.setData({ phone: v })
  },

  onSave() {
    const app = getApp()
    const openId = (this.data.openId || app.globalData.openid || '').trim()
    if (!openId) {
      wx.showToast({ title: '缺少 openId', icon: 'none' })
      return
    }

    const avatarRaw =
      app.fun && typeof app.fun.stripStaticUrl === 'function'
        ? app.fun.stripStaticUrl(this.data.avatarUrl)
        : this.data.avatarUrl
    const avatarTrim = (avatarRaw || '').trim()
    const avatar = avatarTrim === '' ? null : avatarTrim

    const nickName = (this.data.nickName || '').trim()
    const nameTrim = (this.data.realName || '').trim()
    const phoneTrim = (this.data.phone || '').trim()
    const levelTrim = (this.data.levelValue || '').trim()

    const prev = app.globalData.userInfo || {}
    const payload = {
      id: this.data.userId != null ? this.data.userId : prev.id,
      openId,
      nickName: nickName || null,
      avatar,
      gender: this.data.gender,
      badmintonLevel: levelTrim === '' ? null : levelTrim,
      name: nameTrim === '' ? null : nameTrim,
      phone: phoneTrim === '' ? null : phoneTrim
    }

    wx.showLoading({ title: '保存中…', mask: true })
    UPDATA_USER(payload)
      .then((obj) => {
        const merged =
          obj && typeof obj === 'object'
            ? Object.assign({}, prev, obj)
            : Object.assign({}, prev, {
                nickName: nickName || prev.nickName,
                avatar: avatar != null ? avatar : prev.avatar,
                gender: this.data.gender,
                badmintonLevel: payload.badmintonLevel,
                name: payload.name,
                phone: payload.phone,
              })
        app.globalData.userInfo = merged
        wx.showToast({ title: '已保存', icon: 'success' })
        this.hydrateFromGlobalUser()
        wx.navigateBack()
      })
      .catch(() => {})
      .finally(() => {
        wx.hideLoading()
      })
  }
})
