const { CLUB_MY_LIST, USER_STATS } = require('../../request/api')
const { whenLoginReady, pickOpenId } = require('../../utils/auth')
const { DEFAULT_AVATAR, toAvatarUrl, toStaticUrl } = require('../../utils/static')
const { mapRecentMatches, formatStats } = require('../../utils/matchView')
const { brandCard } = require('../../utils/shareCard')

function formatJoinDate(createdAt) {
  if (createdAt == null || createdAt === '') return ''
  const raw = typeof createdAt === 'number' && createdAt < 1e12 ? createdAt * 1000 : createdAt
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月加入`
}

function mapUserToView(user) {
  if (!user || typeof user !== 'object') {
    return {
      userAvatar: DEFAULT_AVATAR,
      userNickName: '未登录',
      userGender: 0,
      userLevel: '未定级',
      userJoinText: '',
    }
  }
  const avatar = toAvatarUrl(user.avatar)
  const nick =
    user.nickName && String(user.nickName).trim() ? String(user.nickName).trim() : '未命名'
  const g = Number(user.gender)
  const userGender = g === 1 || g === 2 ? g : 0
  const level =
    user.badmintonLevel != null && String(user.badmintonLevel).trim() !== ''
      ? String(user.badmintonLevel).trim()
      : '未定级'
  const userJoinText = formatJoinDate(user.createdAt)
  return {
    userAvatar: avatar,
    userNickName: nick,
    userGender,
    userLevel: level,
    userJoinText,
  }
}

function toDisplayName(name) {
  const text = name == null ? '' : String(name).trim()
  return text || '未知'
}

function toAvatarAbbr(name) {
  const text = toDisplayName(name)
  return text.slice(0, 1).toUpperCase()
}

function toRoleText(role, isCreator) {
  if (isCreator) return '会长'
  const r = role == null ? '' : String(role).toLowerCase()
  if (r === 'owner') return '会长'
  else if (r === 'admin' ) return '管理员'
  return '成员'
}

function mapClubToView(item, openid, index) {
  const club = (item && item.club) || {}
  const members = Array.isArray(item && item.members) ? item.members : []
  const myMember = members.find((m) => m && m.userId === openid)
  const roleText = toRoleText(myMember && myMember.role, String(club.creator || '') === openid)
  const avatarBadges = members.slice(0, 4).map((m, idx) => {
    const className = idx > 0 ? `is-${idx + 1}` : ''
    return {
      abbr: toAvatarAbbr(m && m.userName),
      avatarUrl: toStaticUrl(m && m.userAvatar),
      className,
    }
  })
  const moreCount = members.length > 4 ? members.length - 4 : 0
  return {
    id: club.id != null ? String(club.id) : `club_${index}`,
    name: toDisplayName(club.name || '未命名俱乐部'),
    roleText,
    isMemberRole: roleText === '成员',
    avatarBadges,
    moreCountText: moreCount > 0 ? `+${moreCount}` : '',
    memberCountText: `${members.length}人`,
  }
}

Page({
  data: {
    enter: false,
    userAvatar: DEFAULT_AVATAR,
    userNickName: '未登录',
    userGender: 0,
    userLevel: '未定级',
    userJoinText: '',
    myClubs: [],
    myClubLoading: false,
    matches: [],
    matchLoading: false,
    // 战绩数字，全部来自 /users/stats 的实时聚合
    stats: {
      playedText: '--',
      winText: '--',
      winRateText: '--',
      streakText: '--',
      diffText: '--',
    },
  },

  syncUserFromGlobal() {
    const app = getApp()
    const user = (app && app.globalData && app.globalData.userInfo) || {}
    this.setData(mapUserToView(user))
  },

  /** 俱乐部列表：等服务端登录就绪后再拉取，身份由令牌决定 */
  fetchMyClubs() {
    this.setData({ myClubLoading: true })
    return whenLoginReady()
      .then(() => CLUB_MY_LIST({ openId: pickOpenId() }))
      .then((list) => {
        const openid = pickOpenId()
        const raw = Array.isArray(list) ? list : []
        const myClubs = raw.map((item, index) => mapClubToView(item, openid, index)).slice(0, 2)
        this.setData({ myClubs })
        return myClubs
      })
      .catch(() => {
        this.setData({ myClubs: [] })
        return []
      })
      .finally(() => {
        this.setData({ myClubLoading: false })
      })
  },

  /** 战绩与最近比赛：只认后端聚合结果，前端不再拼假数据 */
  fetchStats() {
    this.setData({ matchLoading: true })
    return whenLoginReady()
      .then(() => USER_STATS({ openId: pickOpenId(), limit: 5 }))
      .then((data) => {
        const d = data && typeof data === 'object' ? data : {}
        const myOpenId = d.openId || pickOpenId()
        const matches = mapRecentMatches(d.recent, myOpenId)
        this.setData({
          matches,
          stats: formatStats(d.summary),
        })
        return matches
      })
      .catch(() => {
        // 拉取失败就保持空态，不拿假数据顶上
        this.setData({
          matches: [],
          stats: formatStats(null),
        })
        return []
      })
      .finally(() => {
        this.setData({ matchLoading: false })
      })
  },

  onShow() {
    this.syncUserFromGlobal()
    this.fetchMyClubs()
    this.fetchStats()
    if (typeof this.getTabBar === 'function') {
      this.getTabBar((tabBar) => {
        tabBar.setData({
          current: 'mine'
        })
      })
    }
    this.setData({ enter: false })
    setTimeout(() => {
      this.setData({ enter: true })
    }, 16)
  },

  onGoMatchDetail(e) {
    const matchId = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.matchId
    if (!matchId) return
    wx.navigateTo({ url: `/pages/match/details/index?id=${matchId}` })
  },

  onGoClubList() {
    wx.navigateTo({ url: '/pages/club/index/index' })
  },

  onGoMatchList() {
    wx.navigateTo({ url: '/pages/match/index/index' })
  },

  onMyInfo() {
    wx.navigateTo({ url: '/pages/user/info/index' })
  },

  onGoClubDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/club/details/index?id=${id}` })
  },

  onShareAppMessage() {
    return brandCard()
  },
})
