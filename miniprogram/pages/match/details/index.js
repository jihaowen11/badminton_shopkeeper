// pages/match/details/index.js
const {
  MATCH_DES,
  MATCH_UPDATE_STATUS,
  CLUB_DES,
  MATCH_INVITE_CLUB_MEMBERS,
} = require('../../../request/api')

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

function buildMockPairings() {
  const avatarPool = [
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
  ]
  const raw = [
    {
      id: 'p1',
      roundLabel: '第1场',
      left: [
        { id: 'l1', name: '2号徐', avatar: avatarPool[0], isMe: false },
        { id: 'l2', name: '7号大勇', avatar: avatarPool[1], isMe: false },
      ],
      right: [
        { id: 'r1', name: '4号esccry', avatar: avatarPool[2], isMe: true },
        { id: 'r2', name: '5号熊', avatar: avatarPool[3], isMe: false },
      ],
      scoreLeft: 8,
      scoreRight: 21,
    },
    {
      id: 'p2',
      roundLabel: '第2场',
      left: [
        { id: 'l1', name: '1号吕', avatar: avatarPool[0], isMe: false },
        { id: 'l2', name: '6号刘飞', avatar: avatarPool[1], isMe: false },
      ],
      right: [
        { id: 'r1', name: '3号小熊', avatar: avatarPool[2], isMe: false },
        { id: 'r2', name: '4号esccry', avatar: avatarPool[3], isMe: true },
      ],
      scoreLeft: 21,
      scoreRight: 11,
    },
  ]
  return raw.map((p) => {
    const leftPlayers = (p.left || []).slice(0, 2)
    const rightPlayers = (p.right || []).slice(0, 2)
    const winSide =
      Number(p.scoreLeft) === Number(p.scoreRight)
        ? 'draw'
        : Number(p.scoreLeft) > Number(p.scoreRight)
          ? 'left'
          : 'right'
    return {
      id: p.id,
      roundLabel: p.roundLabel,
      leftPlayers,
      rightPlayers,
      leftNameLine1: leftPlayers[0] ? leftPlayers[0].name : '',
      leftNameLine2: leftPlayers[1] ? leftPlayers[1].name : '',
      rightNameLine1: rightPlayers[0] ? rightPlayers[0].name : '',
      rightNameLine2: rightPlayers[1] ? rightPlayers[1].name : '',
      scoreLeft: p.scoreLeft,
      scoreRight: p.scoreRight,
      winSide,
    }
  })
}

function buildMockRankings() {
  const avatarPool = [
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
  ]
  return [
    { id: 'r1', rank: 1, name: '张三', avatar: avatarPool[0], isMe: false, win: 7, lose: 1, diff: 46 },
    { id: 'r2', rank: 2, name: '李四', avatar: avatarPool[1], isMe: false, win: 5, lose: 2, diff: 36 },
    { id: 'r3', rank: 3, name: '王五', avatar: avatarPool[2], isMe: true, win: 4, lose: 3, diff: 8 },
  ]
}

Page({
  data: {
    matchId: '',
    pageScrollTop: 0,
    activeTab: 'match',
    match: {},
    organizer: {},
    regPreview: [],
    pairings: [],
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
  },

  onLoad(options) {
    const id = options.id ? String(options.id) : 'm3'
    this.setData({
      matchId: id,
      pairings: buildMockPairings(),
      rankings: buildMockRankings(),
    })
    this.fetchMatchDetail(id)
  },

  fetchMatchDetail(id) {
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
        this.setData(
          {
            match: mappedMatch,
            organizer: mapOrganizer(payload.organizer),
            regPreview: mapRegPreview(participants),
            pairings: buildMockPairings(),
            rankings: buildMockRankings(),
            canManageFooter,
            showInviteClub,
            shareImageUrl: '',
            registeredOpenIds,
          },
          () => {
            setTimeout(() => {
              this.renderSharePoster()
                .then((path) => {
                  if (path) this.setData({ shareImageUrl: path })
                })
                .catch(() => {})
            }, 80)
          },
        )
        return ret
      })
      .catch(() => null)
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
    wx.showToast({ title: '报名列表开发中', icon: 'none' })
  },

  onTapOrganizer() {
    const openId = toText(this.data.organizer && this.data.organizer.openId)
    if (!openId) return
    wx.navigateTo({ url: `/pages/user/person/index?openId=${encodeURIComponent(openId)}` })
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
        wx.showToast({ title: '邀请已提交', icon: 'success' })
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
    const id = toText(this.data.matchId) || 'm3'
    const basePath = `/pages/match/details/index?id=${encodeURIComponent(id)}&mode=share`
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
