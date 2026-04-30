// pages/match/details/index.js

function mockById(id) {
  const ended = id !== 'm2'
  const match = {
    title: '7人转',
    status: ended ? 'end' : 'open',
    statusText: ended ? '已结束' : '报名中',
    actionText: ended ? '已结束' : '我要报名',
    dateLine: '2026/04/04（星期六）19:37',
    typeLine: '八人转',
    formatLine: '一局定胜负，21分制',
    peopleLine: '实报7人，每人8场共14场',
    pairStyle: '随机大乱斗',
    viewPeople: 7,
    views: 111,
    joined: 7,
    capacity: 7,
  }

  const tones = ['green', 'blue', 'pink', 'green', 'blue', 'pink', 'green']
  const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九']
  const regPreview = names.map((n, i) => ({
    id: `u${i}`,
    abbr: n.slice(0, 1),
    tone: tones[i % tones.length],
  }))

  const avatarPool = [
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
    'https://img.yzcdn.cn/vant/cat.jpeg',
  ]

  const rawPairings = [
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
        { id: 'r1', name: '3号小熊🐻', avatar: avatarPool[2], isMe: false },
        { id: 'r2', name: '4号esccry', avatar: avatarPool[3], isMe: true },
      ],
      scoreLeft: 21,
      scoreRight: 11,
    },
    {
      id: 'p3',
      roundLabel: '第3场',
      left: [
        { id: 'l1', name: '2号徐', avatar: avatarPool[0], isMe: false },
        { id: 'l2', name: '7号大勇', avatar: avatarPool[1], isMe: false },
      ],
      right: [
        { id: 'r1', name: '1号吕', avatar: avatarPool[2], isMe: false },
        { id: 'r2', name: '5号熊', avatar: avatarPool[3], isMe: false },
      ],
      scoreLeft: 5,
      scoreRight: 21,
    },
    {
      id: 'p4',
      roundLabel: '第4场',
      left: [
        { id: 'l1', name: '5号熊', avatar: avatarPool[0], isMe: false },
        { id: 'l2', name: '6号刘飞', avatar: avatarPool[1], isMe: false },
      ],
      right: [
        { id: 'r1', name: '3号小熊🐻', avatar: avatarPool[2], isMe: false },
        { id: 'r2', name: '4号esccry', avatar: avatarPool[3], isMe: true },
      ],
      scoreLeft: 21,
      scoreRight: 19,
    },
  ]

  const pairings = rawPairings.map((p) => {
    const leftPlayers = (p.left || []).slice(0, 2)
    const rightPlayers = (p.right || []).slice(0, 2)
    const leftNameLine1 = leftPlayers[0] ? leftPlayers[0].name : ''
    const leftNameLine2 = leftPlayers[1] ? `${leftPlayers[1].name}` : ''
    const rightNameLine1 = rightPlayers[0] ? rightPlayers[0].name : ''
    const rightNameLine2 = rightPlayers[1] ? `${rightPlayers[1].name}` : ''
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
      leftNameLine1,
      leftNameLine2,
      rightNameLine1,
      rightNameLine2,
      scoreLeft: p.scoreLeft,
      scoreRight: p.scoreRight,
      winSide,
    }
  })

  const wl = [
    { win: 7, lose: 1, diff: 46 },
    { win: 5, lose: 2, diff: 36 },
    { win: 4, lose: 4, diff: 3 },
    { win: 4, lose: 4, diff: -23 },
    { win: 3, lose: 4, diff: 8 },
    { win: 2, lose: 5, diff: -39 },
    { win: 1, lose: 6, diff: -31 },
  ]

  const rankings = names.map((n, i) => ({
    id: `r${i}`,
    rank: i + 1,
    name: i === 4 ? '4号esccry' : n,
    avatar: avatarPool[i % avatarPool.length],
    isMe: i === 4,
    win: wl[i] ? wl[i].win : 0,
    lose: wl[i] ? wl[i].lose : 0,
    diff: wl[i] ? wl[i].diff : 0,
  }))

  return { match, organizer: { name: '熊', abbr: '熊', tone: 'orange' }, regPreview, pairings, rankings }
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
  },

  onLoad(options) {
    const id = options.id ? String(options.id) : 'm3'
    const m = mockById(id)
    this.setData({
      matchId: id,
      match: m.match,
      organizer: m.organizer,
      regPreview: m.regPreview,
      pairings: m.pairings,
      rankings: m.rankings,
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
    wx.navigateTo({url:'/pages/user/person/index?id='+this.data.organizer.id})
  },





  onShareAppMessage() {
    const t = this.data.match.title || '比赛'
    return {
      title: `${t} · 邀请你围观`,
      path: `/pages/match/details/index?id=${this.data.matchId || 'm3'}`,
    }
  },
})
