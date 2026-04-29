// pages/club/index/index.js
Page({
  data: {
    joinedCount: 3,
    clubScrollTop: 0,
    clubs: [
      {
        id: '1',
        name: '羽林高手俱乐部',
        address: '北京 · 朝阳区',
        memberCount: 26,
        abbr: '羽',
        isPresident: true,
      },
      {
        id: '2',
        name: '周末约球小分队',
        address: '上海 · 浦东新区',
        memberCount: 18,
        abbr: '周',
        isPresident: false,
      },
      {
        id: '3',
        name: '朝阳公园晨练组',
        address: '北京 · 朝阳区',
        memberCount: 32,
        abbr: '朝',
        isPresident: false,
      }
    ],
  },

  onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st !== this.data.clubScrollTop) {
      this.setData({ clubScrollTop: st })
    }
  },

  onCreate() {
    wx.navigateTo({ url: '/pages/club/create/index' })
  },

  onTapClub(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/club/details/index?id=${id}` })
  },
})
