// pages/club/index/index.js
const { CLUB_MY_LIST } = require('../../../request/api')
const { whenLoginReady, pickOpenId } = require('../../../utils/auth')
const { toStaticUrl } = require('../../../utils/static')
const { createScrollSync } = require('../../../utils/scrollSync')

function toDisplayName(name) {
  const text = name == null ? '' : String(name).trim()
  return text || '未知'
}

function toAbbr(name) {
  return toDisplayName(name).slice(0, 1).toUpperCase()
}

function isOwnerMember(member, clubCreator) {
  if (!member || typeof member !== 'object') return false
  const role = member.role == null ? '' : String(member.role).toLowerCase()
  return role === 'owner' || (clubCreator && String(member.userId || '') === String(clubCreator))
}

function mapClubToView(item, openid, index) {
  const club = (item && item.club) || {}
  const members = Array.isArray(item && item.members) ? item.members : []
  const owner = members.find((m) => isOwnerMember(m, club.creator)) || members[0] || null
  const isPresident = String(club.creator || '') === String(openid)
  return {
    id: club.id != null ? String(club.id) : `club_${index}`,
    name: toDisplayName(club.name || '未命名俱乐部'),
    address: toDisplayName(club.residence || '未设置常驻地'),
    memberCount: members.length,
    abbr: toAbbr((owner && owner.userName) || club.name),
    avatarUrl: toStaticUrl(owner && owner.userAvatar),
    isPresident,
  }
}

Page({
  data: {
    joinedCount: 0,
    clubScrollTop: 0,
    clubs: [],
  },

  onPageScroll: createScrollSync('clubScrollTop', 30),

  onCreate() {
    wx.navigateTo({ url: '/pages/club/create/index' })
  },

  onTapClub(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/club/details/index?id=${id}` })
  },

  /** 我的俱乐部：等服务端登录就绪后再拉取，身份由令牌决定 */
  fetchMyClubList() {
    return whenLoginReady()
      .then(() => CLUB_MY_LIST({ openId: pickOpenId() }))
      .then((list) => {
        const openid = pickOpenId()
        const raw = Array.isArray(list) ? list : []
        const clubs = raw.map((item, index) => mapClubToView(item, openid, index))
        this.setData({
          clubs,
          joinedCount: clubs.length,
        })
        return clubs
      })
      .catch(() => {
        this.setData({
          clubs: [],
          joinedCount: 0,
        })
        return []
      })
  },

  onShow() {
    this.fetchMyClubList()
  },
})
