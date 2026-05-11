const DEFAULT_AVATAR = '/images/noheader.jpg'
const { CLUB_MY_LIST } = require('../../request/api')

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
  const rawAvatar = user.avatar && String(user.avatar).trim() ? String(user.avatar).trim() : ''
  let avatar = DEFAULT_AVATAR
  if (rawAvatar) {
    try {
      const app = getApp()
      if (app.fun && typeof app.fun.joinStaticUrl === 'function') {
        avatar = app.fun.joinStaticUrl(rawAvatar)
      } else {
        avatar = rawAvatar
      }
    } catch (e) {
      avatar = rawAvatar
    }
  }
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

function toAvatarUrl(rawAvatar) {
  const path = rawAvatar == null ? '' : String(rawAvatar).trim()
  if (!path) return ''
  try {
    const app = getApp()
    if (app && app.fun && typeof app.fun.joinStaticUrl === 'function') {
      return app.fun.joinStaticUrl(path)
    }
  } catch (e) {}
  return path
}

function toRoleText(role, isCreator) {
  if (isCreator) return '会长'
  const r = role == null ? '' : String(role).toLowerCase()
  if (r === 'owner') return '会长'
  else if (r === 'admin' ) return '管理员'
  return '成员'
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

function mapClubToView(item, openid, index) {
  const club = (item && item.club) || {}
  const members = Array.isArray(item && item.members) ? item.members : []
  const myMember = members.find((m) => m && m.userId === openid)
  const roleText = toRoleText(myMember && myMember.role, String(club.creator || '') === openid)
  const avatarBadges = members.slice(0, 4).map((m, idx) => {
    const className = idx > 0 ? `is-${idx + 1}` : ''
    return {
      abbr: toAvatarAbbr(m && m.userName),
      avatarUrl: toAvatarUrl(m && m.userAvatar),
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

  fetchMyClubs(retryCount = 0) {
    const openid = pickOpenId()
    if (!openid) {
      if (retryCount < 5) {
        setTimeout(() => {
          this.fetchMyClubs(retryCount + 1)
        }, 300)
      }
      this.setData({
        myClubLoading: false,
        myClubs: [],
      })
      return Promise.resolve([])
    }
    this.setData({ myClubLoading: true })
    return CLUB_MY_LIST({ openId: openid })
      .then((list) => {
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

  onShow() {
    this.syncUserFromGlobal()
    this.fetchMyClubs()
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

  onGoClubDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/club/details/index?id=${id}` })
  },

  onShareAppMessage() {
    const randomIndex = Math.floor(Math.random() * 6) + 1
    const titles = [
      '羽球掌柜：一键组局约球，今天就开打！',
      '还在群里刷屏约球？试试羽球掌柜',
      '羽球掌柜上线，俱乐部管理和约球更省心',
      '打球搭子难找？羽球掌柜帮你快速匹配',
      '从建俱乐部到记比赛，羽球掌柜全搞定',
      '球友都在用的羽球掌柜，快来一起玩',
    ]
    const randomTitle = titles[Math.floor(Math.random() * titles.length)]
    return {
      title: randomTitle,
      path: '/pages/index/index',
      imageUrl: `/images/share/${randomIndex}.jpg`,
    }
  },
})
