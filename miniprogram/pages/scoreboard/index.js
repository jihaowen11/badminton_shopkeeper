// pages/scoreboard/index.js
const { MATCH_ROUNDS_LIST, MATCH_ROUNDS_SUBMIT_SCORE } = require('../../request/api')
const { pad2 } = require('../../utils/format')
const { createScrollSync } = require('../../utils/scrollSync')

const STORAGE_KEY = 'scoreboard_records'

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

    /** free = 独立计分器；round = 从某场比赛的排期进入，比分要写回后端 */
    mode: 'free',
    roundId: '',
    matchId: '',
    roundLabel: '',
    team1Name: '左方',
    team2Name: '右方',
    loading: false,
    loadError: '',
    submitting: false,

    gameNo: 1,
    matchType: 'single', // single | double
    rule: 21, // 21 | 11

    scoreLeft: 0,
    scoreRight: 0,
    serverSide: 'left', // left | right

    scoreAnimLeft: false,
    scoreAnimRight: false,
    /** 达到结束条件时提示过一次就不再打扰 */
    endPrompted: false,

    records: [],
  },

  onLoad(options) {
    const q = options && typeof options === 'object' ? options : {}
    const roundId = q.roundId ? String(q.roundId) : ''
    const isRoundMode = !!roundId

    const rule = Number(q.target)
    const nextData = {
      mode: isRoundMode ? 'round' : 'free',
      roundId,
      matchId: q.matchId ? String(q.matchId) : '',
      rule: Number.isFinite(rule) && rule >= 5 && rule <= 99 ? rule : 21,
      matchType: isRoundMode ? 'double' : 'single',
    }

    if (isRoundMode) {
      // 比分/队名以后端为准，避免 URL 传中文名带来的编码问题
      nextData.loading = true
      if (q.s1 != null && q.s2 != null) {
        nextData.scoreLeft = Number(q.s1) || 0
        nextData.scoreRight = Number(q.s2) || 0
      }
    }

    this.setData(nextData, () => {
      this.refreshTexts()
      if (isRoundMode) {
        this.loadRound()
      } else {
        this.loadRecords()
      }
    })
  },

  /** 从排期接口取本场双方与已有比分 */
  loadRound() {
    const { matchId, roundId } = this.data
    if (!matchId) {
      this.setData({ loading: false, loadError: '缺少比赛信息' })
      return Promise.resolve(null)
    }
    return MATCH_ROUNDS_LIST({ matchId })
      .then((ret) => {
        const payload = ret && typeof ret === 'object' ? ret : {}
        const rounds = Array.isArray(payload.rounds) ? payload.rounds : []
        let found = null
        let roundNo = ''
        rounds.forEach((rd) => {
          (rd.courts || []).forEach((c) => {
            if (String(c.id) === String(roundId)) {
              found = c
              roundNo = rd.no
            }
          })
        })
        if (!found) {
          this.setData({ loading: false, loadError: '这场已经不在排期里了' })
          return null
        }
        const names = (team) => (team || []).map((p) => (p && p.name) || '球友').join(' / ')
        const done = !!found.done
        this.setData({
          loading: false,
          loadError: '',
          roundLabel: `第${roundNo}轮 · ${found.courtNo}号场`,
          team1Name: names(found.team1) || '左方',
          team2Name: names(found.team2) || '右方',
          scoreLeft: done ? Number(found.score1) || 0 : this.data.scoreLeft,
          scoreRight: done ? Number(found.score2) || 0 : this.data.scoreRight,
        })
        return found
      })
      .catch(() => {
        this.setData({ loading: false, loadError: '比分加载失败，请返回重试' })
        return null
      })
  },

  onPageScroll: createScrollSync('pageScrollTop', 10),

  refreshTexts() {
    this.setData({
      matchTypeText: this.data.matchType === 'double' ? '双打' : '单打',
      ruleText: `${this.data.rule}分制`,
    })
  },

  loadRecords() {
    const records = safeReadRecords().slice(0, 5)
    const gameNo = records.length + 1
    this.setData({ records, gameNo })
  },

  pulse(side) {
    const key = side === 'right' ? 'scoreAnimRight' : 'scoreAnimLeft'
    this.setData({ [key]: false })
    setTimeout(() => {
      this.setData({ [key]: true })
      setTimeout(() => this.setData({ [key]: false }), 180)
    }, 10)
  },

  /** 是否已分出胜负：达到分制且领先 2 分，或触顶封顶分 */
  isGameOver(left, right) {
    const rule = this.data.rule
    // 羽毛球常见的封顶分：21 分制 30 封顶，15 分制 21 封顶，11 分制 15 封顶
    const capMap = { 21: 30, 15: 21, 11: 15 }
    const cap = capMap[rule] || rule + 5
    const hi = Math.max(left, right)
    const lo = Math.min(left, right)
    if (hi >= cap) return true
    return hi >= rule && hi - lo >= 2
  },

  onAddPoint(e) {
    const side = e.currentTarget.dataset.side
    if (side !== 'left' && side !== 'right') return
    const nextLeft = side === 'left' ? this.data.scoreLeft + 1 : this.data.scoreLeft
    const nextRight = side === 'right' ? this.data.scoreRight + 1 : this.data.scoreRight
    this.setData({
      scoreLeft: nextLeft,
      scoreRight: nextRight,
      serverSide: side,
    })
    this.pulse(side)

    if (!this.data.endPrompted && this.isGameOver(nextLeft, nextRight)) {
      this.setData({ endPrompted: true })
      wx.vibrateShort && wx.vibrateShort({ type: 'medium' })
      this.confirmFinish(nextLeft, nextRight)
    }
  },

  /** 达到结束条件时让用户确认保存 */
  confirmFinish(left, right) {
    const winner = left > right ? this.data.team1Name : this.data.team2Name
    wx.showModal({
      title: '本场结束',
      content: `${this.data.team1Name} ${left} : ${right} ${this.data.team2Name}，${winner} 获胜。现在保存比分吗？`,
      confirmText: '保存比分',
      cancelText: '继续打',
      success: (res) => {
        if (!res.confirm) return
        this.onEndMatch()
      },
    })
  },

  onUndo(e) {
    const side = e.currentTarget.dataset.side
    if (side !== 'left' && side !== 'right') return
    if (side === 'left') {
      if (this.data.scoreLeft <= 0) return
      this.setData({ scoreLeft: this.data.scoreLeft - 1, endPrompted: false })
      this.pulse('left')
    } else {
      if (this.data.scoreRight <= 0) return
      this.setData({ scoreRight: this.data.scoreRight - 1, endPrompted: false })
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
      title: `${md}`,
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
    if (this.data.scoreLeft === 0 && this.data.scoreRight === 0) return null
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
    return dedup
  },

  /** 结束本场：排期模式写回后端，独立模式存本机 */
  onEndMatch() {
    const { scoreLeft, scoreRight } = this.data
    if (scoreLeft === 0 && scoreRight === 0) {
      wx.showToast({ title: '当前无比分可保存', icon: 'none' })
      return
    }
    if (scoreLeft === scoreRight) {
      wx.showToast({ title: '羽毛球没有平局，请先分出胜负', icon: 'none' })
      return
    }
    if (this.data.mode === 'round') {
      this.submitRoundScore(scoreLeft, scoreRight)
      return
    }
    const dedup = this.saveRecordIfNeeded()
    if (!dedup) return
    this.setData({
      gameNo: dedup.length + 1,
      scoreLeft: 0,
      scoreRight: 0,
      serverSide: 'left',
      endPrompted: false,
    })
    wx.showToast({ title: '已保存，进入下一局', icon: 'success' })
  },

  /** 把比分写回排期 */
  submitRoundScore(team1Score, team2Score) {
    if (this.data.submitting) return
    if (!this.data.roundId) return
    this.setData({ submitting: true })
    wx.showLoading({ title: '保存中...', mask: true })
    MATCH_ROUNDS_SUBMIT_SCORE({
      roundId: this.data.roundId,
      team1Score,
      team2Score,
    })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '比分已保存', icon: 'success' })
        setTimeout(() => {
          const pages = getCurrentPages()
          if (pages.length > 1) {
            wx.navigateBack()
          } else {
            wx.redirectTo({
              url: `/pages/match/details/index?id=${encodeURIComponent(this.data.matchId)}`,
            })
          }
        }, 600)
      })
      .catch(() => {
        wx.hideLoading()
      })
      .finally(() => {
        this.setData({ submitting: false })
      })
  },

  onReset() {
    if (this.data.scoreLeft === 0 && this.data.scoreRight === 0) {
      this.setData({ serverSide: 'left', endPrompted: false })
      return
    }
    wx.showModal({
      title: '重置本场',
      content: '将清空当前分数与发球状态，已有比分不受影响。',
      confirmText: '重置',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return
        this.setData({
          scoreLeft: 0,
          scoreRight: 0,
          serverSide: 'left',
          endPrompted: false,
        })
      },
    })
  },

  onClearRecords() {
    wx.showModal({
      title: '清空记录',
      content: '确定清空最近记录吗？',
      success: (res) => {
        if (!res.confirm) return
        safeWriteRecords([])
        this.setData({ records: [], gameNo: 1 })
      },
    })
  },

  onShareAppMessage() {
    return { title: '计分器', path: '/pages/scoreboard/index' }
  },
})
