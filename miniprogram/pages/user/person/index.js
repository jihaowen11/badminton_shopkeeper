// pages/user/person/index.js
const { FIND_USER } = require('../../../request/api')

const DEFAULT_AVATAR = '/images/noheader.jpg'

function toText(v, fallback = '') {
  const s = v == null ? '' : String(v).trim()
  return s || fallback
}

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

function toAvatarUrl(rawAvatar) {
  const path = rawAvatar == null ? '' : String(rawAvatar).trim()
  if (!path) return DEFAULT_AVATAR
  try {
    const app = getApp()
    if (app && app.fun && typeof app.fun.joinStaticUrl === 'function') {
      return app.fun.joinStaticUrl(path)
    }
  } catch (e) {}
  return path || DEFAULT_AVATAR
}

function mapUserToView(user) {
  const u = user && typeof user === 'object' ? user : {}
  const nickName = toText(u.nickName, '未命名')
  return {
    avatarUrl: toAvatarUrl(u.avatar),
    name: nickName,
    gender: toGender(u.gender),
    levelText: toText(u.badmintonLevel, '未定级'),
    joinText: formatJoinDate(u.createdAt),
    totalMatches: Number(u.totalMatches || 0),
    winRate: toText(u.winRate, '--'),
  }
}

Page({
  data: {
    pageScrollTop: 0,
    openId: '',
    user: {
      avatarUrl: '/images/noheader.jpg',
      name: 'Esccry',
      gender: 'male', // male | female | unknown
      levelText: '进阶球友',
      joinText: '2024年3月加入',
      totalMatches: 128,
      winRate: '69.5%',
    },
    matches: [
      {
        id: 'm1',
        result: 'win',
        type: 'double',
        timeText: '2026/04/24 09:19',
        clubName: 'esccry组织',
        left: [
          { name: '2号徐', abbr: '徐' },
          { name: '7号大勇', abbr: '勇' },
        ],
        right: [
          { name: '4号esccry', abbr: '我' },
          { name: '5号熊', abbr: '熊' },
        ],
        scoreText: '21:8',
      },
      {
        id: 'm2',
        result: 'win',
        type: 'double',
        timeText: '2026/04/11 15:48',
        clubName: '小熊组织',
        left: [
          { name: '1号吕', abbr: '吕' },
          { name: '6号刘飞', abbr: '飞' },
        ],
        right: [
          { name: '3号小熊', abbr: '熊' },
          { name: '4号esccry', abbr: '我' },
        ],
        scoreText: '21:11',
      },
      {
        id: 'm3',
        result: 'loss',
        type: 'double',
        timeText: '2026/04/04 19:37',
        clubName: '熊组织',
        left: [
          { name: '2号徐', abbr: '徐' },
          { name: '7号大勇', abbr: '勇' },
        ],
        right: [
          { name: '1号吕', abbr: '吕' },
          { name: '5号熊', abbr: '熊' },
        ],
        scoreText: '5:21',
      },
      {
        id: 'm4',
        result: 'win',
        type: 'double',
        timeText: '2026/03/28 20:10',
        clubName: '周末约球',
        left: [
          { name: '5号熊', abbr: '熊' },
          { name: '6号刘飞', abbr: '飞' },
        ],
        right: [
          { name: '3号小熊', abbr: '熊' },
          { name: '4号esccry', abbr: '我' },
        ],
        scoreText: '21:19',
      },
      {
        id: 'm5',
        result: 'loss',
        type: 'single',
        timeText: '2026/03/20 19:30',
        clubName: '晨练组',
        left: [{ name: '4号esccry', abbr: '我' }],
        right: [{ name: '2号徐', abbr: '徐' }],
        scoreText: '18:21',
      },
    ],
  },

  onLoad(options) {
    const openId = options && options.openId ? decodeURIComponent(String(options.openId)) : ''
    this.setData({ openId })
    this.fetchUserProfile()
  },

  fetchUserProfile() {
    const app = getApp()
    const openId =
      toText(this.data.openId) ||
      toText(app && app.globalData && app.globalData.openid) ||
      toText(app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.openId)
    if (!openId) return Promise.resolve(null)
    return FIND_USER({ openId })
      .then((user) => {
        this.setData({ user: mapUserToView(user) })
        return user
      })
      .catch(() => null)
  },

  onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st !== this.data.pageScrollTop) {
      this.setData({ pageScrollTop: st })
    }
  },

  onShareAppMessage() {
    const openId = toText(this.data.openId)
    return {
      title: `${this.data.user.name} 的个人信息`,
      path: openId ? `/pages/user/person/index?openId=${encodeURIComponent(openId)}` : '/pages/user/person/index',
    }
  },
})