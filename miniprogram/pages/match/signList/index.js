// pages/match/signList/index.js
const { MATCH_DES, MATCH_PARTICIPANT_DELETE } = require('../../../request/api')
const { pickOpenId } = require('../../../utils/auth')
const { toText } = require('../../../utils/format')
const { toStaticUrl } = require('../../../utils/static')
const { createScrollSync } = require('../../../utils/scrollSync')

function mapParticipantsToView(participants, organizerOpenId) {
  const tones = ['green', 'blue', 'pink', 'orange']
  const list = Array.isArray(participants) ? participants : []
  const orgId = toText(organizerOpenId)
  return list.map((p, idx) => {
    const user = p && typeof p.user === 'object' ? p.user : {}
    const name = toText(user.nickName || p.userName, '球友')
    const openId = toText(p.userId || user.openId || user.openid || user.openID)
    return {
      id: p && p.id != null ? String(p.id) : `p_${idx}`,
      openId,
      name,
      abbr: name.slice(0, 1),
      tone: tones[idx % tones.length],
      avatarUrl: toStaticUrl((user && user.avatar) || p.userAvatar),
      isOrganizer: !!orgId && openId === orgId,
    }
  })
}

Page({
  data: {
    matchId: '',
    pageScrollTop: 0,
    loading: true,
    isOrganizer: false,
    /** 报名中且为组织者时可取消他人报名 */
    canCancelSign: false,
    match: {
      title: '',
      joined: 0,
      capacity: 0,
      statusCode: 0,
      statusText: '',
    },
    members: [],
  },

  onLoad(options) {
    const id = options && options.id ? String(options.id) : ''
    if (!id) {
      wx.showToast({ title: '比赛信息异常', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    this.setData({ matchId: id })
    this.fetchSignList()
  },

  onPageScroll: createScrollSync('pageScrollTop', 10),

  fetchSignList() {
    const matchId = toText(this.data.matchId)
    if (!matchId) return Promise.resolve(null)
    this.setData({ loading: true })
    return MATCH_DES({ id: matchId })
      .then((ret) => {
        const payload = ret && typeof ret === 'object' ? ret : {}
        const participants = Array.isArray(payload.participants) ? payload.participants : []
        const rawMatch = payload.match && typeof payload.match === 'object' ? payload.match : {}
        const createdBy = toText(rawMatch.createdBy)
        const currentOpenId = pickOpenId()
        const isOrganizer = !!currentOpenId && currentOpenId === createdBy
        const statusCode = Number(rawMatch.status || 0)
        const canCancelSign = isOrganizer && statusCode === 1
        this.setData({
          loading: false,
          isOrganizer,
          canCancelSign,
          match: {
            title: toText(rawMatch.name, '比赛'),
            joined: participants.length,
            capacity: Number(rawMatch.playerCount || 0),
            statusCode,
            statusText: statusCode === 1 ? '报名中' : '',
          },
          members: mapParticipantsToView(participants, createdBy),
        })
        return ret
      })
      .catch(() => {
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
        return null
      })
  },

  onTapMember(e) {
    const openId = toText(e.currentTarget.dataset.openId)
    if (!openId) return
    wx.navigateTo({ url: `/pages/user/person/index?openId=${encodeURIComponent(openId)}` })
  },

  onCancelSign(e) {
    if (!this.data.canCancelSign) {
      wx.showToast({ title: '仅报名中可取消报名', icon: 'none' })
      return
    }
    const id = toText(e.currentTarget.dataset.id)
    const name = toText(e.currentTarget.dataset.name, '该球友')
    if (!id) return
    wx.showModal({
      title: '取消报名',
      content: `确认取消「${name}」的报名吗？`,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...', mask: true })
        MATCH_PARTICIPANT_DELETE({ id })
          .then(() => {
            wx.showToast({ title: '已取消报名', icon: 'success' })
            return this.fetchSignList()
          })
          .catch(() => {
            wx.showToast({ title: '操作失败，请稍后重试', icon: 'none' })
          })
          .finally(() => {
            wx.hideLoading()
          })
      },
    })
  },
})
