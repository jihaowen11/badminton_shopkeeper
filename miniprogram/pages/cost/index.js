// pages/cost/index.js

const { BallSim, sumShuttleQty } = require('./balls.js')
const { MATCH_ROUNDS_LIST } = require('../../request/api')
const { whenLoginReady } = require('../../utils/auth')
const { DEFAULT_AVATAR, toAvatarUrl } = require('../../utils/static')
const { createScrollSync } = require('../../utils/scrollSync')

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

/**
 * 结算建议：每人"已垫付 - 应摊"得到净额，再让欠最多的给垫最多的转账。
 * 用贪心配对而不是两两平摊，能把转账笔数压到最少。
 */
function buildSettlements(participants, lineItems, amountOf) {
  const n = Array.isArray(participants) ? participants.length : 0
  if (n < 2) return []

  const paid = {}
  participants.forEach((p) => {
    paid[p.id] = 0
  })

  let total = 0
  ;(Array.isArray(lineItems) ? lineItems : []).forEach((it) => {
    const amount = amountOf(it)
    total += amount
    if (paid[it.payerId] == null) paid[it.payerId] = 0
    paid[it.payerId] += amount
  })
  if (total <= 0) return []

  const avg = total / n
  const creditors = []
  const debtors = []

  participants.forEach((p) => {
    const net = Math.round(((paid[p.id] || 0) - avg) * 100) / 100
    const row = { name: p.name || '球友', net }
    if (net > 0.009) creditors.push(row)
    else if (net < -0.009) debtors.push(row)
  })

  creditors.sort((a, b) => b.net - a.net)
  debtors.sort((a, b) => a.net - b.net)

  const result = []
  let i = 0
  let j = 0
  let guard = 0
  while (i < debtors.length && j < creditors.length && guard < 200) {
    guard += 1
    const pay = Math.min(-debtors[i].net, creditors[j].net)
    if (pay > 0.009) {
      result.push({
        key: `${i}-${j}`,
        from: debtors[i].name,
        to: creditors[j].name,
        amountText: fmtMoney(pay),
      })
    }
    debtors[i].net = Math.round((debtors[i].net + pay) * 100) / 100
    creditors[j].net = Math.round((creditors[j].net - pay) * 100) / 100
    if (debtors[i].net > -0.009) i += 1
    if (creditors[j].net < 0.009) j += 1
  }
  return result
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

    // 从比赛进入时带 matchId，人员直接取这场比赛已在排期/报名里的人
    matchId: '',
    loading: false,

    // 结算建议：[{ from, to, amountText }]，全部为 0 时为空数组
    settlements: [],

    participants: [],

    lineItems: [
      {
        id: 'line_court_default',
        type: 'court',
        label: '场地费',
        courtAmount: '',
        unitPrice: '',
        qty: 1,
        payerId: 'me',
        lineTotal: '0',
        payerAvatar: DEFAULT_AVATAR,
      },
      {
        id: 'line_shuttle_default',
        type: 'shuttle',
        label: '球费',
        courtAmount: '',
        unitPrice: '',
        qty: 1,
        payerId: 'me',
        lineTotal: '0',
        payerAvatar: DEFAULT_AVATAR,
      },
    ],
  },

  onLoad(options) {
    this._ballSim = new BallSim()
    this._heroW = 0
    this._heroH = 0
    const matchId = options && options.matchId ? String(options.matchId) : ''
    if (matchId) {
      this.setData({ matchId })
      this.loadMatchParticipants(matchId)
    } else {
      this.loadDraft()
    }
  },

  /** 从比赛报名名单取人：这是最准确的一份"谁在场" */
  loadMatchParticipants(matchId) {
    this.setData({ loading: true })
    return whenLoginReady()
      .then(() => MATCH_ROUNDS_LIST({ matchId }).catch(() => null))
      .then((schedule) => {
        const players = (schedule && Array.isArray(schedule.players)) ? schedule.players : []
        const participants = players
          .map((p, index) => ({
            id: p.openId || `guest_${index}`,
            name: (p.name != null && String(p.name).trim()) || `球友${index + 1}`,
            avatar: toAvatarUrl(p.avatar),
          }))
          .filter((p) => !!p.id)

        if (participants.length === 0) {
          // 没报名数据（比如比赛还没人报名）就退回本地草稿，别让页面空着
          this.loadDraft()
          return
        }

        const firstPid = participants[0].id
        this.setData({
          participants,
          lineItems: this.data.lineItems.map((it) => ({ ...it, payerId: firstPid, payerAvatar: participants[0].avatar })),
        })
        this.recalcAll()
      })
      .catch(() => {
        this.loadDraft()
      })
      .finally(() => {
        this.setData({ loading: false })
      })
  },

  /** 草稿的存储键：按比赛分开存，避免把上一场的账单带进来 */
  storageKey() {
    return this.data.matchId ? `cost_bill_draft_m${this.data.matchId}` : STORAGE_KEY
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

  /** 默认费用明细：一条场地费 + 一条球费，垫付人默认第一个人 */
  buildDefaultLines(payerId, payerAvatar) {
    const first = this.data.participants[0] || {}
    const pid = payerId || first.id || 'me'
    const avatar = payerAvatar || first.avatar || DEFAULT_AVATAR
    return [
      {
        id: 'line_court_default',
        type: 'court',
        label: '场地费',
        courtAmount: '',
        unitPrice: '',
        qty: 1,
        payerId: pid,
        lineTotal: '0',
        payerAvatar: avatar,
      },
      {
        id: 'line_shuttle_default',
        type: 'shuttle',
        label: '球费',
        courtAmount: '',
        unitPrice: '',
        qty: 1,
        payerId: pid,
        lineTotal: '0',
        payerAvatar: avatar,
      },
    ]
  },

  /** 没有草稿时的初始人员：只有"我"一个，其他用「+ 人员」补 */
  defaultParticipants() {
    let name = '我'
    let avatar = DEFAULT_AVATAR
    try {
      const app = getApp()
      const info = (app && app.globalData && app.globalData.userInfo) || {}
      const nick = info.nickName != null ? String(info.nickName).trim() : ''
      if (nick) name = nick
      if (info.avatar) avatar = toAvatarUrl(info.avatar)
    } catch (e) {}
    return [{ id: 'me', name, avatar }]
  },

  loadDraft() {
    try {
      const raw = wx.getStorageSync(this.storageKey())
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
    const participants = this.data.participants.length > 0 ? this.data.participants : this.defaultParticipants()
    this.setData({ participants }, () => this.recalcAll())
  },

  onPageScroll: createScrollSync('pageScrollTop', 10),

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
    const fallback = parts[0] || { avatar: DEFAULT_AVATAR, id: '' }
    return lines.map((it) => {
      const p = pmap[it.payerId] || fallback
      return {
        ...it,
        payerId: p.id || it.payerId,
        lineTotal: fmtMoney(this.lineAmount(it)),
        payerAvatar: p.avatar || DEFAULT_AVATAR,
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
    const settlements = buildSettlements(this.data.participants, lineItems, (it) => this.lineAmount(it))

    this.setData(
      {
        lineItems,
        totalText: fmtMoney(total),
        avgText,
        settlements,
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
            payerAvatar: DEFAULT_AVATAR,
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
            payerAvatar: DEFAULT_AVATAR,
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
        const row = { id: uid(), name, avatar: DEFAULT_AVATAR }
        this.setData({ participants: this.data.participants.concat(row) }, () => this.recalcAll())
      },
    })
  },

  /** 点头像：改名 / 删除。删除后把垫付人重挂到剩下第一个人，避免指向不存在的人 */
  onTapParticipant(e) {
    const id = e.currentTarget.dataset.id
    const p = this.data.participants.find((it) => it.id === id)
    if (!p) return
    const canRemove = this.data.participants.length > 1
    wx.showActionSheet({
      itemList: canRemove ? ['修改昵称', '删除该人员'] : ['修改昵称'],
      success: (res) => {
        if (res.tapIndex === 0) this.renameParticipant(p)
        else if (res.tapIndex === 1) this.removeParticipant(p)
      },
    })
  },

  renameParticipant(p) {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      content: p.name || '',
      placeholderText: '请输入昵称',
      success: (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) return
        const participants = this.data.participants.map((it) => (it.id === p.id ? { ...it, name } : it))
        this.setData({ participants }, () => this.recalcAll())
      },
    })
  },

  removeParticipant(p) {
    if (this.data.participants.length <= 1) {
      wx.showToast({ title: '至少保留1人', icon: 'none' })
      return
    }
    wx.showModal({
      title: '删除人员',
      content: `确定删除「${p.name || '球友'}」？`,
      confirmText: '删除',
      confirmColor: '#e54545',
      success: (res) => {
        if (!res.confirm) return
        const participants = this.data.participants.filter((it) => it.id !== p.id)
        const first = participants[0]
        const lineItems = this.data.lineItems.map((it) =>
          it.payerId === p.id ? { ...it, payerId: first.id, payerAvatar: first.avatar } : it,
        )
        this.setData({ participants, lineItems }, () => this.recalcAll())
      },
    })
  },

  /** 清空重填：丢掉草稿，回到初始状态（从比赛进入的，人员重新按报名名单拉一次） */
  onReset() {
    const inMatch = !!this.data.matchId
    wx.showModal({
      title: '清空重填',
      content: inMatch ? '将清除本次填写的费用，人员恢复为比赛名单。' : '将清除本次填写的人员和费用，恢复为初始状态。',
      confirmText: '清空',
      confirmColor: '#e54545',
      success: (res) => {
        if (!res.confirm) return
        try {
          wx.removeStorageSync(this.storageKey())
        } catch (e) {}
        if (inMatch) {
          // 人员不从本地草稿恢复，交给 loadMatchParticipants 重新拉名单
          const lineItems = this.buildDefaultLines()
          this.setData({ lineItems, settlements: [], totalText: '0', avgText: '0' }, () => {
            this.loadMatchParticipants(this.data.matchId)
          })
        } else {
          const participants = this.defaultParticipants()
          const lineItems = this.buildDefaultLines(participants[0].id, participants[0].avatar)
          this.setData({ participants, lineItems, settlements: [], totalText: '0', avgText: '0' }, () =>
            this.recalcAll(),
          )
        }
        wx.showToast({ title: '已清空', icon: 'none' })
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
      wx.setStorageSync(this.storageKey(), this.buildPersistPayload())
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
