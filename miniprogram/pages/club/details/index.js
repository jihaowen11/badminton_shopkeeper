// pages/club/details/index.js
const { CLUB_DES, DEL_CLUB, INVITE_CLUB, EXIT_CLUB, SET_ADMIN, REMOVE_ADMIN, CLUB_FEED } = require('../../../request/api')
const { pickOpenId } = require('../../../utils/auth')
const { toText } = require('../../../utils/format')
const { toStaticUrl, toAvatarUrl } = require('../../../utils/static')
const { createScrollSync } = require('../../../utils/scrollSync')
const { requireProfile, isProfileComplete, getCurrentUser } = require('../../../utils/profile')
const { brandCard, randomShareImage } = require('../../../utils/shareCard')

function toAbbr(text) {
  return toText(text, '俱').slice(0, 1).toUpperCase()
}

function formatCreateMonth(createdAt) {
  if (createdAt == null || createdAt === '') return '创建时间: 未知'
  const raw = typeof createdAt === 'number' && createdAt < 1e12 ? createdAt * 1000 : createdAt
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '创建时间: 未知'
  return `创建时间: ${d.getFullYear()}年${d.getMonth() + 1}月`
}

function toRoleView(role) {
  const r = toText(role).toLowerCase()
  if (r === 'owner') return { roleType: 'owner', roleText: '会长' }
  if (r === 'admin') return { roleType: 'admin', roleText: '管理员' }
  return { roleType: 'member', roleText: '成员' }
}

function mapMembersToView(rawMembers) {
  const rows = Array.isArray(rawMembers) ? rawMembers : []
  const mapped = rows.map((m, index) => {
    const user = m && typeof m.user === 'object' ? m.user : {}
    const role = toRoleView(m && m.role)
    const name = toText(user.nickName || (m && m.userName), `成员${index + 1}`)
    const g = Number(user.gender)
    const gender = g === 1 ? 'male' : g === 2 ? 'female' : 'unknown'
    return {
      id: m && m.id != null ? String(m.id) : `member_${index}`,
      userId: toText((m && m.userId) || user.openId),
      name,
      abbr: toAbbr(name),
      avatarUrl: toStaticUrl(user.avatar || (m && m.userAvatar)),
      roleType: role.roleType,
      roleText: role.roleText,
      gender,
      level: toText(user.badmintonLevel, '未定级'),
    }
  })
  const roleWeight = { owner: 0, admin: 1, member: 2 }
  mapped.sort((a, b) => {
    const wa = roleWeight[a.roleType] != null ? roleWeight[a.roleType] : 99
    const wb = roleWeight[b.roleType] != null ? roleWeight[b.roleType] : 99
    if (wa !== wb) return wa - wb
    return 0
  })
  return mapped
}

function resolveCurrentUserRole(openid, members, clubCreator) {
  const oid = toText(openid)
  if (!oid) return 'member'
  const me = (members || []).find((m) => toText(m && m.userId) === oid)
  if (me && (me.roleType === 'owner' || me.roleType === 'admin')) {
    return me.roleType
  }
  if (toText(clubCreator) === oid) return 'owner'
  return 'member'
}

function hasJoinedClub(openid, members) {
  const oid = toText(openid)
  if (!oid) return false
  return (members || []).some((m) => toText(m && m.userId) === oid)
}

function mapClubToView(rawClub, members, openid) {
  const club = rawClub && typeof rawClub === 'object' ? rawClub : {}
  const name = toText(club.name, '未命名俱乐部')
  const owner = members.find((m) => m && m.roleType === 'owner') || members[0] || null
  const memberTotal = members.length
  const male = members.filter((m) => m.gender === 'male').length
  const female = members.filter((m) => m.gender === 'female').length
  return {
    name,
    abbr: toAbbr((owner && owner.name) || name),
    avatarUrl: (owner && owner.avatarUrl) || '',
    location: toText(club.residence, '未设置常驻地'),
    schedule: formatCreateMonth(club.createdAt),
    desc: toText(club.intro, '这个俱乐部还没有填写简介。'),
    memberTotal,
    male,
    female,
    isPresident: toText(club.creator) === toText(openid),
  }
}

/* ==================== 动态（自动流）展示 ==================== */

