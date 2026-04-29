function readWindowMetrics() {
  let statusBarHeight = 44
  try {
    if (typeof wx.getWindowInfo === 'function') {
      const win = wx.getWindowInfo()
      statusBarHeight = win.statusBarHeight ?? 44
    } else {
      const sys = wx.getSystemInfoSync()
      statusBarHeight = sys.statusBarHeight ?? 44
    }
  } catch (e) {
    try {
      statusBarHeight = wx.getSystemInfoSync().statusBarHeight ?? 44
    } catch (e2) {}
  }
  return { statusBarHeight }
}

Component({
  options: {
    addGlobalClass: true,
  },
  externalClasses: ['ext-class'],
  data: {
    marginTopPx: 0,
    computedMaskVisible: false,
  },
  properties: {
    /** 为 true 时不叠加状态栏高度（父级已 padding-top 安全区） */
    embed: {
      type: Boolean,
      value: false,
    },
    /** 图标颜色 */
    iconColor: {
      type: String,
      value: '#0a8f3e',
    },
    /** 传给 van-icon 的 size，如 44rpx、20px */
    iconSize: {
      type: String,
      value: '44rpx',
    },
    /** default | glass（绿底导航上的半透明样式） */
    variant: {
      type: String,
      value: 'default',
    },
    /** 滚动超过阈值时展示蒙版层 */
    maskVisible: {
      type: Boolean,
      value: false,
    },
    /** 是否启用“滚动阈值显示蒙版” */
    useScrollMask: {
      type: Boolean,
      value: true,
    },
    /** 由父级传入 scroll-view 的 scrollTop(px) */
    scrollTop: {
      type: Number,
      value: 0,
    },
    /** 显示阈值(px)，当 scrollTop > 该值时展示蒙版 */
    maskThreshold: {
      type: Number,
      value: 10,
    },
    delta: {
      type: Number,
      value: 1,
    },
    fallbackUrl: {
      type: String,
      value: '/pages/index/index',
    },
  },
  observers: {
    embed() {
      this.applyMarginTop()
    },
    useScrollMask() {
      this.syncMaskVisible()
    },
    scrollTop() {
      this.syncMaskVisible()
    },
    maskThreshold() {
      this.syncMaskVisible()
    },
    maskVisible() {
      this.syncMaskVisible()
    },
  },
  lifetimes: {
    attached() {
      this.applyMarginTop()
      this.syncMaskVisible()
    },
  },
  methods: {
    applyMarginTop() {
      const { statusBarHeight } = readWindowMetrics()
      const embed = this.properties.embed
      this.setData({
        marginTopPx: embed ? 0 : statusBarHeight,
      })
    },
    onTap() {
      const delta = this.properties.delta
      wx.navigateBack({
        delta,
        fail: () => {
          const url = this.properties.fallbackUrl
          if (url) {
            wx.switchTab({
              url,
              fail: () => {
                wx.reLaunch({ url })
              },
            })
          }
        },
      })
    },

    syncMaskVisible() {
      const useScrollMask = this.properties.useScrollMask
      let next = !!this.properties.maskVisible
      if (useScrollMask) {
        const st = typeof this.properties.scrollTop === 'number' ? this.properties.scrollTop : 0
        const th = typeof this.properties.maskThreshold === 'number' ? this.properties.maskThreshold : 10
        next = st > th
      }
      this.setData({
        computedMaskVisible: next,
      })
    },
  },
})
