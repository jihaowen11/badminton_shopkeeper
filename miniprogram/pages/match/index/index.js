// pages/match/index/index.js

function pick(list, limit) {
  return Array.isArray(list) ? list.slice(0, Math.max(0, limit || 0)) : []
}

function buildMockMatches() {
  const avatarPool = [
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
  ]

  const base = [
    {
      id: 'm1',
      title: '5人转',
      dateText: '2026/04/24（星期五）',
      timeText: '09:19',
      ruleText: '八人转，一局定胜负，21分制',
      orgAvatar: avatarPool[0],
      orgText: 'esccry组织',
      joined: 1,
      capacity: 5,
      views: 16,
      status: 'open',
      statusText: '报名中',
      previewAvatars: avatarPool.slice(0, 2),
    },
    {
      id: 'm2',
      title: '6人转',
      dateText: '2026/04/11（星期六）',
      timeText: '15:48',
      ruleText: '八人转，一局定胜负，21分制',
      orgAvatar: avatarPool[1],
      orgText: '小熊组织',
      joined: 3,
      capacity: 6,
      views: 48,
      status: 'open',
      statusText: '报名中',
      previewAvatars: avatarPool.slice(0, 4),
    },
    {
      id: 'm3',
      title: '7人转',
      dateText: '2026/04/04（星期六）',
      timeText: '19:37',
      ruleText: '八人转，一局定胜负，21分制',
      orgAvatar: avatarPool[2],
      orgText: '熊组织',
      joined: 7,
      capacity: 7,
      views: 106,
      status: 'done',
      statusText: '已结束',
      previewAvatars: avatarPool.slice(0, 8),
    },
  ]

  const more = []
  for (let i = 4; i <= 60; i += 1) {
    more.push({
      id: `m${i}`,
      title: `${(i % 8) + 4}人转`,
      dateText: '2026/03/01（星期日）',
      timeText: `1${i % 10}:0${i % 6}`,
      ruleText: '八人转，一局定胜负，21分制',
      orgAvatar: avatarPool[i % avatarPool.length],
      orgText: '俱乐部组织',
      joined: Math.min((i * 2) % 9, (i % 8) + 4),
      capacity: (i % 8) + 4,
      views: 10 + i * 2,
      status: i % 3 === 0 ? 'done' : 'open',
      statusText: i % 3 === 0 ? '已结束' : '报名中',
      previewAvatars: avatarPool.slice(0, (i % 7) + 1),
    })
  }
  return base.concat(more)
}

Page({
  data: {
    pageScrollTop: 0,
    filterLimit: 10,
    filterLabel: '近10场',
    totalCount: 0,
    allMatches: [],
    matches: [],
  },

  onLoad() {
    const all = buildMockMatches()
    this.setData({ allMatches: all, totalCount: all.length })
    this.applyFilter(this.data.filterLimit)
  },

  onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st !== this.data.pageScrollTop) {
      this.setData({ pageScrollTop: st })
    }
  },

  applyFilter(limit) {
    const next = pick(this.data.allMatches, limit).map((m) => ({
      ...m,
      previewAvatars: pick(m.previewAvatars, 8),
    }))
    this.setData({
      matches: next,
      filterLimit: limit,
      filterLabel: limit === 50 ? '近50场' : '近10场',
    })
  },

  onOpenFilter() {
    wx.showActionSheet({
      itemList: ['近10场', '近50场'],
      success: (res) => {
        const limit = res.tapIndex === 1 ? 50 : 10
        this.applyFilter(limit)
      },
    })
  },

  onTapMatch(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/match/details/index?id=${id}` })
  },

  onShareAppMessage() {
    return {
      title: '比赛列表',
      path: '/pages/match/index/index',
    }
  },
})