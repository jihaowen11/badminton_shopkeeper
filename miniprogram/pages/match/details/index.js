// pages/match/details/index.js
const {
  MATCH_DES,
  MATCH_UPDATE_STATUS,
  CLUB_DES,
  MATCH_INVITE_CLUB_MEMBERS,
  MATCH_INCREMENT_VIEWS,
  MATCH_JOIN,
  MATCH_ROUNDS_LIST,
  MATCH_ROUNDS_GENERATE,
} = require('../../../request/api')

const DEFAULT_AVATAR = '/images/noheader.jpg'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toText(v, fallback = '') {
  const s = v == null ? '' : String(v).trim()
  return s || fallback
}

function pickOpenId() {
  try {
    const app = getApp()
    const gd = (app && app.globalData) || {}
    return (
      (gd.openid && String(gd.openid).trim()) ||
      (gd.userInfo &&
        (gd.userInfo.openId || gd.userInfo.openid || gd.userInfo.openID) &&
        String(gd.userInfo.openId || gd.userInfo.openid || gd.userInfo.openID).trim()) ||
      ''
    )
  } catch (e) {
    return ''
  }
}

function toAvatarUrl(rawAvatar) {
  const path = toText(rawAvatar)
  if (!path) return ''
  try {
    const app = getApp()
    if (app && app.fun && typeof app.fun.joinStaticUrl === 'function') {
      return app.fun.joinStaticUrl(path)
    }
  } catch (e) {}
  return path
}

