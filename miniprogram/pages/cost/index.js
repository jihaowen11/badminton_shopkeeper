// pages/cost/index.js

const { BallSim, sumShuttleQty } = require('./balls.js')

const STORAGE_KEY = 'cost_bill_draft'

function uid() {
  return `l${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

function parseMoney(s) {
  const n = parseFloat(String(s || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function fmtMoney(n) {
  const v = Math.round(n * 100) / 100
  if (Number.isInteger(v)) return String(v)
  const s = v.toFixed(2)
  return s.replace(/\.?0+$/, '')
}

function normalizeLineItems(lines, firstPid) {
  const pid = firstPid || 'p1'
  return (Array.isArray(lines) ? lines : []).map((it) => {
    let qty = Math.floor(Number(it.qty))
    if (!Number.isFinite(qty)) qty = 1
    qty = Math.max(0, qty)
    return {
      id: it.id || uid(),
      type: it.type === 'shuttle' ? 'shuttle' : 'court',
      label: it.label != null ? String(it.label) : it.type === 'shuttle' ? '球费' : '场地费',
      courtAmount: it.courtAmount != null ? String(it.courtAmount) : '',
      unitPrice: it.unitPrice != null ? String(it.unitPrice) : '',
      qty,
      payerId: it.payerId || pid,
    }
  })
}

Page({
  data: {
    pageScrollTop: 0,

    totalText: '0',
    avgText: '0',

    participants: [
      { id: 'p1', name: '球友A', avatar: '/images/noheader.jpg' },
      { id: 'p2', name: '球友B', avatar: '/images/noheader.jpg' },
      { id: 'p3', name: '球友C', avatar: '/images/noheader.jpg' },
      { id: 'p4', name: '球友D', avatar: '/images/noheader.jpg' },
    ],

    lineItems: [
      {
        id: 'line_court_default',
        type: 'court',
        label: '场地费',
        courtAmount: '200',
        unitPrice: '',
        qty: 1,
        payerId: 'p1',
        lineTotal: '200',
        payerAvatar: '/images/noheader.jpg',
      },
      {
        id: 'line_shuttle_default',
        type: 'shuttle',
        label: '球费',
        courtAmount: '',
        unitPrice: '12',
        qty: 5,
        payerId: 'p1',
        lineTotal: '60',
        payerAvatar: '/images/noheader.jpg',
      },
    ],
  },

  onLoad() {
    this._ballSim = new BallSim()
    this._heroW = 0
    this._heroH = 0
    this.loadDraft()
  },

  onReady() {
    this.initCanvasAttempt(0)
  },

  onShow() {
    this._accelHandler = (e) => {
      if (this._ballSim) this._ballSim.setGravityFromAccel(e.x, e.y, e.z)
    }
    this._gyroHandler = (e) => {
      if (this._ballSim) this._ballSim.setGyro(e.x, e.y, e.z)
    }
    wx.startAccelerometer({ interval: 'game' })
    wx.onAccelerometerChange(this._accelHandler)
    if (typeof wx.startGyroscope === 'function') {
      try {
        wx.startGyroscope({ interval: 'game' })
        wx.onGyroscopeChange(this._gyroHandler)
      } catch (e) {}
    }
    if (this._ballSim && this._ballSim.canvas) {
      this._ballSim.start()
    }
  },

  onHide() {
    this.disposeSensors()
    if (this._ballSim) this._ballSim.stop()
  },

  onUnload() {
    this.disposeSensors()
    if (this._ballSim) {
      this._ballSim.stop()
      this._ballSim = null
    }
  },

  disposeSensors() {
    if (this._accelHandler) {
      try {
        wx.stopAccelerometer()
      } catch (e) {}
      wx.offAccelerometerChange(this._accelHandler)
      this._accelHandler = null
    }
    if (this._gyroHandler) {
      try {
        wx.stopGyroscope()
      } catch (e) {}
      wx.offGyroscopeChange(this._gyroHandler)
      this._gyroHandler = null
    }
  },

  initCanvasAttempt(attempt) {
    const sim = this._ballSim
    if (!sim) return
    wx.createSelectorQuery()
      .in(this)
      .select('.hero')
      .boundingClientRect()
      .select('#costBallCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const rect = res[0]
        const nodeRes = res[1]
        if (!rect || !nodeRes || !nodeRes.node || rect.height < 24) {
          if (attempt < 15) {
            setTimeout(() => this.initCanvasAttempt(attempt + 1), 120)
          }
          return
        }
        const dpr = wx.getSystemInfoSync().pixelRatio || 2
        this._heroW = rect.width
        this._heroH = rect.height
        sim.attachCanvas(nodeRes.node, rect.width, rect.height, dpr)
        sim.setCount(sumShuttleQty(this.data.lineItems))
        sim.start()
      })
  },

  syncBallCountAndLayout() {
    const sim = this._ballSim
    if (!sim || !sim.canvas) return
    wx.createSelectorQuery()
      .in(this)
      .select('.hero')
      .boundingClientRect()
      .exec((res) => {
        const rect = res[0]
        if (!rect || rect.width < 20 || rect.height < 20) return
        const dpr = wx.getSystemInfoSync().pixelRatio || 2
        const dw = Math.abs(rect.width - (this._heroW || 0))
        const dh = Math.abs(rect.height - (this._heroH || 0))
        if (dw > 2 || dh > 2) {
          this._heroW = rect.width
          this._heroH = rect.height
          sim.resize(rect.width, rect.height, dpr)
        }
        sim.setCount(sumShuttleQty(this.data.lineItems))
      })
  },

  loadDraft() {
    try {
      const raw = wx.getStorageSync(STORAGE_KEY)
      if (raw && Array.isArray(raw.participants) && raw.participants.length > 0) {
        const firstPid = raw.participants[0].id
        const normalized = normalizeLineItems(raw.lineItems, firstPid)
        const patch = { participants: raw.participants }
        if (normalized.length > 0) {
          patch.lineItems = normalized
        }
        this.setData(patch, () => this.recalcAll())
        return
      }
    } catch (e) {}
    this.recalcAll()
  },

  onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st !== this.data.pageScrollTop) {
      this.setData({ pageScrollTop: st })
    }
  },

  lineAmount(item) {
    if (item.type === 'shuttle') {
      const u = parseMoney(item.unitPrice)
      const q = Math.max(0, Math.floor(Number(item.qty) || 0))
      return u * q
    }
    return parseMoney(item.courtAmount)
  },

  enrichLines(lines) {
    const parts = this.data.participants
    const pmap = {}
    parts.forEach((p) => {
      pmap[p.id] = p
    })
    const fallback = parts[0] || { avatar: '/images/noheader.jpg', id: '' }
    return lines.map((it) => {
      const p = pmap[it.payerId] || fallback
      return {
        ...it,
        payerId: p.id || it.payerId,
        lineTotal: fmtMoney(this.lineAmount(it)),
        payerAvatar: p.avatar || '/images/noheader.jpg',
      }
    })
  },

  recalcAll() {
    const lineItems = this.enrichLines(this.data.lineItems)
    let total = 0
    lineItems.forEach((it) => {
      total += this.lineAmount(it)
    })

    const n = this.data.participants.length || 1
    const avgText = fmtMoney(total / n)

    this.setData(
      {
        lineItems,
        totalText: fmtMoney(total),
        avgText,
      },
      () => this.syncBallCountAndLayout(),
    )
  },

  onInputLineLabel(e) {
    const id = e.currentTarget.dataset.id
    const v = e.detail.value
    const lineItems = this.data.lineItems.map((it) => (it.id === id ? { ...it, label: v } : it))
    this.setData({ lineItems })
  },

  onInputCourtAmount(e) {
    const id = e.currentTarget.dataset.id
    const v = e.detail.value
    const lineItems = this.data.lineItems.map((it) => (it.id === id ? { ...it, courtAmount: v } : it))
    this.setData({ lineItems }, () => this.recalcAll())
  },

  onInputShuttleUnit(e) {
    const id = e.currentTarget.dataset.id
    const v = e.detail.value
    const lineItems = this.data.lineItems.map((it) => (it.id === id ? { ...it, unitPrice: v } : it))
    this.setData({ lineItems }, () => this.recalcAll())
  },

  onShuttleQtyMinus(e) {
    const id = e.currentTarget.dataset.id
    const lineItems = this.data.lineItems.map((it) => {
      if (it.id !== id || it.type !== 'shuttle') return it
      const q = Math.max(0, Math.floor(Number(it.qty) || 0) - 1)
      return { ...it, qty: q }
    })
    this.setData({ lineItems }, () => this.recalcAll())
  },

  onShuttleQtyPlus(e) {
    const id = e.currentTarget.dataset.id
    const lineItems = this.data.lineItems.map((it) => {
      if (it.id !== id || it.type !== 'shuttle') return it
      const q = Math.max(0, Math.floor(Number(it.qty) || 0) + 1)
      return { ...it, qty: q }
    })
    this.setData({ lineItems }, () => this.recalcAll())
  },

  onDeleteLine(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.lineItems.length <= 1) {
      wx.showToast({ title: '至少保留一行', icon: 'none' })
      return
    }
    const lineItems = this.data.lineItems.filter((it) => it.id !== id)
    this.setData({ lineItems }, () => this.recalcAll())
  },

  onAddLine() {
    wx.showActionSheet({
      itemList: ['添加场地费', '添加球费'],
      success: (res) => {
        const idx = res.tapIndex
        const firstPid = (this.data.participants[0] && this.data.participants[0].id) || 'p1'
        let row
        if (idx === 0) {
          row = {
            id: uid(),
            type: 'court',
            label: '场地费',
            courtAmount: '',
            unitPrice: '',
            qty: 1,
            payerId: firstPid,
            lineTotal: '0',
            payerAvatar: '/images/noheader.jpg',
          }
        } else {
          row = {
            id: uid(),
            type: 'shuttle',
            label: '球费',
            courtAmount: '',
            unitPrice: '',
            qty: 1,
            payerId: firstPid,
            lineTotal: '0',
            payerAvatar: '/images/noheader.jpg',
          }
        }
        const lineItems = this.data.lineItems.concat(row)
        this.setData({ lineItems }, () => this.recalcAll())
      },
    })
  },

  onTapLinePayer(e) {
    const lineId = e.currentTarget.dataset.id
    const names = this.data.participants.map((p) => p.name || '未命名')
    if (!names.length) return
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const p = this.data.participants[res.tapIndex]
        if (!p) return
        const lineItems = this.data.lineItems.map((it) =>
          it.id === lineId ? { ...it, payerId: p.id } : it,
        )
        this.setData({ lineItems }, () => this.recalcAll())
      },
    })
  },

  onAddParticipant() {
    if (this.data.participants.length >= 20) {
      wx.showToast({ title: '最多添加20人', icon: 'none' })
      return
    }
    wx.showModal({
      title: '添加人员',
      editable: true,
      placeholderText: '请输入昵称',
      success: (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim() || `球友${this.data.participants.length + 1}`
        const row = { id: uid(), name, avatar: '/images/noheader.jpg' }
        this.setData({ participants: this.data.participants.concat(row) }, () => this.recalcAll())
      },
    })
  },

  buildPersistPayload() {
    const lines = this.data.lineItems.map((it) => ({
      id: it.id,
      type: it.type,
      label: it.label,
      courtAmount: it.courtAmount,
      unitPrice: it.unitPrice,
      qty: it.qty,
      payerId: it.payerId,
    }))
    return {
      participants: this.data.participants,
      lineItems: lines,
      savedAt: Date.now(),
    }
  },

  onSave() {
    try {
      wx.setStorageSync(STORAGE_KEY, this.buildPersistPayload())
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  onShareAppMessage() {
    const { totalText, avgText } = this.data
    return {
      title: `费用计算 · 总计¥${totalText} · 人均约¥${avgText}`,
      path: '/pages/cost/index',
    }
  },
})
