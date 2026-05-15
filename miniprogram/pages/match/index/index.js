// pages/match/index/index.js
const { MATCH_LIST, MATCH_INCREMENT_VIEWS } = require('../../../request/api')

const DEFAULT_AVATAR = '/images/noheader.jpg'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toText(v, fallback = '') {
  const s = v == null ? '' : String(v).trim()
  return s || fallback
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

function toAvatarUrl(rawAvatar) {
  const path = rawAvatar == null ? '' : String(rawAvatar).trim()
  if (!path) return DEFAULT_AVATAR
  try {
    const app = getApp()
    if (app && app.fun && typeof app.fun.joinStaticUrl === 'function') {
      return app.fun.joinStaticUrl(path)
    }
  } catch (e) {}
  return path || DEFAULT_AVATAR
}

function formatDateTime(startTime, createdAt) {
  const raw = startTime || createdAt
  if (!raw) return { dateText: '--', timeText: '--:--' }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return { dateText: '--', timeText: '--:--' }
  const week = ['日', '一', '二', '三', '四', '五', '六']
  return {
    dateText: `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}（星期${week[d.getDay()]}）`,
    timeText: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  }
}

function mapStatus(status) {
  const s = Number(status)
  if (s === 1) return { status: 'open', statusText: '报名中' }
  if (s === 2) return { status: 'open', statusText: '进行中' }
  if (s === 3) return { status: 'done', statusText: '已结束' }
  if (s === 4) return { status: 'done', statusText: '中断' }
  if (s === 5) return { status: 'done', statusText: '已取消' }
  return { status: 'open', statusText: '报名中' }
}

function mapTypeText(type) {
  const t = Number(type)
  if (t === 1) return '单打'
  if (t === 2) return '双打'
  if (t === 3) return '混双'
  return '比赛'
}

function mapMatchItem(row) {
  const match = (row && row.match) || {}
  const organizer = (row && row.organizer) || {}
  const participants = Array.isArray(row && row.participants) ? row.participants : []
  const club = (row && row.club) || null
  const dt = formatDateTime(match.startTime, match.createdAt)
  const st = mapStatus(match.status)
  const organizerName = toText(organizer.nickName || organizer.name, '球友')
  const previewAvatars = participants
    .map((p) => toAvatarUrl((p && p.user && p.user.avatar) || (p && p.userAvatar)))
    .slice(0, 8)
  const typeText = mapTypeText(match.type)
  const formatText = toText(match.competitionFormat)
  return {
    id: match.id != null ? String(match.id) : '',
    title: toText(match.name, '比赛'),
    dateText: dt.dateText,
    timeText: dt.timeText,
    ruleText: formatText ? `${typeText}，${formatText}` : typeText,
    orgAvatar: toAvatarUrl(organizer.avatar),
    orgText: `${organizerName}组织 ${club ? `· ${club.name}` : ''}`,
    joined: participants.length,
    capacity: Number(match.playerCount || 0),
    views: Number(match.views || 0),
    status: st.status,
    statusText: st.statusText,
    previewAvatars,
  }
}

Page({
  data: {
    pageScrollTop: 0,
    filterLimit: 10,
    filterLabel: '近10场',
    totalCount: 0,
    loading: false,
    matches: [],
  },

  onLoad() {
    this.fetchMatches(this.data.filterLimit)
  },

  onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st !== this.data.pageScrollTop) {
      this.setData({ pageScrollTop: st })
    }
  },

  fetchMatches(pageSize, retryCount = 0) {
    const openId = pickOpenId()
    const limit = pageSize === 50 ? 50 : 10
    if (!openId) {
      if (retryCount < 5) {
        setTimeout(() => this.fetchMatches(limit, retryCount + 1), 300)
      }
      return Promise.resolve([])
    }
    this.setData({
      loading: true,
      filterLimit: limit,
      filterLabel: limit === 50 ? '近50场' : '近10场',
    })
    return MATCH_LIST({ openId, pageSize: limit, page: 1 })
      .then((ret) => {
        const data = ret && typeof ret === 'object' ? ret : {}
        const list = Array.isArray(data.list) ? data.list : []
        const matches = list.map(mapMatchItem).filter((m) => !!m.id)
        this.setData({
          matches,
          totalCount: Number(data.total || matches.length || 0),
        })
        return matches
      })
      .catch(() => {
        this.setData({ matches: [], totalCount: 0 })
        return []
      })
      .finally(() => {
        this.setData({ loading: false })
      })
  },

  onOpenFilter() {
    wx.showActionSheet({
      itemList: ['近10场', '近50场'],
      success: (res) => {
        const limit = res.tapIndex === 1 ? 50 : 10
        this.fetchMatches(limit)
      },
    })
  },

  onTapMatch(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    MATCH_INCREMENT_VIEWS({ id })
      .catch(() => null)
      .finally(() => {
        wx.navigateTo({ url: `/pages/match/details/index?id=${id}` })
      })
  },

  onShareAppMessage() {
    return {
      title: '比赛列表',
      path: '/pages/match/index/index',
    }
  },
})