function formatDateLine(raw) {
  if (!raw) return '--'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '--'
  const week = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}（星期${week[d.getDay()]}）${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function mapTypeLine(type) {
  const t = Number(type)
  if (t === 1) return '单打'
  if (t === 2) return '双打'
  if (t === 3) return '混双'
  return '比赛'
}

function mapStatus(status) {
  const s = Number(status)
  if (s === 1) return { status: 'open', statusText: '报名中', actionText: '我要报名' }
  if (s === 2) return { status: 'open', statusText: '进行中', actionText: '进行中' }
  if (s === 3) return { status: 'end', statusText: '已结束', actionText: '已结束' }
  if (s === 4) return { status: 'end', statusText: '中断', actionText: '已中断' }
  if (s === 5) return { status: 'end', statusText: '已取消', actionText: '已取消' }
  return { status: 'open', statusText: '报名中', actionText: '我要报名' }
}

function mapOrganizer(organizer) {
  const name = toText(organizer && (organizer.nickName || organizer.name), '组织者')
  return {
    openId: toText(organizer && organizer.openId),
    name,
    abbr: name.slice(0, 1),
    tone: 'orange',
    avatarUrl: toAvatarUrl(organizer && organizer.avatar),
  }
}

function mapRegPreview(participants) {
  const tones = ['green', 'blue', 'pink']
  const list = Array.isArray(participants) ? participants : []
  return list.slice(0, 8).map((p, idx) => {
    const user = p && typeof p.user === 'object' ? p.user : {}
    const name = toText(user.nickName || p.userName, '球友')
    return {
      id: p && p.id != null ? String(p.id) : `p_${idx}`,
      abbr: name.slice(0, 1),
      tone: tones[idx % tones.length],
      avatarUrl: toAvatarUrl((user && user.avatar) || p.userAvatar),
    }
  })
}

function buildRegisteredOpenIdSet(participants) {
  const set = new Set()
  const list = Array.isArray(participants) ? participants : []
  list.forEach((p) => {
    const id = toText(p && p.userId)
    if (id) set.add(id)
    const u = p && typeof p.user === 'object' ? p.user : {}
    const oid = toText(u.openId || u.openid || u.openID)
    if (oid) set.add(oid)
  })
  return set
}

function hasJoinedMatch(registeredSet, openId) {
  const oid = toText(openId)
  if (!oid) return false
  return registeredSet.has(oid)
}

function isProfileCompleted(userInfo) {
  const u = userInfo && typeof userInfo === 'object' ? userInfo : {}
  const nick = toText(u.nickName)
  const avatar = toText(u.avatar)
  if (!nick || nick.indexOf('羽球人') === 0) return false
  if (!avatar) return false
  if (avatar.indexOf('/images/') === 0) return false
  return true
}

function mapMatch(match, participants, club) {
  const m = match && typeof match === 'object' ? match : {}
  const c = club && typeof club === 'object' ? club : {}
  const joined = Array.isArray(participants) ? participants.length : 0
  const capacity = Number(m.playerCount || 0)
  const sessions = Number(m.sessionCount || 0)
  const statusView = mapStatus(m.status)
  const clubLine = toText(c.name)
  const clubIdFromMatch = m.clubId != null && String(m.clubId).trim() !== '' ? String(m.clubId).trim() : ''
  const clubIdFromClub = c.id != null && String(c.id).trim() !== '' ? String(c.id).trim() : ''
  const clubId = clubIdFromMatch || clubIdFromClub
  return {
    title: toText(m.name, '比赛'),
    status: statusView.status,
    statusCode: Number(m.status || 0),
    statusText: statusView.statusText,
    actionText: statusView.actionText,
    dateLine: formatDateLine(m.startTime || m.createdAt),
    typeLine: mapTypeLine(m.type),
    formatLine: toText(m.competitionFormat, '--'),
    peopleLine: `实报${joined}人，计划${capacity}人，共${sessions}场`,
    pairStyle: '随机大乱斗',
    targetScore: Number(m.targetScore || 0),
    viewPeople: joined,
    views: Number(m.views || 0),
    joined,
    capacity,
    clubLine,
    clubId,
    hasClub: !!(clubLine || clubId),
  }
}

function toAbbrMember(name) {
  return toText(name, '友').slice(0, 1)
}

function mapClubMembersForInvite(rawMembers, registeredSet) {
  const rows = Array.isArray(rawMembers) ? rawMembers : []
  const out = []
  rows.forEach((m, index) => {
    const user = m && typeof m.user === 'object' ? m.user : {}
    const openId = toText((m && m.userId) || user.openId || user.openid || user.openID)
    if (!openId) return
    const r = toText(m && m.role).toLowerCase()
    const roleText = r === 'owner' ? '会长' : r === 'admin' ? '管理员' : '成员'
    const name = toText(user.nickName || (m && m.userName), `成员${index + 1}`)
    const alreadyJoined = registeredSet.has(openId)
    out.push({
      openId,
      name,
      abbr: toAbbrMember(name),
      avatarUrl: toAvatarUrl(user.avatar || (m && m.userAvatar)),
      metaLine1: roleText,
      metaLine2: toText(user.badmintonLevel, '未定级'),
      isPresident: r === 'owner',
      disabled: alreadyJoined,
      alreadyJoined,
      checked: false,
    })
  })
  return out
}

/** 分享图逻辑尺寸（5:4），与微信分享图比例建议一致 */
const SHARE_POSTER_W = 500
const SHARE_POSTER_H = 400

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const s = toText(text)
  if (!s) return ['']
  const lines = []
  let i = 0
  while (i < s.length && lines.length < maxLines) {
    let end = i
    let lo = i + 1
    let hi = s.length
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const w = ctx.measureText(s.slice(i, mid)).width
      if (w <= maxWidth) {
        end = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    if (end <= i) end = i + 1
    lines.push(s.slice(i, end))
    i = end
  }
  if (i < s.length && lines.length > 0) {
    const last = lines[lines.length - 1]
    const cut = Math.max(0, last.length - 1)
    lines[lines.length - 1] = `${last.slice(0, cut)}…`
  }
  return lines
}

function drawSharePoster(ctx, match) {
  const W = SHARE_POSTER_W
  const H = SHARE_POSTER_H
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#d4efe4')
  g.addColorStop(0.55, '#e2f4ec')
  g.addColorStop(1, '#f7fbf9')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const cardX = 20
  const cardY = 18
  const cardW = W - 40
  const cardH = H - 36
  const radius = 16

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.10)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 8
  ctx.fillStyle = '#ffffff'
  roundRectPath(ctx, cardX, cardY, cardW, cardH, radius)
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = 'rgba(18,22,26,0.06)'
  ctx.lineWidth = 1
  roundRectPath(ctx, cardX, cardY, cardW, cardH, radius)
  ctx.stroke()

  ctx.save()
  roundRectPath(ctx, cardX, cardY, cardW, cardH, radius)
  ctx.clip()

  const code = Number(match.statusCode || 0)
  const statusOpen = code === 1 || code === 2
  const pillW = 100
  const pillH = 32
  const pillX = cardX + cardW - pillW - 16
  const pillY = cardY + 16
  ctx.fillStyle = statusOpen ? 'rgba(10,143,62,0.88)' : 'rgba(143,152,161,0.92)'
  roundRectPath(ctx, pillX, pillY, pillW, pillH, 10)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(toText(match.statusText, '报名中'), pillX + pillW / 2, pillY + pillH / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  let y = cardY + 52
  ctx.fillStyle = '#12161a'
  ctx.font = 'bold 22px sans-serif'
  const titleMaxW = cardW - 36
  const titleLines = wrapLines(ctx, toText(match.title, '比赛'), titleMaxW, 2)
  titleLines.forEach((line) => {
    ctx.fillText(line, cardX + 18, y)
    y += 30
  })

  y += 8
  ctx.font = '15px sans-serif'
  ctx.fillStyle = 'rgba(18,22,26,0.78)'
  const innerW = cardW - 36
  const lineHeight = 22
  const rows = [
    `日期：${toText(match.dateLine, '--')}`,
    `类型：${toText(match.typeLine, '--')}`,
    `赛制：${toText(match.formatLine, '--')}`,
    `人数：${toText(match.peopleLine, '--')}`,
  ]
  if (toText(match.clubLine)) rows.push(`俱乐部：${match.clubLine}`)
  const bottomY = cardY + cardH - 28
  rows.forEach((row) => {
    if (y > bottomY - lineHeight * 2) return
    const ls = wrapLines(ctx, row, innerW, 2)
    ls.forEach((ln) => {
      if (y > bottomY - lineHeight) return
      ctx.fillText(ln, cardX + 18, y)
      y += lineHeight
    })
  })

  if (y <= bottomY - lineHeight - 10) {
    y += 4
    ctx.strokeStyle = 'rgba(18,22,26,0.08)'
    ctx.beginPath()
    ctx.moveTo(cardX + 18, y)
    ctx.lineTo(cardX + cardW - 18, y)
    ctx.stroke()
    y += 12
    const vLine = `浏览量：${match.views != null ? match.views : 0}`
    wrapLines(ctx, vLine, innerW, 1).forEach((ln) => {
      if (y > bottomY - lineHeight) return
      ctx.fillText(ln, cardX + 18, y)
      y += lineHeight
    })
  }

  ctx.restore()

  ctx.fillStyle = 'rgba(18,22,26,0.38)'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText('羽球掌柜 · 邀请你参赛', W / 2, H - 10)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

/** 排期里一个选手在页面上的形态 */
function mapSchedulePlayer(p, currentOpenId) {
  const openId = toText(p && p.openId)
  const name = toText(p && p.name, '球友')
  return {
    id: openId || name,
    openId,
    name,
    avatar: toAvatarUrl(p && p.avatar) || DEFAULT_AVATAR,
    isMe: !!openId && openId === toText(currentOpenId),
  }
}

/**
 * 把 /matchRounds/list 的返回映射成页面结构
 * 输出：按轮分组，每轮若干场，附带每场的展示字段
 */
function mapSchedule(payload, currentOpenId) {
  const raw = payload && typeof payload === 'object' ? payload : {}
  const rawRounds = Array.isArray(raw.rounds) ? raw.rounds : []
  return rawRounds.map((rd) => {
    const courts = (Array.isArray(rd.courts) ? rd.courts : []).map((c) => {
      const team1 = (Array.isArray(c.team1) ? c.team1 : []).map((p) => mapSchedulePlayer(p, currentOpenId))
      const team2 = (Array.isArray(c.team2) ? c.team2 : []).map((p) => mapSchedulePlayer(p, currentOpenId))
      const done = !!c.done
      const s1 = Number(c.score1)
      const s2 = Number(c.score2)
      return {
        id: `${rd.no}_${c.courtNo}`,
        roundId: c.id,
        courtNo: c.courtNo,
        courtLabel: `${c.courtNo || 1}号场`,
        team1Players: team1,
        team2Players: team2,
        leftNameLine1: team1[0] ? team1[0].name : '',
        leftNameLine2: team1[1] ? team1[1].name : '',
        rightNameLine1: team2[0] ? team2[0].name : '',
        rightNameLine2: team2[1] ? team2[1].name : '',
        scoreLeft: done && Number.isFinite(s1) ? s1 : 0,
        scoreRight: done && Number.isFinite(s2) ? s2 : 0,
        done,
        canEdit: !!c.canEdit,
        winSide: done && Number.isFinite(s1) && Number.isFinite(s2)
          ? s1 === s2
            ? 'draw'
            : s1 > s2
              ? 'left'
              : 'right'
          : '',
      }
    })
    const resting = (Array.isArray(rd.resting) ? rd.resting : []).map((p) => mapSchedulePlayer(p, currentOpenId))
    return {
      no: rd.no,
      label: toText(rd.label, `第${rd.no}轮`),
      courts,
      resting,
      restingText: resting.length ? ` · 轮空 ${resting.map((p) => p.name).join('、')}` : '',
    }
  })
}

/** 排名映射（后端已按 胜场→净胜分→得分 排好序，这里只做展示转换） */
function mapRankings(list, currentOpenId) {
  const rows = Array.isArray(list) ? list : []
  return rows.map((item, index) => {
    const openId = toText(item && item.openId)
    return {
      id: openId || `r_${index}`,
      rank: item && item.rank != null ? item.rank : '-',
      name: toText(item && item.name, '球友'),
      avatar: toAvatarUrl(item && item.avatar) || DEFAULT_AVATAR,
      isMe: !!openId && openId === toText(currentOpenId),
      played: Number(item && item.played) || 0,
      win: Number(item && item.win) || 0,
      lose: Number(item && item.lose) || 0,
      diff: Number(item && item.diff) || 0,
    }
  })
}

Page({
  data: {
    matchId: '',
    pageScrollTop: 0,
    activeTab: 'match',
    match: {},
    organizer: {},
    regPreview: [],
    /** 按轮分组的真实排期 */
    scheduleRounds: [],
    /** 排期元信息：是否已生成、总场次、已完成场次 */
    scheduleMeta: { generated: false, totalRounds: 0, totalMatches: 0, finishedMatches: 0, courts: 0 },
    /** 当前用户是否可生成/重排排期（组织者） */
    canGenerate: false,
    scheduleLoading: true,
    generating: false,
    rankings: [],
    canManageFooter: false,
    showInviteClub: false,
    /** 由 canvas 导出的分享图临时路径 */
    shareImageUrl: '',
    /** 已报名用户的 openId，用于邀请俱乐部时禁用勾选 */
    registeredOpenIds: [],
    inviteClubVisible: false,
    inviteClubLoading: false,
    inviteClubName: '',
    inviteMemberList: [],
    /** 计划人数 - 已报名人数，即本次最多可选人数 */
    inviteSlotsMax: 0,
    /** 从分享链接进入 */
    isShareMode: false,
    /** 当前用户是否已报名 */
    hasJoined: false,
    joining: false,
  },

  onLoad(options) {
    const id = options && options.id ? String(options.id) : ''
    // 没有 id 就直接说明情况，不要拿占位 id 去请求一个不存在的比赛
    if (!id) {
      wx.showToast({ title: '缺少比赛信息', icon: 'none' })
      setTimeout(() => {
        const pages = getCurrentPages()
        if (pages.length > 1) {
          wx.navigateBack()
        } else {
          wx.switchTab({ url: '/pages/index/index' })
        }
      }, 900)
      return
    }
    const mode = options && options.mode
    const isShareMode = String(mode || '').toLowerCase() === 'share'
    this.setData({
      matchId: id,
      isShareMode,
    })
    this.fetchMatchDetail(id)
    if (isShareMode) {
      MATCH_INCREMENT_VIEWS({ id }).catch(() => {})
    }
  },

  onShow() {
    if (!this._pageReady) {
      this._pageReady = true
      return
    }
    const id = toText(this.data.matchId)
    if (id) {
      this.fetchMatchDetail(id, { refreshPoster: false })
    }
  },

  fetchMatchDetail(id, options) {
    const opts = options && typeof options === 'object' ? options : {}
    const refreshPoster = opts.refreshPoster !== false
    return MATCH_DES({ id })
      .then((ret) => {
        const payload = ret && typeof ret === 'object' ? ret : {}
        const participants = Array.isArray(payload.participants) ? payload.participants : []
        const mappedMatch = mapMatch(payload.match, participants, payload.club)
        const registeredSet = buildRegisteredOpenIdSet(participants)
        const registeredOpenIds = Array.from(registeredSet)
        const currentOpenId = pickOpenId()
        const createdBy = toText(payload && payload.match && payload.match.createdBy)
        const canManageFooter =
          mappedMatch.statusCode === 1 &&
          !!currentOpenId &&
          currentOpenId === createdBy
        const showInviteClub = canManageFooter && !!mappedMatch.hasClub
        const hasJoined = hasJoinedMatch(registeredSet, currentOpenId)
        const nextData = {
          match: mappedMatch,
          organizer: mapOrganizer(payload.organizer),
          regPreview: mapRegPreview(participants),
          canManageFooter,
          showInviteClub,
          registeredOpenIds,
          hasJoined,
          canGenerate: !!currentOpenId && currentOpenId === createdBy,
        }
        if (refreshPoster) {
          nextData.shareImageUrl = ''
        }
        this.setData(
          nextData,
          () => {
            if (!refreshPoster) return
            setTimeout(() => {
              this.renderSharePoster()
                .then((path) => {
                  if (path) this.setData({ shareImageUrl: path })
                })
                .catch(() => {})
            }, 80)
          },
        )
        // 排期单独拉一次：门票（报名信息）失败也不该影响它
        this.fetchSchedule(id)
        return ret
      })
      .catch(() => null)
  },

  /** 拉取排期与排名 */
  fetchSchedule(id) {
    if (!id) return Promise.resolve(null)
    this.setData({ scheduleLoading: true })
    return MATCH_ROUNDS_LIST({ matchId: id })
      .then((ret) => {
        const payload = ret && typeof ret === 'object' ? ret : {}
        const currentOpenId = pickOpenId()
        this.setData({
          scheduleRounds: mapSchedule(payload, currentOpenId),
          rankings: mapRankings(payload.rankings, currentOpenId),
          canGenerate: !!payload.canManage,
          scheduleMeta: {
            generated: !!payload.generated,
            totalRounds: Number(payload.totalRounds) || 0,
            totalMatches: Number(payload.totalMatches) || 0,
            finishedMatches: Number(payload.finishedMatches) || 0,
            courts: Number(payload.courts) || 0,
            targetScore: payload.targetScore != null ? Number(payload.targetScore) : 0,
          },
          scheduleLoading: false,
        })
        return payload
      })
      .catch(() => {
        this.setData({ scheduleRounds: [], rankings: [], scheduleLoading: false })
        return null
      })
  },

  /** 生成排期（组织者） */
  onGenerateSchedule() {
    if (this.data.generating) return
    const id = toText(this.data.matchId)
    if (!id) return
    const joined = Number(this.data.match && this.data.match.joined) || 0
    if (joined < 4) {
      wx.showToast({ title: '至少 4 人报名才能排期', icon: 'none' })
      return
    }
    this.setData({ generating: true })
    wx.showLoading({ title: '排期中...', mask: true })
    MATCH_ROUNDS_GENERATE({ matchId: id })
      .then(() => {
        wx.showToast({ title: '排期已生成', icon: 'success' })
        return this.fetchSchedule(id)
      })
      .then(() => this.fetchMatchDetail(id, { refreshPoster: false }))
      .catch(() => {})
      .finally(() => {
        wx.hideLoading()
        this.setData({ generating: false })
      })
  },

  /** 重新排期：已有比分时要二次确认 */
  onRegenerate() {
    if (this.data.generating) return
    const id = toText(this.data.matchId)
    if (!id) return
    const finished = Number(this.data.scheduleMeta.finishedMatches) || 0
    const doGenerate = (force) => {
      this.setData({ generating: true })
      wx.showLoading({ title: '排期中...', mask: true })
      MATCH_ROUNDS_GENERATE({ matchId: id, force: !!force })
        .then(() => {
          wx.showToast({ title: '已重新排期', icon: 'success' })
          return this.fetchSchedule(id)
        })
        .catch(() => {})
        .finally(() => {
          wx.hideLoading()
          this.setData({ generating: false })
        })
    }
    if (finished > 0) {
      wx.showModal({
        title: '重新排期',
        content: `已有 ${finished} 场录入比分，重新排期会同时清空这些比分，确定继续吗？`,
        confirmText: '重新排期',
        success: (res) => {
          if (res.confirm) doGenerate(true)
        },
      })
      return
    }
    doGenerate(false)
  },

  /** 进入记分板 */
  onTapRound(e) {
    const roundId = e.currentTarget.dataset.roundId
    const idx = Number(e.currentTarget.dataset.index)
    const rdIdx = Number(e.currentTarget.dataset.roundIndex)
    if (!roundId) return
    const round = this.data.scheduleRounds[rdIdx]
    const court = round && round.courts ? round.courts[idx] : null
    if (!court) return
    const names1 = court.team1Players.map((p) => p.name).join(' / ')
    const names2 = court.team2Players.map((p) => p.name).join(' / ')
    const target = Number(this.data.scheduleMeta.targetScore) || Number(this.data.match && this.data.match.targetScore) || 21
    const query = [
      `roundId=${roundId}`,
      `matchId=${encodeURIComponent(toText(this.data.matchId))}`,
      `t1=${encodeURIComponent(names1)}`,
      `t2=${encodeURIComponent(names2)}`,
      `target=${target}`,
      `r=${round ? round.no : ''}`,
      `c=${court.courtNo}`,
      court.done ? `s1=${court.scoreLeft}` : '',
      court.done ? `s2=${court.scoreRight}` : '',
    ]
        .filter(Boolean)
        .join('&')
    wx.navigateTo({ url: `/pages/scoreboard/index?${query}` })
  },

  /** 结束整场比赛 */
  onFinishMatch() {
    const id = toText(this.data.matchId)
    if (!id) return
    wx.showModal({
      title: '结束比赛',
      content: '结束后不再允许修改比分，确定结束吗？',
      confirmText: '结束',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...', mask: true })
        MATCH_UPDATE_STATUS({ id, status: 3 })
          .then(() => {
            wx.showToast({ title: '比赛已结束', icon: 'success' })
            return this.fetchMatchDetail(id, { refreshPoster: false })
          })
          .catch(() => {})
          .finally(() => wx.hideLoading())
      },
    })
  },

  renderSharePoster() {
    const match = this.data.match
    if (!match || !toText(match.title)) return Promise.resolve('')
    return new Promise((resolve) => {
      const query = wx.createSelectorQuery().in(this)
      query
        .select('#sharePosterCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const first = res && res[0]
          if (!first || !first.node) {
            resolve('')
            return
          }
          const canvas = first.node
          const ctx = canvas.getContext('2d')
          const dpr = Math.min(3, (wx.getSystemInfoSync().pixelRatio || 2))
          const W = SHARE_POSTER_W
          const H = SHARE_POSTER_H
          canvas.width = W * dpr
          canvas.height = H * dpr
          ctx.scale(dpr, dpr)
          drawSharePoster(ctx, match)
          wx.canvasToTempFilePath(
            {
              canvas,
              x: 0,
              y: 0,
              width: W,
              height: H,
              destWidth: W * dpr,
              destHeight: H * dpr,
              fileType: 'jpg',
              quality: 0.92,
              success: (r) => resolve(toText(r.tempFilePath)),
              fail: () => resolve(''),
            },
            this,
          )
        })
    })
  },

  onTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (!tab) return
    this.setData({ activeTab: tab, pageScrollTop: 0 })
  },

  onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st !== this.data.pageScrollTop) {
      this.setData({ pageScrollTop: st })
    }
  },






  onTapRegList() {
    const matchId = toText(this.data.matchId)
    if (!matchId) return
    wx.navigateTo({
      url: `/pages/match/signList/index?id=${encodeURIComponent(matchId)}`,
    })
  },

  onTapOrganizer() {
    const openId = toText(this.data.organizer && this.data.organizer.openId)
    if (!openId) return
    wx.navigateTo({ url: `/pages/user/person/index?openId=${encodeURIComponent(openId)}` })
  },

  /** 球费结算：人员直接带这场比赛报名名单 */
  onGoCost() {
    const matchId = toText(this.data.matchId)
    if (!matchId) return
    wx.navigateTo({ url: `/pages/cost/index?matchId=${encodeURIComponent(matchId)}` })
  },

  onJoinMatch() {
    if (this.data.joining) return
    const matchId = toText(this.data.matchId)
    const match = this.data.match || {}
    if (Number(match.statusCode) !== 1) {
      wx.showToast({ title: '当前不可报名', icon: 'none' })
      return
    }
    if (this.data.hasJoined) {
      wx.showToast({ title: '你已报名该比赛', icon: 'none' })
      return
    }
    const joined = Number(match.joined || 0)
    const capacity = Number(match.capacity || 0)
    if (capacity > 0 && joined >= capacity) {
      wx.showToast({ title: '报名人数已满', icon: 'none' })
      return
    }
    const app = getApp()
    const openid = pickOpenId()
    const userInfo = (app && app.globalData && app.globalData.userInfo) || {}
    if (!openid) {
      wx.showToast({ title: '请先登录后再报名', icon: 'none' })
      return
    }
    if (!isProfileCompleted(userInfo)) {
      const shareQuery = this.data.isShareMode ? '&mode=share' : ''
      const returnUrl = encodeURIComponent(
        `/pages/match/details/index?id=${encodeURIComponent(matchId)}${shareQuery}`,
      )
      wx.showModal({
        title: '提示',
        content: '请先完善昵称和头像信息，再报名比赛。',
        confirmText: '去完善',
        success: (res) => {
          if (!res.confirm) return
          wx.navigateTo({
            url: `/pages/user/info/index?from=matchShareJoin&matchId=${encodeURIComponent(matchId)}&returnUrl=${returnUrl}`,
          })
        },
      })
      return
    }
    const payload = {
      matchId: Number(matchId) || matchId,
      userId: openid,
      userName: toText(userInfo.nickName || userInfo.name, '未命名用户'),
      userAvatar: toText(userInfo.avatar),
      status: 1,
    }
    this.setData({ joining: true })
    wx.showLoading({ title: '报名中...', mask: true })
    MATCH_JOIN(payload)
      .then(({ message }) => {
        wx.showToast({
          title: toText(message, '报名成功'),
          icon: 'success',
        })
        return this.fetchMatchDetail(matchId)
      })
      .catch(() => {
        wx.showToast({ title: '报名失败，请稍后重试', icon: 'none' })
      })
      .finally(() => {
        wx.hideLoading()
        this.setData({ joining: false })
      })
  },

  onInviteClub() {
    const clubId = toText(this.data.match && this.data.match.clubId)
    if (!clubId) {
      wx.showToast({ title: '未绑定俱乐部', icon: 'none' })
      return
    }
    const cap = Number(this.data.match.capacity || 0)
    const joined = Number(this.data.match.joined || 0)
    const slots = Math.max(0, cap - joined)
    if (slots <= 0) {
      wx.showToast({ title: '报名人数已满', icon: 'none' })
      return
    }
    this.setData({
      inviteClubVisible: true,
      inviteClubLoading: true,
      inviteMemberList: [],
      inviteSlotsMax: slots,
      inviteClubName: '',
    })
    CLUB_DES({ id: clubId })
      .then((ret) => {
        const payload = ret && typeof ret === 'object' ? ret : {}
        const members = Array.isArray(payload.members) ? payload.members : []
        const club = payload.club && typeof payload.club === 'object' ? payload.club : {}
        const registeredSet = new Set(this.data.registeredOpenIds || [])
        const list = mapClubMembersForInvite(members, registeredSet)
        this.setData({
          inviteMemberList: list,
          inviteClubName: toText(club.name, '俱乐部'),
          inviteClubLoading: false,
        })
      })
      .catch(() => {
        this.setData({ inviteClubLoading: false })
        wx.showToast({ title: '加载成员失败', icon: 'none' })
      })
  },

  onCloseInviteClubModal() {
    if (this.data.inviteClubLoading) return
    this.setData({
      inviteClubVisible: false,
      inviteMemberList: [],
    })
  },

  stopInviteModalBubble() {},

  onToggleInviteMember(e) {
    const openId = toText(e.currentTarget.dataset.openId)
    if (!openId) return
    const list = this.data.inviteMemberList || []
    const idx = list.findIndex((x) => x.openId === openId)
    if (idx < 0) return
    const row = list[idx]
    if (row.disabled) {
      wx.showToast({ title: '已在该比赛中报名', icon: 'none' })
      return
    }
    const max = Number(this.data.inviteSlotsMax || 0)
    const selected = list.filter((x) => x.checked && !x.disabled).length
    const nextChecked = !row.checked
    if (nextChecked && selected >= max) {
      wx.showToast({ title: `最多还可邀请 ${max} 人`, icon: 'none' })
      return
    }
    this.setData({ [`inviteMemberList[${idx}].checked`]: nextChecked })
  },

  onConfirmInviteClub() {
    if (this.data.inviteClubLoading) return
    const list = this.data.inviteMemberList || []
    const openIds = list.filter((x) => x.checked && !x.disabled).map((x) => x.openId)
    if (!openIds.length) {
      wx.showToast({ title: '请选择要邀请的成员', icon: 'none' })
      return
    }
    const matchId = toText(this.data.matchId)
    const clubId = toText(this.data.match && this.data.match.clubId)
    this.setData({ inviteClubVisible: false, inviteMemberList: [] })
    wx.showLoading({ title: '提交中...', mask: true })
    MATCH_INVITE_CLUB_MEMBERS({ matchId, clubId, openIds })
      .then(() => {
        wx.showToast({ title: '邀请成功', icon: 'success' })
        if (matchId) return this.fetchMatchDetail(matchId)
        return null
      })
      .catch(() => {
        wx.showToast({ title: '邀请接口开发中', icon: 'none' })
      })
      .finally(() => {
        wx.hideLoading()
      })
  },

  onCancelMatch() {
    const id = toText(this.data.matchId)
    if (!id) {
      wx.showToast({ title: '赛事ID无效', icon: 'none' })
      return
    }
    wx.showModal({
      title: '取消赛事',
      content: '确认取消当前赛事吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '取消中...', mask: true })
        MATCH_UPDATE_STATUS({ id, status: 5 })
          .then(() => {
            wx.showToast({ title: '赛事已取消', icon: 'success' })
            return this.fetchMatchDetail(id)
          })
          .catch(() => {
            wx.showToast({ title: '取消失败，请稍后重试', icon: 'none' })
          })
          .finally(() => {
            wx.hideLoading()
          })
      },
    })
  },





  onShareAppMessage() {
    const t = this.data.match.title || '比赛'
    const idx = Math.floor(Math.random() * 6) + 1
    const fallback = `/images/share/${idx}.jpg`
    const pathCached = toText(this.data.shareImageUrl)
    const id = toText(this.data.matchId)
    // 没有比赛 id 时分享首页，避免把用户导向一个不存在的详情页
    const basePath = id
      ? `/pages/match/details/index?id=${encodeURIComponent(id)}&mode=share`
      : '/pages/index/index'
    const payload = {
      title: `${t} · 邀请你参赛`,
      path: basePath,
      imageUrl: pathCached || fallback,
    }
    if (pathCached) return payload
    return this.renderSharePoster().then((path) => ({
      ...payload,
      imageUrl: toText(path) || fallback,
    }))
  },
})
