// pages/user/person/index.js
Page({
  data: {
    pageScrollTop: 0,
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
    // 预留：后续可通过 options.id 拉取用户信息
    if (options && options.gender) {
      const g = String(options.gender)
      if (g === 'male' || g === 'female' || g === 'unknown') {
        this.setData({ 'user.gender': g })
      }
    }
  },

  onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st !== this.data.pageScrollTop) {
      this.setData({ pageScrollTop: st })
    }
  },

  onShareAppMessage() {
    return {
      title: `${this.data.user.name} 的个人信息`,
      path: '/pages/user/person/index',
    }
  },
})