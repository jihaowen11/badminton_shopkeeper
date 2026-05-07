const DEFAULT_AVATAR = '/images/noheader.jpg'

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
  const avatar =
    user.avatar && String(user.avatar).trim() ? String(user.avatar).trim() : DEFAULT_AVATAR
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

Page({
  data: {
    enter: false,
    userAvatar: DEFAULT_AVATAR,
    userNickName: '未登录',
    userGender: 0,
    userLevel: '未定级',
    userJoinText: '',
    matches: [
      {
        id: 'm1',
        result: 'win', // win | loss
        type: 'single', // single | double
        timeText: '今天 14:30',
        clubName: '羽动青春',
        scoreText: '21:18, 21:15',
        left: [{ abbr: '王', name: '我' }],
        right: [{ abbr: '李', name: '李明' }],
      },
      {
        id: 'm2',
        result: 'loss',
        type: 'double',
        timeText: '昨天 20:10',
        clubName: '周末羽球群',
        scoreText: '18:21, 21:19, 12:15',
        left: [
          { abbr: '王', name: '我' },
          { abbr: '张', name: '张宇' },
        ],
        right: [
          { abbr: '陈', name: '陈浩' },
          { abbr: '刘', name: '刘洋' },
        ],
      },
      {
        id: 'm3',
        result: 'win',
        type: 'single',
        timeText: '04-26 19:40',
        clubName: '羽动青春',
        scoreText: '21:16, 21:13',
        left: [{ abbr: '王', name: '我' }],
        right: [{ abbr: '周', name: '周凯' }],
      },
      {
        id: 'm4',
        result: 'win',
        type: 'double',
        timeText: '04-25 21:05',
        clubName: '周末羽球群',
        scoreText: '21:17, 21:18',
        left: [
          { abbr: '王', name: '我' },
          { abbr: '李', name: '李雷' },
        ],
        right: [
          { abbr: '赵', name: '赵强' },
          { abbr: '孙', name: '孙浩' },
        ],
      },
      {
        id: 'm5',
        result: 'loss',
        type: 'single',
        timeText: '04-24 18:30',
        clubName: '羽动青春',
        scoreText: '19:21, 16:21',
        left: [{ abbr: '王', name: '我' }],
        right: [{ abbr: '郭', name: '郭磊' }],
      },
    ],
  },

  syncUserFromGlobal() {
    const app = getApp()
    const user = (app && app.globalData && app.globalData.userInfo) || {}
    this.setData(mapUserToView(user))
  },

  onShow() {
    this.syncUserFromGlobal()
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

  onGoClubList() {
    wx.navigateTo({ url: '/pages/club/index/index' })
  },

  onGoMatchList() {
    wx.navigateTo({ url: '/pages/match/index/index' })
  },

  onMyInfo() {
    wx.navigateTo({ url: '/pages/user/info/index' })
  },
})
