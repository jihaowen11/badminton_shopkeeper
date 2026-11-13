/**
 * 资料完善轻提示（持续提示）
 *
 * 一条浮在底部的小横条，不遮挡、不弹窗、不拦操作：
 * - 只在「已登录 + 头像和昵称都还是默认值」时出现
 * - 每次页面显示都会重新判断，关掉之后切页面仍会再出现
 * - 同一页面内关掉就收起，6 秒也会自动收起
 * - 点横条去资料页，填好头像或昵称任意一项后，回来就不再出现
 */

const { whenLoginReady } = require('../../utils/auth')
const { getCurrentUser, checkProfile } = require('../../utils/profile')

/** 等首屏渲染完再出现，避免和入场动画抢注意力 */
const SHOW_DELAY_MS = 900
/** 自动收起时长 */
const AUTO_HIDE_MS = 6000

function appSafe() {
  try {
    return getApp() || null
  } catch (e) {
    return null
  }
}

Component({
  properties: {
    /** 距屏幕底部距离（rpx）。页面有固定底栏时调大，避免压在按钮上 */
    bottom: {
      type: Number,
      value: 200,
    },
  },

  data: {
    visible: false,
    descText: '',
  },

  lifetimes: {
    attached() {
      this._pendingTimer = null
      this._autoHideTimer = null
      this._destroyed = false
      this._pageHidden = false
      this._check()
    },
    detached() {
      this._destroyed = true
      this._clearTimers()
    },
  },

  pageLifetimes: {
    show() {
      // 每次回到页面都重新判断：关掉后切页面仍会再提示
      this._pageHidden = false
      if (this.data.visible) return
      this._check()
    },
    hide() {
      this._pageHidden = true
      this._clearTimers()
      if (this.data.visible) this.setData({ visible: false })
    },
  },

  methods: {
    _clearTimers() {
      if (this._pendingTimer) {
        clearTimeout(this._pendingTimer)
        this._pendingTimer = null
      }
      if (this._autoHideTimer) {
        clearTimeout(this._autoHideTimer)
        this._autoHideTimer = null
      }
    },

    /** 正在等待或已显示时都不重复触发 */
    _check() {
      if (this._pendingTimer) return
      if (this.data.visible) return
      if (this._destroyed) return

      this._pendingTimer = setTimeout(() => {
        this._pendingTimer = null
        whenLoginReady()
          .then(() => {
            // 等待期间已卸载或已切后台：放弃这次提示，不碰 setData
            if (this._destroyed || this._pageHidden) return
            const res = checkProfile(getCurrentUser())
            // 登录没完成或资料已完善：安静退出，不打扰
            if (!res.known || res.complete) return
            this.setData({
              visible: true,
              descText: `${res.missingText}还是默认的，填一个就行`,
            })
            this._autoHideTimer = setTimeout(() => {
              this._autoHideTimer = null
              if (this._destroyed) return
              this.setData({ visible: false })
            }, AUTO_HIDE_MS)
          })
          .catch(() => {})
      }, SHOW_DELAY_MS)
    },

    onTap() {
      this._clearTimers()
      this.setData({ visible: false })
      wx.navigateTo({ url: '/pages/user/info/index' })
    },

    /** 只收起当前这次；下次页面显示会按需再出现 */
    onClose() {
      this._clearTimers()
      this.setData({ visible: false })
    },
  },
})
