
Page({
  data: {
    enter: false,
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

  onShow() {
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
})
