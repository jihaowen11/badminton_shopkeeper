// pages/club/create/index.js

const { CREATE_CLUB } = require('../../../request/api')

Page({
  data: {
    membersScrollTop: 0,
    clubName: '',
    nameLen: 0,
    nameMax: 10,
    intro: '',
    introLen: 0,
    introMax: 100,
    clubTypes: [
      { id: 'leisure', title: '休闲娱乐', desc: '轻松打球，享受运动' },
      { id: 'competitive', title: '竞技对抗', desc: '追求胜负，提升技术' },
      { id: 'training', title: '技术训练', desc: '专注练习，系统提升' },
      { id: 'social', title: '社交交友', desc: '结识球友，扩展圈子' },
    ],
    selectedTypeIndex: 0,
    locationText: '',
    locationInputVisible: false,
    tempLocation: '',
  },

  onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st !== this.data.membersScrollTop) {
      this.setData({ membersScrollTop: st })
    }
  },

  onNameInput(e) {
    const v = (e.detail.value || '').slice(0, this.data.nameMax)
    this.setData({ clubName: v, nameLen: v.length })
  },

  onIntroInput(e) {
    const v = (e.detail.value || '').slice(0, this.data.introMax)
    this.setData({ intro: v, introLen: v.length })
  },

  onSelectType(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return
    this.setData({ selectedTypeIndex: index })
  },

  onTapLocation() {
    wx.showActionSheet({
      itemList: ['地图选点', '手动输入'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.chooseLocation({
            success: (loc) => {
              const parts = [loc.name, loc.address].filter(Boolean)
              const text = parts.join(' · ') || '已选位置'
              this.setData({ locationText: text })
            },
            fail: (err) => {
              if (err.errMsg && err.errMsg.indexOf('cancel') !== -1) return
              wx.showToast({ title: '需要位置权限才能选点', icon: 'none' })
            },
          })
        } else if (res.tapIndex === 1) {
          this.setData({
            locationInputVisible: true,
            tempLocation: this.data.locationText || '',
          })
        }
      },
    })
  },

  onCloseLocationInput() {
    this.setData({ locationInputVisible: false })
  },

  onTempLocationInput(e) {
    this.setData({ tempLocation: e.detail.value || '' })
  },

  onConfirmLocationInput() {
    const t = (this.data.tempLocation || '').trim()
    if (!t) {
      wx.showToast({ title: '请输入地点', icon: 'none' })
      return
    }
    this.setData({ locationText: t, locationInputVisible: false })
  },

  noop() {},

  onCreateClub() {
    const name = (this.data.clubName || '').trim()
    const intro = (this.data.intro || '').trim()
    const residence = (this.data.locationText || '').trim()
    const typeIndex = this.data.selectedTypeIndex
    const typeItem = typeIndex >= 0 ? this.data.clubTypes[typeIndex] : null

    if (!name) {
      wx.showToast({ title: '请填写俱乐部名称', icon: 'none' })
      return
    }
    if (!typeItem) {
      wx.showToast({ title: '请选择俱乐部类型', icon: 'none' })
      return
    }
    if (!residence) {
      wx.showToast({ title: '请填写常驻地', icon: 'none' })
      return
    }

    const app = getApp()
    const creator = (app.globalData && app.globalData.openid) || ''
    if (!creator) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const payload = {
      name,
      type: typeItem.title,
      residence,
      intro: intro === '' ? null : intro,
      joinMethod: '邀请制',
      creator,
    }

    wx.showLoading({ title: '创建中…', mask: true })
    CREATE_CLUB(payload)
      .then(() => {
        wx.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack({ delta: 1 })
        }, 600)
      })
      .catch(() => {})
      .finally(() => {
        wx.hideLoading()
      })
  },
})