/** 后端返回 ISO 时间，这里统一成本地 Date，兼容秒级时间戳 */
function parseFeedTime(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') return new Date(value < 1e12 ? value * 1000 : value)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function hhmm(d) {
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h < 10 ? `0${h}` : h}:${m < 10 ? `0${m}` : m}`
}

/**
 * 动态时间文案：越近越口语，越远越具体
 * 刚刚 / 12 分钟前 / 3 小时前 / 昨天 19:30 / 11月8日 / 2025年12月1日
 */
function formatFeedTime(value, now) {
  const d = parseFeedTime(value)
  if (!d) return ''
  const base = now instanceof Date ? now : new Date()
  const diff = base.getTime() - d.getTime()
  if (diff < 0) return '刚刚'
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`

  const sameDay =
    d.getFullYear() === base.getFullYear() &&
    d.getMonth() === base.getMonth() &&
    d.getDate() === base.getDate()
  if (sameDay) return `${Math.floor(diff / 3600000)} 小时前`

  const yesterday = new Date(base.getTime() - 86400000)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  if (isYesterday) return `昨天 ${hhmm(d)}`

  if (d.getFullYear() === base.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** 比赛开赛时间：今天 19:00 / 明天 19:00 / 11月15日 19:00 */
function formatStartTime(value, now) {
  const d = parseFeedTime(value)
  if (!d) return ''
  const base = now instanceof Date ? now : new Date()
  const dayDiff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime()) /
      86400000
  )
  if (dayDiff === 0) return `今天 ${hhmm(d)}`
  if (dayDiff === 1) return `明天 ${hhmm(d)}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hhmm(d)}`
}

/** 把接口返回的一条动态转成可直接渲染的结构 */
function mapFeedItemToView(raw, now) {
  const item = raw && typeof raw === 'object' ? raw : {}
  const type = toText(item.type)
  const timeText = formatFeedTime(item.at, now)

  if (type === 'member_join' || type === 'member_batch') {
    const members = Array.isArray(item.members) ? item.members : []
    const first = members[0] || {}
    const names = members.map((m) => toText(m && m.name)).filter(Boolean)
    let title = ''
    if (names.length === 0) title = '新成员加入了俱乐部'
    else if (names.length === 1) title = `${names[0]} 加入了俱乐部`
    else title = `${names[0]} 等 ${names.length} 人加入了俱乐部`
    return {
      id: toText(item.id),
      type: 'join',
      tone: 'orange',
      icon: 'friends-o',
      title,
      desc: '',
      timeText,
      tagText: '新成员',
      matchId: '',
      memberOpenId: names.length === 1 ? toText(first.openId) : '',
      avatars: members.slice(0, 3).map((m) => toAvatarUrl(m && m.avatar)),
    }
  }

  const match = item.match && typeof item.match === 'object' ? item.match : {}
  const matchName = toText(match.name, '未命名比赛')
  const actorName = toText(item.actor && item.actor.name, '有人')
  const matchId = match.id != null ? String(match.id) : ''

  if (type === 'match_finish') {
    const finished = Number(match.finishedMatches) || 0
    const champ = match.champion && toText(match.champion.name)
    const parts = []
    if (finished > 0) parts.push(`${finished} 场对阵`)
    // 只打了一两场就叫人"冠军"没意义，4 场以上才展示
    if (champ && finished >= 4) parts.push(`冠军 ${champ}`)
    return {
      id: toText(item.id),
      type: 'finish',
      tone: 'blue',
      icon: 'flag-o',
      title: `「${matchName}」打完了`,
      desc: parts.join(' · '),
      timeText,
      tagText: '比赛结束',
      matchId,
      memberOpenId: '',
      avatars: champ && finished >= 4 ? [toAvatarUrl(match.champion.avatar)] : [],
    }
  }

  // match_create
  const meta = []
  const playerCount = Number(match.playerCount) || 0
  if (playerCount > 0) meta.push(`${playerCount} 人`)
  const startText = formatStartTime(match.startTime, now)
  if (startText) meta.push(startText)
  const address = toText(match.address)
  if (address) meta.push(address)

  return {
    id: toText(item.id),
    type: 'create',
    tone: 'green',
    icon: 'add-o',
    title: `${actorName} 发起了比赛`,
    desc: [`「${matchName}」`, meta.join(' · ')].filter(Boolean).join('  '),
    timeText,
    tagText: '发起比赛',
    matchId,
    memberOpenId: '',
    avatars: [toAvatarUrl(item.actor && item.actor.avatar)],
  }
}

