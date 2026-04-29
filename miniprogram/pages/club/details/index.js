// pages/club/details/index.js
Page({
  data: {
    clubId: '',
    statusBarHeight: 44,
    membersScrollTop: 0,
    activeTab: 'members',
    memberCount: 8,
    feedCount: 4,
    club: {
      name: '羽林高手俱乐部',
      abbr: '张',
      location: '北京 · 朝阳区体育馆',
      schedule: '活动时间: 周三 / 周六',
      desc: '热爱羽毛球的小伙伴们聚集地，每周三和周六固定活动，欢迎各水平球友加入！',
      memberTotal: 26,
      male: 5,
      female: 3,
      isPresident: true,
    },
    members: [
      { id: '1', name: '张强', abbr: '张', role: 'president', gender: 'male', level: '高级', avatarTone: 'green' },
      { id: '2', name: '李明', abbr: '李', role: 'admin', gender: 'male', level: '中级', avatarTone: 'blue' },
      { id: '3', name: '王芳', abbr: '王', role: 'member', gender: 'female', level: '中级', avatarTone: 'pink' },
      { id: '4', name: '赵敏', abbr: '赵', role: 'member', gender: 'female', level: '初级', avatarTone: 'pink' },
      { id: '5', name: '陈浩', abbr: '陈', role: 'member', gender: 'male', level: '高级', avatarTone: 'green' },
    ],
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
    if (options.id) {
      this.setData({ clubId: String(options.id) })
    }
  },

  onTabMembers() {
    this.setData({ activeTab: 'members', membersScrollTop: 0 })
  },

  onTabFeed() {
    this.setData({ activeTab: 'feed', membersScrollTop: 0 })
  },

  onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st !== this.data.membersScrollTop) {
      this.setData({ membersScrollTop: st })
    }
  },

  onMemberMore(e) {
    const id = e.currentTarget.dataset.id
    wx.showActionSheet({
      itemList: ['查看资料', '设置为管理员', '移出俱乐部'],
      success() {},
    })
  },

  onTapAdd() {
    wx.showToast({ title: '新增功能接入中', icon: 'none' })
  },

  onShareAppMessage() {
    const id = this.data.clubId || '1'
    return {
      title: `邀请你加入「${this.data.club.name}」`,
      path: `/pages/club/details/index?id=${id}`,
    }
  },
})
