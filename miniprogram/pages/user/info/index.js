// pages/user/info/index.js

const LEVEL_OPTIONS = ['萌新', '1级', '2级', '3级', '4级', '5级', '6级', '7级', '8级', '9级', '专业级']

Page({
  data: {
    pageScrollTop: 0,

    avatarUrl: '',
    nickName: '',
    nickTouched: false,

    genderOptions: [
      { id: 'male', title: '男', icon: '/images/icon/nan.png' },
      { id: 'female', title: '女', icon: '/images/icon/nv.png' },
    ],
    gender: 'unknown',

    levelValue: '',
    levelText: '',
    levelOptions: ['不选择'].concat(LEVEL_OPTIONS),
    levelIndex: 0,

    realName: '',
    phone: '',
  },

  onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st !== this.data.pageScrollTop) {
      this.setData({ pageScrollTop: st })
    }
  },

  onChooseAvatar(e) {
    const url = e && e.detail ? e.detail.avatarUrl : ''
    if (!url) return
    this.setData({ avatarUrl: url })
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
    const id = e.currentTarget.dataset.id
    if (!id) return
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
    const payload = {
      avatarUrl: this.data.avatarUrl,
      nickName: (this.data.nickName || '').trim(),
      gender: this.data.gender,
      level: this.data.levelValue,
      realName: (this.data.realName || '').trim(),
      phone: (this.data.phone || '').trim(),
    }
    console.log('[userInfo.save]', payload)
    wx.showToast({ title: '已打印到控制台', icon: 'none' })
  },

  onShareAppMessage() {
    return { title: '个人信息', path: '/pages/user/info/index' }
  },
})