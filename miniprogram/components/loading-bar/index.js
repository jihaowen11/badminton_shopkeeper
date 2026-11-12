const bus = require('../../utils/requestBus')

/** 请求超过这个时长才显示进度条，避免一闪而过的抖动 */
const SHOW_DELAY_MS = 250

Component({
  data: {
    visible: false,
  },

  lifetimes: {
    attached() {
      this._timer = null
      this._unsub = bus.subscribe((pending) => {
        if (pending > 0) {
          if (this._timer || this.data.visible) return
          this._timer = setTimeout(() => {
            this._timer = null
            this.setData({ visible: true })
          }, SHOW_DELAY_MS)
          return
        }
        if (this._timer) {
          clearTimeout(this._timer)
          this._timer = null
        }
        if (this.data.visible) this.setData({ visible: false })
      })
    },
    detached() {
      if (this._timer) {
        clearTimeout(this._timer)
        this._timer = null
      }
      if (typeof this._unsub === 'function') {
        this._unsub()
        this._unsub = null
      }
    },
  },
})
