// pages/user/person/index.js
const { FIND_USER, USER_STATS } = require('../../../request/api')
const { whenLoginReady, pickOpenId } = require('../../../utils/auth')
const { toText } = require('../../../utils/format')
const { toAvatarUrl } = require('../../../utils/static')
const { mapRecentMatches, formatStats } = require('../../../utils/matchView')
const { createScrollSync } = require('../../../utils/scrollSync')

function toGender(gender) {
  const g = Number(gender)
  if (g === 1) return 'male'
  if (g === 2) return 'female'
  return 'unknown'
}

function formatJoinDate(createdAt) {
  if (createdAt == null || createdAt === '') return ''
  const raw = typeof createdAt === 'number' && createdAt < 1e12 ? createdAt * 1000 : createdAt
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月加入`
}

/** 资料来自用户表，战绩来自排期聚合，两者分开算最后合并 */
function mapUserToView(user) {
  const u = user && typeof user === 'object' ? user : {}
  return {
    avatarUrl: toAvatarUrl(u.avatar),
    name: toText(u.nickName, '未命名'),
    gender: toGender(u.gender),
    levelText: toText(u.badmintonLevel, '未定级'),
    joinText: formatJoinDate(u.createdAt),
    // 战绩先占位，等 /users/stats 回来再覆盖
    totalMatches: '--',
    winRate: '--',
  }
}

Page({
  data: {
    pageScrollTop: 0,
    openId: '',
    loading: false,
    user: {
      avatarUrl: '/images/noheader.jpg',
      name: '加载中',
      gender: 'unknown',
      levelText: '未定级',
      joinText: '',
      totalMatches: '--',
      winRate: '--',
    },
    matches: [],
  },

  onLoad(options) {
    const openId = options && options.openId ? decodeURIComponent(String(options.openId)) : ''
    this.setData({ openId })
    // 等登录就绪再拉数据：没带 openId 时要靠登录态知道"我是谁"
    whenLoginReady().then(() => {
      const oid = openId || pickOpenId()
      if (oid && oid !== this.data.openId) this.setData({ openId: oid })
      this.fetchAll()
    })
  },

  fetchAll() {
    const openId = toText(this.data.openId) || pickOpenId()
    if (!openId) {
      this.setData({ loading: false })
      return Promise.resolve(null)
    }
    this.setData({ loading: true })
    return Promise.all([
      FIND_USER({ openId }).catch(() => null),
      USER_STATS({ openId, limit: 5 }).catch(() => null),
    ])
      .then(([user, stats]) => {
        const userView = mapUserToView(user)
        const summary = formatStats(stats && stats.summary)
        userView.totalMatches = summary.playedText
        userView.winRate = summary.winRateText
        this.setData({
          user: userView,
          matches: mapRecentMatches(stats && stats.recent, openId),
        })
        return user
      })
      .catch(() => null)
      .finally(() => {
        this.setData({ loading: false })
      })
  },

  onGoMatchDetail(e) {
    const matchId = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.matchId
    if (!matchId) return
    wx.navigateTo({ url: `/pages/match/details/index?id=${matchId}` })
  },

  onPageScroll: createScrollSync('pageScrollTop', 10),

  onShareAppMessage() {
    const openId = toText(this.data.openId)
    return {
      title: `${this.data.user.name} 的个人信息`,
      path: openId ? `/pages/user/person/index?openId=${encodeURIComponent(openId)}` : '/pages/user/person/index',
    }
  },
})
