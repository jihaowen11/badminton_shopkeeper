// components/tabBar.js
Component({
  /**
   * 组件的初始数据
   */
  data: {
    current: 'home',
    menuVisible: false,
    menuOpen: false,
    actionAnimating: '',
  },

  /**
   * 组件的方法列表
   */
  methods: {
    onTapItem(e) {
      const key = e.currentTarget?.dataset?.key
      if (!key) return
      const urlMap = {
        home: '/pages/index/index',
        mine: '/pages/mine/index',
      }
      const url = urlMap[key]
      if (!url) return
      if (key === this.data.current) return
      wx.switchTab({ url })
      this.setData({
        current: key
      })
    },

    onTapFab() {
      if (this.data.menuOpen) {
        this.closeMenu()
        return
      }

      this.setData({ menuVisible: true }, () => {
        // 让 transition 生效
        setTimeout(() => {
          this.setData({ menuOpen: true })
        }, 16)
      })
    },

    onTapMask() {
      this.closeMenu()
    },

    closeMenu() {
      if (!this.data.menuVisible) return
      this.setData({ menuOpen: false })
      setTimeout(() => {
        this.setData({ menuVisible: false, actionAnimating: '' })
      }, 240)
    },

    onTapMenuAction(e) {
      const action = e.currentTarget?.dataset?.action
      if (!action) return

      this.setData({ actionAnimating: action })

      setTimeout(() => {
        this.closeMenu()
        if (action === 'match') {
          wx.navigateTo({ url: '/pages/match/create/index' })
        } else if (action === 'club') {
          wx.navigateTo({url:'/pages/club/create/index'})
        }
      }, 260)
    },
  }
})