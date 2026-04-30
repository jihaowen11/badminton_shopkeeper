// pages/scoreboard/index.js

const STORAGE_KEY = 'scoreboard_records'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function nowText() {
  const d = new Date()
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function safeReadRecords() {
  try {
    const list = wx.getStorageSync(STORAGE_KEY)
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

function safeWriteRecords(list) {
  try {
    wx.setStorageSync(STORAGE_KEY, list)
  } catch (e) {}
}

Page({
  data: {
    pageScrollTop: 0,

    gameNo: 1,
    matchType: 'single', // single | double
    rule: 21, // 21 | 11

    scoreLeft: 0,
    scoreRight: 0,
    serverSide: 'left', // left | right

    scoreAnimLeft: false,
    scoreAnimRight: false,

    records: [],
  },

  onLoad() {
    this.refreshTexts()
    this.loadRecords()
  },

  onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st !== this.data.pageScrollTop) {
      this.setData({ pageScrollTop: st })
    }
  },

  refreshTexts() {
    this.setData({
      matchTypeText: this.data.matchType === 'double' ? '双打' : '单打',
      ruleText: `${this.data.rule}分制`,
    })
  },

  loadRecords() {
    const records = safeReadRecords().slice(0, 5)
    this.setData({ records })
  },

  pulse(side) {
    const key = side === 'right' ? 'scoreAnimRight' : 'scoreAnimLeft'
    this.setData({ [key]: false })
    setTimeout(() => {
      this.setData({ [key]: true })
      setTimeout(() => this.setData({ [key]: false }), 180)
    }, 10)
  },

  onAddPoint(e) {
    const side = e.currentTarget.dataset.side
    if (side !== 'left' && side !== 'right') return
    if (side === 'left') {
      this.setData({ scoreLeft: this.data.scoreLeft + 1, serverSide: 'left' })
      this.pulse('left')
    } else {
      this.setData({ scoreRight: this.data.scoreRight + 1, serverSide: 'right' })
      this.pulse('right')
    }
  },

  onUndo(e) {
    const side = e.currentTarget.dataset.side
    if (side !== 'left' && side !== 'right') return
    if (side === 'left') {
      if (this.data.scoreLeft <= 0) return
      this.setData({ scoreLeft: this.data.scoreLeft - 1 })
      this.pulse('left')
    } else {
      if (this.data.scoreRight <= 0) return
      this.setData({ scoreRight: this.data.scoreRight - 1 })
      this.pulse('right')
    }
  },

  onSwapSides() {
    const nextServer = this.data.serverSide === 'left' ? 'right' : 'left'
    this.setData({
      scoreLeft: this.data.scoreRight,
      scoreRight: this.data.scoreLeft,
      serverSide: nextServer,
    })
    this.pulse('left')
    this.pulse('right')
  },

  buildRecord() {
    const md = `第${this.data.gameNo}局`
    const matchTypeText = this.data.matchType === 'double' ? '双打' : '单打'
    const ruleText = `${this.data.rule}分制`
    return {
      id: `${Date.now()}`,
      title: `${md} · ${matchTypeText}`,
      timeText: nowText(),
      matchType: this.data.matchType,
      matchTypeText,
      rule: this.data.rule,
      ruleText,
      scoreLeft: this.data.scoreLeft,
      scoreRight: this.data.scoreRight,
    }
  },

  saveRecordIfNeeded() {
    if (this.data.scoreLeft === 0 && this.data.scoreRight === 0) return
    const next = [this.buildRecord()].concat(safeReadRecords())
    const dedup = []
    const seen = new Set()
    for (const r of next) {
      if (!r || !r.id || seen.has(r.id)) continue
      seen.add(r.id)
      dedup.push(r)
      if (dedup.length >= 5) break
    }
    safeWriteRecords(dedup)
    this.setData({ records: dedup })
  },

  onReset() {
    if (this.data.scoreLeft === 0 && this.data.scoreRight === 0) {
      this.setData({ serverSide: 'left' })
      return
    }
    wx.showModal({
      title: '重置计分',
      content: '是否保存当前对局到记录并重置？',
      confirmText: '保存并重置',
      cancelText: '直接重置',
      success: (res) => {
        if (res.confirm) {
          this.saveRecordIfNeeded()
          this.setData({ gameNo: this.data.gameNo + 1 })
        }
        this.setData({
          scoreLeft: 0,
          scoreRight: 0,
          serverSide: 'left',
        })
      },
    })
  },

  onToggleType() {
    const next = this.data.matchType === 'double' ? 'single' : 'double'
    this.setData({ matchType: next })
    this.refreshTexts()
  },

  onToggleRule() {
    const next = this.data.rule === 21 ? 11 : 21
    this.setData({ rule: next })
    this.refreshTexts()
  },

  onClearRecords() {
    wx.showModal({
      title: '清空记录',
      content: '确定清空最近记录吗？',
      success: (res) => {
        if (!res.confirm) return
        safeWriteRecords([])
        this.setData({ records: [] })
      },
    })
  },

  onShareAppMessage() {
    return { title: '计分器', path: '/pages/scoreboard/index' }
  },
})