Page({
  data: {
    clubId: '',
    statusBarHeight: 44,
    membersScrollTop: 0,
    activeTab: 'members',
    memberCount: 0,
    feedCount: 0,
    /** 动态列表相关（懒加载：切到动态 tab 才请求） */
    feedList: [],
    feedLoaded: false,
    feedLoading: false,
    feedHasMore: false,
    feedCursor: '',
    feedNeedJoin: false,
    feedError: '',
    currentUserRole: 'member',
    canInvite: false,
    isShareMode: false,
    hasJoined: false,
    joining: false,
    club: {
      name: '',
      abbr: '',
      avatarUrl: '',
      location: '',
      schedule: '',
      desc: '',
      memberTotal: 0,
      male: 0,
      female: 0,
      isPresident: false,
    },
    /** 俱乐部拉取失败（分享卡片指向的俱乐部可能已被解散） */
    loadFailed: false,
    members: [],
  },

  onLoad(options) {
    let h = 44
    try {
      if (typeof wx.getWindowInfo === 'function') {
        const win = wx.getWindowInfo()
        h = win.statusBarHeight ?? 44
      } else {
        h = 44
      }
    } catch (e) {}
    this.setData({ statusBarHeight: h })
    const clubId = options && (options.id || options.clubId)
    const mode = options && options.mode
    if (clubId) {
      this.setData({ clubId: String(clubId) })
    }
    if (String(mode || '').toLowerCase() === 'share') {
      this.setData({ isShareMode: true })
    }
    this.fetchClubDetail()
  },

  /**
   * 从资料页返回时，把上次被资料闸门拦下的「加入俱乐部」自动继续做完。
   * 用户没保存就直接回来时不重试，避免立刻又弹一次一模一样的提示。
   */
  onShow() {
    if (!this._pendingJoin) return
    this._pendingJoin = false
    if (!this.data.isShareMode) return
    if (!isProfileComplete(getCurrentUser())) return
    this.onJoinClub()
  },

  onTabMembers() {
    this.setData({ activeTab: 'members', membersScrollTop: 0 })
  },

  onTabFeed() {
    this.setData({ activeTab: 'feed', membersScrollTop: 0 })
    // 没加载过就拉一页；已加载则静默刷新，保证切回来能看到最新动态
    if (!this.data.feedLoaded) {
      this.fetchFeed(true)
    } else if (!this.data.feedLoading) {
      this.fetchFeed(true, { silent: true })
    }
  },

  /**
   * 拉取动态
   * @param {boolean} reset 是否从第一页重新开始
   * @param {{silent?: boolean}} options silent=true 时不显示加载态（后台刷新用）
   */
  fetchFeed(reset, options) {
    const clubId = Number(this.data.clubId)
    if (!clubId) return Promise.resolve(null)
    const silent = !!(options && options.silent)

    // 非成员（分享模式）看不到动态，直接给提示，避免打一次必然 403 的请求
    if (!this.data.hasJoined && !this.data.club.isPresident) {
      this.setData({ feedNeedJoin: true, feedLoaded: true, feedList: [] })
      return Promise.resolve(null)
    }
    if (this.data.feedLoading) return Promise.resolve(null)

    const cursor = reset ? '' : toText(this.data.feedCursor)
    if (!reset && !cursor) return Promise.resolve(null)

    const patch = { feedLoading: true, feedError: '', feedNeedJoin: false }
    if (reset) {
      patch.feedList = []
      patch.feedCursor = ''
    }
    this.setData(patch)

    const payload = { clubId, pageSize: 20 }
    if (cursor) payload.cursor = cursor

    return CLUB_FEED(payload)
      .then((ret) => {
        const payloadData = ret && typeof ret === 'object' ? ret : {}
        const rows = Array.isArray(payloadData.list) ? payloadData.list : []
        const now = new Date()
        const mapped = rows.map((row) => mapFeedItemToView(row, now)).filter((row) => !!row.id)
        const list = reset ? mapped : this.data.feedList.concat(mapped)
        this.setData({
          feedList: list,
          feedLoaded: true,
          feedLoading: false,
          feedHasMore: !!payloadData.hasMore,
          feedCursor: toText(payloadData.nextCursor),
          feedCount: Number(payloadData.total) || list.length,
        })
      })
      .catch(() => {
        const patch = { feedLoading: false }
        if (!silent) {
          patch.feedLoaded = true
          patch.feedError = '动态加载失败，下拉重试'
        }
        // 静默预取失败就保持"未加载"，切到动态 tab 时会再请求一次
        this.setData(patch)
      })
  },

  onReachBottom() {
    if (this.data.activeTab !== 'feed') return
    if (!this.data.feedHasMore || this.data.feedLoading) return
    this.fetchFeed(false)
  },

  /** 点动态卡片：比赛类跳比赛详情，成员类跳个人资料 */
  onTapFeed(e) {
    const ds = e.currentTarget.dataset || {}
    const matchId = toText(ds.matchId)
    if (matchId) {
      wx.navigateTo({ url: `/pages/match/details/index?id=${matchId}` })
      return
    }
    const openId = toText(ds.memberOpenId)
    if (openId) {
      wx.navigateTo({ url: `/pages/user/person/index?openId=${encodeURIComponent(openId)}` })
    }
  },

  /** 空状态里的"发起第一场球局" */
  onFeedCreateMatch() {
    if (!requireProfile('发起球局')) return
    wx.navigateTo({ url: `/pages/match/create/index?clubId=${this.data.clubId}` })
  },

  /** 加载失败后重试 */
  onFeedRetry() {
    this.fetchFeed(true)
  },

  onPageScroll: createScrollSync('membersScrollTop', 10),

  onMemberMore(e) {
    const id = e.currentTarget.dataset.id
    const role = this.data.currentUserRole
    const target = (this.data.members || []).find((m) => String(m.id) === String(id))
    const targetRole = target && target.roleType ? target.roleType : 'member'
    const targetUserId = toText(target && target.userId)
    const currentUserId = pickOpenId()
    const isSelf = targetUserId !== '' && targetUserId === currentUserId
    const itemList = ['查看资料']
    if (role === 'owner') {
      if (targetRole === 'owner') {
        itemList.push('解散俱乐部')
      } else if (targetRole === 'admin') {
        itemList.push('取消管理员', '移出俱乐部')
      } else {
        itemList.push('设置管理员', '移出俱乐部')
      }
    } else if (role === 'admin') {
      if (isSelf) {
        itemList.push('退出俱乐部')
      } else if(targetRole !== 'owner') {
        itemList.push('移出俱乐部')
      }
    } else if (role === 'member' && isSelf) {
      itemList.push('退出俱乐部')
    }
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const action = itemList[res.tapIndex]
        if (!action) return
        if (action === '查看资料') {
          if (!targetUserId) {
            wx.showToast({ title: '成员信息异常', icon: 'none' })
            return
          }
          wx.navigateTo({ url: `/pages/user/person/index?openId=${encodeURIComponent(targetUserId)}` })
          return
        }
        if (action === '解散俱乐部') {
          this.confirmDisbandClub()
          return
        }
        if (action === '设置管理员') {
          if (!targetUserId) {
            wx.showToast({ title: '成员信息异常', icon: 'none' })
            return
          }
          this.confirmMemberAction({
            title: '设置管理员',
            content: `确认将 ${toText(target && target.name, '该成员')} 设为管理员吗？`,
            loadingText: '设置中...',
            successText: '已设置管理员',
            request: () => SET_ADMIN({ clubId: Number(this.data.clubId), userId: targetUserId }),
          })
          return
        }
        if (action === '取消管理员') {
          if (!targetUserId) {
            wx.showToast({ title: '成员信息异常', icon: 'none' })
            return
          }
          this.confirmMemberAction({
            title: '取消管理员',
            content: `确认取消 ${toText(target && target.name, '该成员')} 的管理员身份吗？`,
            loadingText: '处理中...',
            successText: '已取消管理员',
            request: () => REMOVE_ADMIN({ clubId: Number(this.data.clubId), userId: targetUserId }),
          })
          return
        }
        if (action === '移出俱乐部') {
          if (!targetUserId) {
            wx.showToast({ title: '成员信息异常', icon: 'none' })
            return
          }
          this.confirmMemberAction({
            title: '移出俱乐部',
            content: `确认将 ${toText(target && target.name, '该成员')} 移出俱乐部吗？`,
            loadingText: '移出中...',
            successText: '已移出俱乐部',
            request: () => EXIT_CLUB({ clubId: Number(this.data.clubId), userId: targetUserId }),
          })
          return
        }
        if (action === '退出俱乐部') {
          this.confirmExitClub(targetUserId || currentUserId)
          return
        }
        wx.showToast({ title: `${action}(${id})`, icon: 'none' })
      },
    })
  },

  confirmExitClub(userId) {
    const clubId = Number(this.data.clubId)
    const uid = toText(userId || pickOpenId())
    if (!clubId || !uid) {
      wx.showToast({ title: '参数异常，无法退出', icon: 'none' })
      return
    }
    wx.showModal({
      title: '提示',
      content: '退出后将不再属于该俱乐部，确定继续吗？',
      confirmText: '确认退出',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '退出中...', mask: true })
        EXIT_CLUB({
          clubId,
          userId: uid,
        })
          .then(() => {
            wx.showToast({ title: '已退出俱乐部', icon: 'success' })
            this.fetchClubDetail()
          })
          .catch(() => {})
          .finally(() => {
            wx.hideLoading()
          })
      },
    })
  },

  confirmMemberAction(opts) {
    const title = toText(opts && opts.title, '操作确认')
    const content = toText(opts && opts.content, '确认执行该操作吗？')
    const loadingText = toText(opts && opts.loadingText, '处理中...')
    const successText = toText(opts && opts.successText, '操作成功')
    const request = opts && typeof opts.request === 'function' ? opts.request : null
    if (!request) return
    wx.showModal({
      title,
      content,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: loadingText, mask: true })
        request()
          .then(() => {
            wx.showToast({ title: successText, icon: 'success' })
            this.fetchClubDetail()
          })
          .catch(() => {})
          .finally(() => {
            wx.hideLoading()
          })
      },
    })
  },

  confirmDisbandClub() {
    const clubId = this.data.clubId
    if (!clubId) {
      wx.showToast({ title: '俱乐部信息异常', icon: 'none' })
      return
    }
    wx.showModal({
      title: '是否解散',
      content: '解散后将无法恢复，确定解散该俱乐部吗？',
      confirmText: '确认解散',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '解散中...', mask: true })
        DEL_CLUB({ id: clubId })
          .then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已解散', icon: 'success' })
            setTimeout(() => {
              wx.switchTab({ url: '/pages/mine/index' })
            }, 500)
          })
          .catch(() => {
            wx.hideLoading()
          })
      },
    })
  },

  onTapAdd() {
    wx.showToast({ title: '新增功能接入中', icon: 'none' })
  },

  onJoinClub() {
    if (!this.data.isShareMode) return
    if (this.data.joining) return
    const clubId = Number(this.data.clubId)
    if (!clubId) {
      wx.showToast({ title: '俱乐部信息异常', icon: 'none' })
      return
    }
    if (this.data.hasJoined) {
      wx.showToast({ title: '你已加入该俱乐部', icon: 'none' })
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
        app0.relogin().then(() => this.onJoinClub())
        return
      }
      wx.showToast({ title: '请先登录后再加入', icon: 'none' })
      return
    }
    // 资料闸门：头像或昵称任一项完善即可，两项都是默认值才拦。
    // 记一笔待续动作，用户从资料页回来时自动把加入继续做完
    if (
      !requireProfile('加入俱乐部', {
        onNeed: () => {
          this._pendingJoin = true
        },
      })
    )
      return
    const payload = {
      clubId,
      userId: openid,
      userName: toText(userInfo.nickName || userInfo.name, '未命名用户'),
      userAvatar: toText(userInfo.avatar),
      role: 'member',
      joinedAt: new Date().toISOString(),
    }

    this.setData({ joining: true })
    wx.showLoading({ title: '加入中...', mask: true })
    INVITE_CLUB(payload)
      .then(() => {
        wx.showToast({ title: '加入成功', icon: 'success' })
        this.fetchClubDetail()
      })
      .catch(() => {})
      .finally(() => {
        wx.hideLoading()
        this.setData({ joining: false })
      })
  },

  onShareAppMessage() {
    const id = this.data.clubId
    const name = toText(this.data.club && this.data.club.name)
    // 没有 id 不能兜底成 "1"：那会把好友带进别人的俱乐部
    if (!id) return brandCard()
    return {
      title: name ? `邀请你加入「${name}」` : '邀请你加入我的羽毛球俱乐部',
      path: `/pages/club/details/index?id=${id}&mode=share`,
      imageUrl: randomShareImage(),
    }
  },

  fetchClubDetail() {
    const clubId = this.data.clubId
    if (!clubId) return Promise.resolve(null)
    return CLUB_DES({ id: clubId })
      .then((ret) => {
        const payload = ret && typeof ret === 'object' ? ret : {}
        const members = mapMembersToView(payload.members)
        const openid = pickOpenId()
        const currentUserRole = resolveCurrentUserRole(openid, members, payload.club && payload.club.creator)
        const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin'
        const hasJoined = hasJoinedClub(openid, members)
        this.setData({
          club: mapClubToView(payload.club, members, openid),
          members,
          memberCount: members.length,
          currentUserRole,
          canInvite,
          hasJoined,
          loadFailed: false,
        })
        // 成员才预取动态：tab 切过去就能直接看到，不用等转圈
        if (hasJoined || currentUserRole === 'owner') {
          this.fetchFeed(true, { silent: true })
        } else {
          this.setData({ feedNeedJoin: true, feedLoaded: true })
        }
        return ret
      })
      .catch(() => {
        // 分享卡片可能指向已解散的俱乐部：给明确空态，别停在空白页
        if (!this.data.club || !this.data.club.name) {
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
})
