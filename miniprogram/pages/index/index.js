const { STATS_OVERVIEW, TIP_DAILY } = require('../../request/api')
const { brandCard } = require('../../utils/shareCard')

const TIP_CACHE_KEY = 'tip_daily_cache'

/** 大数字缩写：0 → "0"，1234 → "1.2K" */
function formatCount(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return '0'
  if (v < 1000) return String(Math.floor(v))
  if (v < 10000) return `${Math.round(v / 100) / 10}K`
  return `${Math.round(v / 1000)}K`
}

/** 断网时用上一次成功拿到的贴士兜底，避免卡片突然空掉 */
function readTipCache() {
  try {
    const v = wx.getStorageSync(TIP_CACHE_KEY)
    if (!v || typeof v !== 'object' || !v.content) return null
    // 只取展示需要的字段，兼容早期写入的旧结构
    return {
      category: v.category ? String(v.category) : '',
      content: String(v.content),
    }
  } catch (e) {
    return null
  }
}

Page({
  data: {
    enter: false,
    // 三个数字来自 /stats/overview 的真实统计，加载前显示 "--"
    overview: {
      usersText: '--',
      roundsText: '--',
      clubsText: '--',
    },
    // 今日贴士，加载完成前显示占位文案
    tipLoading: true,
    tipVisible: false,
    tip: {
      category: '',
      content: '',
    },
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
    this.fetchOverview()
    this.fetchTip()
  },

  fetchOverview() {
    return STATS_OVERVIEW({})
      .then((data) => {
        const d = data && typeof data === 'object' ? data : {}
        this.setData({
          overview: {
            usersText: formatCount(d.users),
            roundsText: formatCount(d.finishedRounds),
            clubsText: formatCount(d.clubs),
          },
        })
        return d
      })
      .catch(() => {
        // 拿不到就保持 "--"，不兜底假数字
        return null
      })
  },

  /**
   * 今日贴士：后端按北京时间的日期轮换，同一天所有人看到同一条。
   * 失败时优先用本地缓存，再没有就整块隐藏，不留空白卡片。
   */
  fetchTip() {
    return TIP_DAILY({})
      .then((data) => {
        const d = data && typeof data === 'object' ? data : {}
        const content = d.content ? String(d.content).trim() : ''
        if (!content) throw new Error('empty tip')
        const tip = {
          category: d.category ? String(d.category) : '',
          content,
        }
        try {
          wx.setStorageSync(TIP_CACHE_KEY, tip)
        } catch (e) {}
        this.setData({ tip, tipVisible: true, tipLoading: false })
        return tip
      })
      .catch(() => {
        const cached = readTipCache()
        if (cached) {
          this.setData({ tip: cached, tipVisible: true, tipLoading: false })
        } else {
          this.setData({ tipVisible: false, tipLoading: false })
        }
        return null
      })
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
  },

  /** 首页是几乎所有分享的落地页，也应能从右上角菜单直接转发出去 */
  onShareAppMessage() {
    return brandCard()
  }
})
