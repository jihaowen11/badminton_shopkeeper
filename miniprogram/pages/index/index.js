Page({
  data: {
    enter: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar((tabBar) => {
        tabBar.setData({
          current: 'home'
        })
      })
    }
    // 每次进入主页都触发一次入场动画
    this.setData({ enter: false })
    setTimeout(() => {
      this.setData({ enter: true })
    }, 16)
  },

  toClub(){
    wx.navigateTo({url:'/pages/club/index/index'})
  },

  toMatch(){
    wx.navigateTo({url:'/pages/match/index/index'})
  },

  toScoreboard(){
    wx.navigateTo({url:'/pages/scoreboard/index'})
  },

  toCost(){
    wx.navigateTo({url:'/pages/cost/index'})
  }
})
