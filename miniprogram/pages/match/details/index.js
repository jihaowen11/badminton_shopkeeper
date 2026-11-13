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
  MATCH_ROUNDS_SUBMIT_SCORE,
  MATCH_ROUNDS_CLEAR_SCORE,
} = require('../../../request/api')
const { pickOpenId } = require('../../../utils/auth')
const { pad2, toText } = require('../../../utils/format')
const { toAvatarUrl, toStaticUrl, DEFAULT_AVATAR } = require('../../../utils/static')
const { createScrollSync } = require('../../../utils/scrollSync')
const { requireProfile, isProfileComplete, getCurrentUser } = require('../../../utils/profile')

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

/**
 * 状态配色表：角标、底部状态按钮、分享海报共用一套
 * 绿=报名中 蓝=进行中 灰=已结束 橙=中断 红=已取消
 */
const STATUS_COLOR = {
  open: '#0a8f3e',
  playing: '#1677ff',
  end: '#8a929b',
  interrupted: '#d9860a',
  cancelled: '#d04343',
}

/**
 * 状态文案 + 配色键
 * status 仍只分 open/end（底部按钮、状态条沿用这层语义），
 * statusKey 单独上色，和比赛列表保持同一套颜色。
 */
function mapStatus(status) {
  const s = Number(status)
  if (s === 1) return { status: 'open', statusKey: 'open', statusText: '报名中', actionText: '我要报名' }
  if (s === 2) return { status: 'open', statusKey: 'playing', statusText: '进行中', actionText: '进行中' }
  if (s === 3) return { status: 'end', statusKey: 'end', statusText: '已结束', actionText: '已结束' }
  if (s === 4) return { status: 'end', statusKey: 'interrupted', statusText: '中断', actionText: '已中断' }
  if (s === 5) return { status: 'end', statusKey: 'cancelled', statusText: '已取消', actionText: '已取消' }
  return { status: 'open', statusKey: 'open', statusText: '报名中', actionText: '我要报名' }
}

function mapOrganizer(organizer) {
  const name = toText(organizer && (organizer.nickName || organizer.name), '组织者')
  return {
    openId: toText(organizer && organizer.openId),
    name,
    abbr: name.slice(0, 1),
    tone: 'orange',
    avatarUrl: toStaticUrl(organizer && organizer.avatar),
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
      avatarUrl: toStaticUrl((user && user.avatar) || p.userAvatar),
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
    statusKey: statusView.statusKey,
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
    sessions,
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
      avatarUrl: toStaticUrl(user.avatar || (m && m.userAvatar)),
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

/**
 * 邀请弹层的名额说明
 *
 * 之前这里写死「最多可选 N 人（计划 X 人，已报 Y 人）」，勾选时又提示
 * 「最多还可邀请 N 人」——把总名额说成剩余名额，选满后再点就变成
 * 「最多还可邀请 7 人」这种自相矛盾的话。这里统一按"剩余"计算。
 *
 * @param {number} max 还可邀请人数，0 表示不限人数
 * @param {number} selected 已勾选人数
 * @param {number} capacity 计划人数
 * @param {number} joined 已报名人数
 * @param {boolean} selfJoined 当前用户是否已在报名名单里（创建者会自动报名，占 1 个名额）
 */
function buildInviteTip(max, selected, capacity, joined, selfJoined) {
  const picked = Math.max(0, Number(selected) || 0)
  const parts = []
  if (max > 0) {
    const left = Math.max(0, max - picked)
    parts.push(left > 0 ? `还可邀请 ${left} 人` : '名额已选满')
    parts.push(`计划 ${capacity} 人，已报 ${joined} 人${selfJoined ? '（含你本人）' : ''}`)
  } else {
    parts.push('报名人数不限')
  }
  if (picked > 0) parts.push(`已选 ${picked} 人`)
  return parts.join(' · ')
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
  const pillW = 100
  const pillH = 32
  const pillX = cardX + cardW - pillW - 16
  const pillY = cardY + 16
  // 海报上的状态胶囊也跟页面同一套颜色
  ctx.fillStyle = STATUS_COLOR[match.statusKey] || (code === 1 || code === 2 ? STATUS_COLOR.open : STATUS_COLOR.end)
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
    avatar: toAvatarUrl(p && p.avatar),
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
    // 轮空名单不在对阵页展示，这里不再映射 resting/restingText
    return {
      no: rd.no,
      label: toText(rd.label, `第${rd.no}轮`),
      courts,
    }
  })
}

/**
 * 能开几片场地：一片场地要 4 个人，人不够就只能开 1 片
 */
function maxCourtsOf(joined) {
  const n = Number(joined) || 0
  return Math.max(1, Math.floor(n / 4))
}

/**
 * 推荐轮数：与后端 /matchRounds/generate 的默认算法保持一致
 * - 有计划场次：计划场次 ÷ 场地片数（向上取整）
 * - 没有计划场次：按"每人打满 n-1 场"反推总场次，再除以场地片数
 */
function recommendRounds(joined, sessions, courts) {
  const n = Number(joined) || 0
  if (n < 4) return 1
  const c = Math.max(1, Math.min(maxCourtsOf(n), Number(courts) || 1))
  const planned = Number(sessions) || 0
  if (planned > 0) return Math.max(1, Math.ceil(planned / c))
  const idealTotal = (n * (n - 1)) / 4
  return Math.max(1, Math.round(idealTotal / c))
}

/** 弹层副标题：说清每轮几个人打、几个人轮空 */
function buildPickerHint(joined, courts) {
  const n = Number(joined) || 0
  const c = Math.max(1, Number(courts) || 1)
  const playing = Math.min(n, c * 4)
  const resting = Math.max(0, n - playing)
  const parts = [`已报名 ${n} 人`, `每轮 ${playing} 人上场`]
  if (resting > 0) parts.push(`${resting} 人轮空`)
  return parts.join(' · ')
}

/**
 * 简单的计分判定：先到目标分、且净胜 2 分即算赢。
 * 业余局够用，不去纠缠 30 分封顶这类细节。
 * @returns {''|'team1'|'team2'}
 */
function winnerOf(left, right, rule) {
  const target = Math.max(1, Number(rule) || 21)
  const l = Number(left) || 0
  const r = Number(right) || 0
  if (l >= target && l - r >= 2) return 'team1'
  if (r >= target && r - l >= 2) return 'team2'
  return ''
}

/** 一队两名球员的名字，用 / 连接 */
function teamNameText(players) {
  const list = Array.isArray(players) ? players : []
  const names = list.map((p) => toText(p && p.name)).filter(Boolean)
  return names.length ? names.join(' / ') : '待定'
}

/** 一队球员头像数组（计分弹层按人头并排显示） */
function teamAvatarList(players) {
  const list = Array.isArray(players) ? players : []
  if (!list.length) return [DEFAULT_AVATAR]
  return list.map((p) => toAvatarUrl(p && p.avatar))
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
      avatar: toAvatarUrl(item && item.avatar),
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
    scheduleMeta: { generated: false, totalRounds: 0, totalMatches: 0, finishedMatches: 0, courts: 0, currentRound: 0 },
    /** 当前用户是否可生成/重排排期（组织者） */
    canGenerate: false,
    scheduleLoading: true,
    generating: false,
    /** 排期轮数选择弹层 */
    roundPickerVisible: false,
    roundPick: 14,
    roundPickDefault: 14,
    roundPickMax: 20,
    /** 场地片数，默认 1 片，可在弹层里加减 */
    roundPickCourts: 1,
    roundPickCourtsMax: 1,
    roundPickTotal: 14,
    roundPickForce: false,
    roundPickHint: '',
    /** 场次计分弹层 */
    scoreVisible: false,
    scoreRoundId: 0,
    scoreTitle: '',
    scoreSubTitle: '',
    scoreTeam1Text: '',
    scoreTeam2Text: '',
    /** 左右两栏只显示头像（两人并排），名字只在「获胜」提示里出现 */
    scoreTeam1Avatars: [],
    scoreTeam2Avatars: [],
    scoreLeft: 0,
    scoreRight: 0,
    scoreRule: 21,
    /** 长按连加时高亮哪一侧：'' | 'team1' | 'team2' */
    scorePressing: '',
    /** '' | 'team1' | 'team2'，达到结束条件时高亮并给出提示 */
    scoreWinner: '',
    scoreWinnerText: '',
    /** 该场已有比分（决定按钮文案与是否可撤销） */
    scoreSaved: false,
    scoreCanUndo: false,
    scoreSaving: false,
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
    /** 计划人数 - 已报名人数，即本次最多可选人数；0 表示不限人数 */
    inviteSlotsMax: 0,
    /** 当前已勾选人数 */
    inviteSelected: 0,
    /** 弹层顶部的名额说明（由名额与勾选数算出，避免 wxml 里做算术） */
    inviteTip: '',
    /** 从分享链接进入 */
    isShareMode: false,
    /** 详情拉取失败（分享卡片指向的比赛可能已被取消或删除） */
    loadFailed: false,
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
    // 详情与排期互不依赖，并行走：首屏少等一个往返
    this._skipNextSchedule = true
    this.fetchMatchDetail(id)
    this.fetchSchedule(id)
    if (isShareMode) {
      MATCH_INCREMENT_VIEWS({ id }).catch(() => {})
    }
  },

  onShow() {
    if (!this._pageReady) {
      this._pageReady = true
      return
    }
    // 从资料页回来且资料刚补齐：先把上次被拦的报名继续做完，避免二次点击
    if (this._pendingJoin) {
      this._pendingJoin = false
      if (isProfileComplete(getCurrentUser())) {
        this.onJoinMatch()
        return
      }
    }
    const id = toText(this.data.matchId)
    if (id) {
      this.fetchMatchDetail(id, { refreshPoster: false })
    }
  },

  onHide() {
    // 页面切走时别让连加计时器继续跑
    this.clearScorePress()
  },

  onUnload() {
    this.clearScorePress()
  },

  fetchMatchDetail(id, options) {
    const opts = options && typeof options === 'object' ? options : {}
    const refreshPoster = opts.refreshPoster !== false
    // 首次进入时排期已经和详情并行拉过了，这里不再重复请求
    const skipSchedule = !!this._skipNextSchedule
    this._skipNextSchedule = false
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
          loadFailed: false,
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
        if (!skipSchedule) this.fetchSchedule(id)
        return ret
      })
      .catch(() => {
        // 分享卡片可能指向已被删除的比赛：给出明确空态，别停在空白骨架
        if (!this.data.match || !this.data.match.id) {
          this.setData({ loadFailed: true })
        }
        return null
      })
  },

  /** 空态里的"回到首页"：分享页往往没有上一页，直接切 tab */
  onBackHome() {
    wx.switchTab({
      url: '/pages/index/index',
      fail: () => {
        wx.reLaunch({ url: '/pages/index/index' })
      },
    })
  },

  /** 拉取排期与排名 */
  fetchSchedule(id) {
    if (!id) return Promise.resolve(null)
    this.setData({ scheduleLoading: true })
    return MATCH_ROUNDS_LIST({ matchId: id })
      .then((ret) => {
        const payload = ret && typeof ret === 'object' ? ret : {}
        const currentOpenId = pickOpenId()
        const rounds = mapSchedule(payload, currentOpenId)
        // 当前轮 = 第一个还有没打完场次的轮；全部打完则为 0（不显示定位与高亮）
        let currentRound = 0
        for (const rd of rounds) {
          if (rd.courts.some((c) => !c.done)) {
            currentRound = rd.no
            break
          }
        }
        rounds.forEach((rd) => {
          rd.isCurrent = rd.no === currentRound
        })
        this.setData({
          scheduleRounds: rounds,
          rankings: mapRankings(payload.rankings, currentOpenId),
          canGenerate: !!payload.canManage,
          scheduleMeta: {
            generated: !!payload.generated,
            totalRounds: Number(payload.totalRounds) || 0,
            totalMatches: Number(payload.totalMatches) || 0,
            finishedMatches: Number(payload.finishedMatches) || 0,
            courts: Number(payload.courts) || 0,
            currentRound,
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

  /** 生成排期（组织者）：先选轮数 */
  onGenerateSchedule() {
    if (this.data.generating) return
    const id = toText(this.data.matchId)
    if (!id) return
    const joined = Number(this.data.match && this.data.match.joined) || 0
    if (joined < 4) {
      wx.showToast({ title: '至少 4 人报名才能排期', icon: 'none' })
      return
    }
    this.openRoundPicker(false)
  },

  /** 重新排期：已有比分时在确认生成这一步再拦一次 */
  onRegenerate() {
    if (this.data.generating) return
    const id = toText(this.data.matchId)
    if (!id) return
    this.openRoundPicker(true)
  },

  /**
   * 打开轮数选择弹层
   * @param {boolean} force 重新排期（需要覆盖已有比分）
   */
  openRoundPicker(force) {
    const match = this.data.match || {}
    const joined = Number(match.joined) || 0
    if (joined < 4) {
      wx.showToast({ title: '至少 4 人报名才能排期', icon: 'none' })
      return
    }
    const maxCourts = maxCourtsOf(joined)
    // 默认 1 片场地；重排时沿用当前排期用的片数，避免"只想改轮数"却被重置
    const existingCourts = Number(this.data.scheduleMeta.courts) || 0
    const courts = force && existingCourts > 0 ? Math.min(existingCourts, maxCourts) : 1
    const recommend = recommendRounds(joined, match.sessions, courts)
    // 重排时默认回到当前排期轮数，避免"我只是想改个轮数"却从推荐值重算
    const existing = Number(this.data.scheduleMeta.totalRounds) || 0
    const initial = force && existing > 0 ? existing : recommend
    this.setData({
      roundPickerVisible: true,
      roundPickForce: !!force,
      roundPickDefault: recommend,
      roundPick: initial,
      roundPickCourts: courts,
      roundPickCourtsMax: maxCourts,
      roundPickMax: Math.max(recommend * 2, initial, 20),
      roundPickTotal: initial * courts,
      roundPickHint: buildPickerHint(joined, courts),
    })
  },

  /** 调整场地片数：片数变了，推荐轮数跟着变（总场次不变，只是每轮多开几场） */
  onCourtStep(e) {
    const dir = Number(e.currentTarget.dataset.dir) || 0
    const max = Number(this.data.roundPickCourtsMax) || 1
    const current = Number(this.data.roundPickCourts) || 1
    let next = current + dir
    if (next < 1) next = 1
    if (next > max) next = max
    if (next === current) {
      if (dir > 0) {
        const joined = Number(this.data.match && this.data.match.joined) || 0
        wx.showToast({ title: `${joined} 人最多开 ${max} 片场地`, icon: 'none' })
      }
      return
    }
    const match = this.data.match || {}
    const joined = Number(match.joined) || 0
    const recommend = recommendRounds(joined, match.sessions, next)
    this.setData({
      roundPickCourts: next,
      roundPickDefault: recommend,
      roundPick: recommend,
      roundPickMax: Math.max(recommend * 2, 20),
      roundPickTotal: recommend * next,
      roundPickHint: buildPickerHint(joined, next),
    })
  },

  onRoundStep(e) {
    const dir = Number(e.currentTarget.dataset.dir) || 0
    const max = Number(this.data.roundPickMax) || 20
    const courts = Number(this.data.roundPickCourts) || 1
    let next = (Number(this.data.roundPick) || 1) + dir
    if (next < 1) next = 1
    if (next > max) next = max
    if (next === this.data.roundPick) return
    this.setData({ roundPick: next, roundPickTotal: next * courts })
  },

  onRoundReset() {
    const def = Number(this.data.roundPickDefault) || 1
    const courts = Number(this.data.roundPickCourts) || 1
    this.setData({ roundPick: def, roundPickTotal: def * courts })
  },

  onCloseRoundPicker() {
    if (this.data.generating) return
    this.setData({ roundPickerVisible: false })
  },

  onConfirmRoundPick() {
    if (this.data.generating) return
    const rounds = Number(this.data.roundPick) || 0
    const courts = Number(this.data.roundPickCourts) || 1
    const force = !!this.data.roundPickForce
    this.setData({ roundPickerVisible: false })
    const finished = Number(this.data.scheduleMeta.finishedMatches) || 0
    if (finished > 0) {
      wx.showModal({
        title: '重新排期',
        content: `已有 ${finished} 场录入比分，重新排期会同时清空这些比分，确定继续吗？`,
        confirmText: '重新排期',
        success: (res) => {
          if (res.confirm) this.generateSchedule(rounds, true, courts)
        },
      })
      return
    }
    this.generateSchedule(rounds, force, courts)
  },

  /** 真正发起排期请求 */
  generateSchedule(rounds, force, courts) {
    const id = toText(this.data.matchId)
    if (!id || this.data.generating) return
    const payload = { matchId: id }
    // 不传 rounds 时后端按计划场次自己推算，这里只在用户明确选过时才带上
    if (rounds > 0) payload.rounds = rounds
    if (courts > 0) payload.courts = courts
    if (force) payload.force = true

    this.setData({ generating: true })
    wx.showLoading({ title: '排期中...', mask: true })
    MATCH_ROUNDS_GENERATE(payload)
      .then(() => {
        wx.showToast({ title: rounds > 0 ? `已生成 ${rounds} 轮` : '排期已生成', icon: 'success' })
        return this.fetchSchedule(id)
      })
      .then(() => this.fetchMatchDetail(id, { refreshPoster: false }))
      .catch(() => {})
      .finally(() => {
        wx.hideLoading()
        this.setData({ generating: false })
      })
  },

  /** 撤销单场比分（组织者） */
  onClearScore(e) {
    const roundId = e.currentTarget.dataset.roundId
    const id = toText(this.data.matchId)
    if (!roundId || !id) return
    wx.showModal({
      title: '撤销比分',
      content: '撤销后该场回到未开赛状态，排名会同步更新。确定撤销吗？',
      confirmText: '撤销',
      confirmColor: '#e02020',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...', mask: true })
        MATCH_ROUNDS_CLEAR_SCORE({ roundId })
          .then(() => {
            wx.showToast({ title: '比分已撤销', icon: 'success' })
            return this.fetchSchedule(id)
          })
          .catch(() => {})
          .finally(() => wx.hideLoading())
      },
    })
  },

  /** 滚动到当前轮 */
  onLocateCurrentRound() {
    const no = Number(this.data.scheduleMeta.currentRound) || 0
    if (!no) return
    const query = wx.createSelectorQuery()
    query.select(`#round-no-${no}`).boundingClientRect()
    query.selectViewport().scrollOffset()
    query.exec((res) => {
      const rect = res && res[0]
      const viewport = res && res[1]
      if (!rect || !viewport) return
      // 留出顶部导航与标签栏的高度，别让轮次标题贴边
      const top = rect.top + (viewport.scrollTop || 0) - 110
      wx.pageScrollTo({ scrollTop: Math.max(0, top), duration: 260 })
    })
  },

  /** 点击某场：在当前页面打开计分弹层 */
  onTapRound(e) {
    const roundId = e.currentTarget.dataset.roundId
    const idx = Number(e.currentTarget.dataset.index)
    const rdIdx = Number(e.currentTarget.dataset.roundIndex)
    if (!roundId) return
    // 比赛结束后比分锁死，后端也会拦，这里提前给个明确提示
    const statusCode = Number(this.data.match && this.data.match.statusCode)
    if (statusCode === 3 || statusCode === 5) {
      wx.showToast({ title: '比赛已结束，比分不可修改', icon: 'none' })
      return
    }
    const round = this.data.scheduleRounds[rdIdx]
    const court = round && round.courts ? round.courts[idx] : null
    if (!court) return
    if (!court.canEdit) {
      wx.showToast({ title: '只有组织者或本场参赛者可以记分', icon: 'none' })
      return
    }
    this.openScoreSheet(round, court)
  },

  /** 打开计分弹层，带入已有比分 */
  openScoreSheet(round, court) {
    const rule =
      Number(this.data.scheduleMeta.targetScore) ||
      Number(this.data.match && this.data.match.targetScore) ||
      21
    const done = !!court.done
    const left = done ? Number(court.scoreLeft) || 0 : 0
    const right = done ? Number(court.scoreRight) || 0 : 0
    const t1 = teamNameText(court.team1Players)
    const t2 = teamNameText(court.team2Players)
    const winner = winnerOf(left, right, rule)
    const formatText = toText(this.data.match.formatLine)
    this.clearScorePress()
    this.setData({
      scoreVisible: true,
      scoreRoundId: court.roundId,
      scoreTitle: `第${round.no}轮 · ${court.courtNo}号场`,
      scoreSubTitle: `${formatText || `${rule} 分制`} · 净胜 2 分才算赢`,
      scoreTeam1Text: t1,
      scoreTeam2Text: t2,
      scoreTeam1Avatars: teamAvatarList(court.team1Players),
      scoreTeam2Avatars: teamAvatarList(court.team2Players),
      scoreLeft: left,
      scoreRight: right,
      scoreRule: rule,
      scoreWinner: winner,
      scoreWinnerText: winner === 'team1' ? `${t1} 获胜` : winner === 'team2' ? `${t2} 获胜` : '',
      scoreSaved: done,
      // 有比分 + （组织者或本场参赛者）才能撤销，与后端 canTouchRound 保持一致
      scoreCanUndo: done && (!!court.canEdit || !!this.data.canGenerate),
      scoreSaving: false,
      scorePressing: '',
    })
  },

  /**
   * 改比分（点按与长按共用）
   * @returns {boolean} 是否还能继续加/减（到 0、到 99、或这一按刚把这局打完时返回 false）
   */
  applyScore(side, dir) {
    const key = side === 'team1' ? 'scoreLeft' : 'scoreRight'
    const current = Number(this.data[key]) || 0
    let next = current + dir
    if (next < 0) next = 0
    // 后端最多接受到 99 分
    if (next > 99) next = 99
    if (next === current) return false
    const left = side === 'team1' ? next : Number(this.data.scoreLeft) || 0
    const right = side === 'team2' ? next : Number(this.data.scoreRight) || 0
    const winner = winnerOf(left, right, this.data.scoreRule)
    const t1 = this.data.scoreTeam1Text
    const t2 = this.data.scoreTeam2Text
    this.setData({
      [key]: next,
      scoreWinner: winner,
      scoreWinnerText: winner === 'team1' ? `${t1} 获胜` : winner === 'team2' ? `${t2} 获胜` : '',
    })
    // 长按连加时，刚好打完这局就自动停下，避免一路冲到 30 多分。
    // 用「胜负方是否变化」判断，这样 21:19 已保存的场次继续加也不会一按下就被掐断。
    const press = this._press
    if (press && winner && winner !== press.winnerBefore) return false
    return true
  },

  /** 比分加减：data-side=team1|team2，data-dir=1|-1 */
  onScoreStep(e) {
    // 长按已经连续加过分，抬手后系统补发的这次 tap 要丢掉，否则会多加 1 分
    if (this._suppressTap) {
      this._suppressTap = false
      return
    }
    const ds = e.currentTarget.dataset || {}
    const side = ds.side === 'team2' ? 'team2' : 'team1'
    const dir = Number(ds.dir) || 0
    if (!dir) return
    this.applyScore(side, dir)
  },

  /** 长按开始：按住 350ms 后以 100ms/ 分的节奏连加，抬手即停 */
  onScorePressStart(e) {
    const ds = e.currentTarget.dataset || {}
    const side = ds.side === 'team2' ? 'team2' : 'team1'
    const dir = Number(ds.dir) || 0
    this._suppressTap = false
    this.clearScorePress()
    if (!dir || this.data.scoreSaving) return

    const press = {
      side,
      dir,
      delay: null,
      repeat: null,
      longPressed: false,
      // 按下瞬间是否已经分出胜负：用于判断「这一按是否刚打完这局」
      winnerBefore: this.data.scoreWinner,
    }
    this._press = press

    press.delay = setTimeout(() => {
      if (this._press !== press) return
      press.longPressed = true
      this.setData({ scorePressing: side })
      this.vibrate('light')
      press.repeat = setInterval(() => {
        if (this._press !== press) return
        if (this.applyScore(side, dir)) return
        // 到 0 / 到 99 / 本局已分出胜负，自动停止连加
        this.vibrate('medium')
        this.stopScorePressTimer(press)
      }, 100)
    }, 350)
  },

  /** 长按结束（抬手或手指移出控件） */
  onScorePressEnd() {
    const press = this._press
    if (!press) return
    // 连加过就吞掉随后补发的 tap；只是短按则让 tap 正常加 1 分
    this._suppressTap = !!press.longPressed
    this.clearScorePress()
  },

  /** 只停计时器、保留 press 引用，让抬手时仍能判断「刚才是不是长按」 */
  stopScorePressTimer(press) {
    if (!press) return
    if (press.delay) {
      clearTimeout(press.delay)
      press.delay = null
    }
    if (press.repeat) {
      clearInterval(press.repeat)
      press.repeat = null
    }
    if (this.data.scorePressing) this.setData({ scorePressing: '' })
  },

  /** 彻底清理按压状态（关弹层、清零、重新打开时调用） */
  clearScorePress() {
    const press = this._press
    if (press) this.stopScorePressTimer(press)
    this._press = null
    if (this.data.scorePressing) this.setData({ scorePressing: '' })
  },

  /** 轻震动反馈，旧版本没有该 API 时静默跳过 */
  vibrate(type) {
    if (typeof wx.vibrateShort !== 'function') return
    wx.vibrateShort({ type, fail() {} })
  },

  /** 清零重记 */
  onScoreReset() {
    if (this.data.scoreSaving) return
    this.clearScorePress()
    this.setData({
      scoreLeft: 0,
      scoreRight: 0,
      scoreWinner: '',
      scoreWinnerText: '',
      scorePressing: '',
    })
  },

  onCloseScore() {
    if (this.data.scoreSaving) return
    this.clearScorePress()
    this.setData({ scoreVisible: false, scorePressing: '' })
  },

  /** 保存比分（不能平局，不能 0:0） */
  onScoreSave() {
    if (this.data.scoreSaving) return
    const roundId = Number(this.data.scoreRoundId) || 0
    const s1 = Number(this.data.scoreLeft) || 0
    const s2 = Number(this.data.scoreRight) || 0
    if (!roundId) return
    if (s1 === 0 && s2 === 0) {
      wx.showToast({ title: '还没有记分', icon: 'none' })
      return
    }
    if (s1 === s2) {
      wx.showToast({ title: '羽毛球没有平局，请核对比分', icon: 'none' })
      return
    }
    this.setData({ scoreSaving: true })
    this.clearScorePress()
    MATCH_ROUNDS_SUBMIT_SCORE({ roundId, team1Score: s1, team2Score: s2 })
      .then(() => {
        wx.showToast({ title: '比分已保存', icon: 'success' })
        this.setData({ scoreVisible: false, scoreSaving: false })
        const id = toText(this.data.matchId)
        // 保存会推进比赛状态（报名中 → 进行中），详情和排期一起刷新
        if (id) this.fetchMatchDetail(id, { refreshPoster: false })
      })
      .catch(() => {
        this.setData({ scoreSaving: false })
      })
  },

  /** 弹层内撤销比分 */
  onScoreUndo() {
    if (this.data.scoreSaving) return
    const roundId = Number(this.data.scoreRoundId) || 0
    const id = toText(this.data.matchId)
    if (!roundId || !id) return
    wx.showModal({
      title: '撤销比分',
      content: '撤销后该场回到未开赛状态，排名会同步更新。确定撤销吗？',
      confirmText: '撤销',
      confirmColor: '#e02020',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ scoreSaving: true })
        MATCH_ROUNDS_CLEAR_SCORE({ roundId })
          .then(() => {
            wx.showToast({ title: '比分已撤销', icon: 'success' })
            this.setData({ scoreVisible: false, scoreSaving: false })
            this.fetchMatchDetail(id, { refreshPoster: false })
          })
          .catch(() => {
            this.setData({ scoreSaving: false })
          })
      },
    })
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

  onPageScroll: createScrollSync('pageScrollTop', 10),






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
      // 新用户从分享进来时首次登录可能失败，这里补一次重登并自动重试，别让按钮变成死路
      const app0 = getApp()
      if (!this._loginRetried && app0 && typeof app0.relogin === 'function') {
        this._loginRetried = true
        app0.relogin().then(() => this.onJoinMatch())
        return
      }
      wx.showToast({ title: '请先登录后再报名', icon: 'none' })
      return
    }
    // 资料闸门：头像或昵称任一项完善即可，两项都是默认值才拦。
    // 记一笔待续动作，用户从资料页回来时自动把报名继续做完
    if (
      !requireProfile('报名比赛', {
        onNeed: () => {
          this._pendingJoin = true
        },
      })
    )
      return
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
    // 计划人数未设置时不限制名额，不能按"已满"拦掉
    if (cap > 0 && joined >= cap) {
      wx.showToast({ title: `报名名额已满（${joined}/${cap} 人）`, icon: 'none' })
      return
    }
    const slots = cap > 0 ? Math.max(0, cap - joined) : 0
    this.setData({
      inviteClubVisible: true,
      inviteClubLoading: true,
      inviteMemberList: [],
      inviteSlotsMax: slots,
      inviteSelected: 0,
      inviteTip: buildInviteTip(slots, 0, cap, joined, !!this.data.hasJoined),
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
      inviteSelected: 0,
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
    if (nextChecked && max > 0 && selected >= max) {
      // 这里必须说"剩余"，之前的「最多还可邀请 max 人」把总名额当成了剩余名额
      wx.showToast({ title: `名额已满，最多邀请 ${max} 人`, icon: 'none' })
      return
    }
    const nextSelected = nextChecked ? selected + 1 : Math.max(0, selected - 1)
    this.setData({
      [`inviteMemberList[${idx}].checked`]: nextChecked,
      inviteSelected: nextSelected,
      inviteTip: buildInviteTip(
        max,
        nextSelected,
        Number(this.data.match && this.data.match.capacity) || 0,
        Number(this.data.match && this.data.match.joined) || 0,
        !!this.data.hasJoined
      ),
    })
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
    this.setData({ inviteClubVisible: false, inviteMemberList: [], inviteSelected: 0 })
    wx.showLoading({ title: '提交中...', mask: true })
    MATCH_INVITE_CLUB_MEMBERS({ matchId, clubId, openIds })
      .then((ret) => {
        const created = ret && Array.isArray(ret.created) ? ret.created.length : openIds.length
        const skipped = ret && Array.isArray(ret.skipped) ? ret.skipped : []
        const full = skipped.filter((x) => x && x.reason === '名额已满').length
        const other = skipped.length - full
        if (created === 0) {
          wx.showToast({ title: full ? '报名名额已满' : '这些人已在报名名单中', icon: 'none' })
        } else if (skipped.length) {
          const extra = full ? `，${full} 人因名额已满未加入` : `，${other} 人未加入`
          wx.showToast({ title: `已邀请 ${created} 人${extra}`, icon: 'none' })
        } else {
          wx.showToast({ title: `已邀请 ${created} 人`, icon: 'success' })
        }
        if (matchId) return this.fetchMatchDetail(matchId)
        return null
      })
      .catch(() => {
        // 具体失败原因由请求层统一提示（后端的 message 会原样弹出），
        // 这里以前写死「邀请接口开发中」，接口真报错时反而误导人。
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
    const m = this.data.match || {}
    const t = toText(m.title) || '羽球局'
    const when = toText(m.dateLine)
    const where = toText(m.clubLine)
    const ctx = [when, where].filter(Boolean).join(' · ')
    const idx = Math.floor(Math.random() * 6) + 1
    const fallback = `/images/share/${idx}.jpg`
    const pathCached = toText(this.data.shareImageUrl)
    const id = toText(this.data.matchId)
    // 没有比赛 id 时分享首页，避免把用户导向一个不存在的详情页
    const basePath = id
      ? `/pages/match/details/index?id=${encodeURIComponent(id)}&mode=share`
      : '/pages/index/index'
    const payload = {
      title: ctx ? `${ctx} · ${t}，邀你参赛` : `${t} · 邀你参赛`,
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
