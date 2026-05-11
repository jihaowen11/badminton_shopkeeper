// pages/club/details/index.js
const { CLUB_DES, DEL_CLUB, INVITE_CLUB, EXIT_CLUB, SET_ADMIN, REMOVE_ADMIN } = require('../../../request/api')

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

function toText(v, fallback = '') {
  const s = v == null ? '' : String(v).trim()
  return s || fallback
}

function toAbbr(text) {
  return toText(text, '俱').slice(0, 1).toUpperCase()
}

function toAvatarUrl(rawAvatar) {
  const path = rawAvatar == null ? '' : String(rawAvatar).trim()
  if (!path) return ''
  try {
    const app = getApp()
    if (app && app.fun && typeof app.fun.joinStaticUrl === 'function') {
      return app.fun.joinStaticUrl(path)
    }
  } catch (e) {}
  return path
}

function formatCreateMonth(createdAt) {
  if (createdAt == null || createdAt === '') return '创建时间: 未知'
  const raw = typeof createdAt === 'number' && createdAt < 1e12 ? createdAt * 1000 : createdAt
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '创建时间: 未知'
  return `创建时间: ${d.getFullYear()}年${d.getMonth() + 1}月`
}

function toRoleView(role) {
  const r = toText(role).toLowerCase()
  if (r === 'owner') return { roleType: 'owner', roleText: '会长' }
  if (r === 'admin') return { roleType: 'admin', roleText: '管理员' }
  return { roleType: 'member', roleText: '成员' }
}

function mapMembersToView(rawMembers) {
  const rows = Array.isArray(rawMembers) ? rawMembers : []
  const mapped = rows.map((m, index) => {
    const user = m && typeof m.user === 'object' ? m.user : {}
    const role = toRoleView(m && m.role)
    const name = toText(user.nickName || (m && m.userName), `成员${index + 1}`)
    const g = Number(user.gender)
    const gender = g === 1 ? 'male' : g === 2 ? 'female' : 'unknown'
    return {
      id: m && m.id != null ? String(m.id) : `member_${index}`,
      userId: toText((m && m.userId) || user.openId),
      name,
      abbr: toAbbr(name),
      avatarUrl: toAvatarUrl(user.avatar || (m && m.userAvatar)),
      roleType: role.roleType,
      roleText: role.roleText,
      gender,
      level: toText(user.badmintonLevel, '未定级'),
    }
  })
  const roleWeight = { owner: 0, admin: 1, member: 2 }
  mapped.sort((a, b) => {
    const wa = roleWeight[a.roleType] != null ? roleWeight[a.roleType] : 99
    const wb = roleWeight[b.roleType] != null ? roleWeight[b.roleType] : 99
    if (wa !== wb) return wa - wb
    return 0
  })
  return mapped
}

function resolveCurrentUserRole(openid, members, clubCreator) {
  const oid = toText(openid)
  if (!oid) return 'member'
  const me = (members || []).find((m) => toText(m && m.userId) === oid)
  if (me && (me.roleType === 'owner' || me.roleType === 'admin')) {
    return me.roleType
  }
  if (toText(clubCreator) === oid) return 'owner'
  return 'member'
}

function hasJoinedClub(openid, members) {
  const oid = toText(openid)
  if (!oid) return false
  return (members || []).some((m) => toText(m && m.userId) === oid)
}

function isProfileCompleted(userInfo) {
  const u = userInfo && typeof userInfo === 'object' ? userInfo : {}
  const nick = toText(u.nickName)
  const avatar = toText(u.avatar)
  if (!nick || nick.indexOf('羽球人') === 0) return false
  if (!avatar) return false
  if (avatar.indexOf('/images/') === 0) return false
  return true
}

function mapClubToView(rawClub, members, openid) {
  const club = rawClub && typeof rawClub === 'object' ? rawClub : {}
  const name = toText(club.name, '未命名俱乐部')
  const owner = members.find((m) => m && m.roleType === 'owner') || members[0] || null
  const memberTotal = members.length
  const male = members.filter((m) => m.gender === 'male').length
  const female = members.filter((m) => m.gender === 'female').length
  return {
    name,
    abbr: toAbbr((owner && owner.name) || name),
    avatarUrl: (owner && owner.avatarUrl) || '',
    location: toText(club.residence, '未设置常驻地'),
    schedule: formatCreateMonth(club.createdAt),
    desc: toText(club.intro, '这个俱乐部还没有填写简介。'),
    memberTotal,
    male,
    female,
    isPresident: toText(club.creator) === toText(openid),
  }
}

Page({
  data: {
    clubId: '',
    statusBarHeight: 44,
    membersScrollTop: 0,
    activeTab: 'members',
    memberCount: 0,
    feedCount: 0,
    currentUserRole: 'member',
    canInvite: false,
    isShareMode: false,
    hasJoined: false,
    joining: false,
    club: {
      name: '',
      abbr: '',
      avatarUrl: '',
      location: '',
      schedule: '',
      desc: '',
      memberTotal: 0,
      male: 0,
      female: 0,
      isPresident: false,
    },
    members: [],
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
    const clubId = options && (options.id || options.clubId)
    const mode = options && options.mode
    if (clubId) {
      this.setData({ clubId: String(clubId) })
    }
    if (String(mode || '').toLowerCase() === 'share') {
      this.setData({ isShareMode: true })
    }
    this.fetchClubDetail()
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
    const role = this.data.currentUserRole
    const target = (this.data.members || []).find((m) => String(m.id) === String(id))
    const targetRole = target && target.roleType ? target.roleType : 'member'
    const targetUserId = toText(target && target.userId)
    const currentUserId = pickOpenId()
    const isSelf = targetUserId !== '' && targetUserId === currentUserId
    const itemList = ['查看资料']
    if (role === 'owner') {
      if (targetRole === 'owner') {
        itemList.push('解散俱乐部')
      } else if (targetRole === 'admin') {
        itemList.push('取消管理员', '移出俱乐部')
      } else {
        itemList.push('设置管理员', '移出俱乐部')
      }
    } else if (role === 'admin') {
      if (isSelf) {
        itemList.push('退出俱乐部')
      } else if(targetRole !== 'owner') {
        itemList.push('移出俱乐部')
      }
    } else if (role === 'member' && isSelf) {
      itemList.push('退出俱乐部')
    }
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const action = itemList[res.tapIndex]
        if (!action) return
        if (action === '查看资料') {
          if (!targetUserId) {
            wx.showToast({ title: '成员信息异常', icon: 'none' })
            return
          }
          wx.navigateTo({ url: `/pages/user/person/index?openId=${encodeURIComponent(targetUserId)}` })
          return
        }
        if (action === '解散俱乐部') {
          this.confirmDisbandClub()
          return
        }
        if (action === '设置管理员') {
          if (!targetUserId) {
            wx.showToast({ title: '成员信息异常', icon: 'none' })
            return
          }
          this.confirmMemberAction({
            title: '设置管理员',
            content: `确认将 ${toText(target && target.name, '该成员')} 设为管理员吗？`,
            loadingText: '设置中...',
            successText: '已设置管理员',
            request: () => SET_ADMIN({ clubId: Number(this.data.clubId), userId: targetUserId }),
          })
          return
        }
        if (action === '取消管理员') {
          if (!targetUserId) {
            wx.showToast({ title: '成员信息异常', icon: 'none' })
            return
          }
          this.confirmMemberAction({
            title: '取消管理员',
            content: `确认取消 ${toText(target && target.name, '该成员')} 的管理员身份吗？`,
            loadingText: '处理中...',
            successText: '已取消管理员',
            request: () => REMOVE_ADMIN({ clubId: Number(this.data.clubId), userId: targetUserId }),
          })
          return
        }
        if (action === '移出俱乐部') {
          if (!targetUserId) {
            wx.showToast({ title: '成员信息异常', icon: 'none' })
            return
          }
          this.confirmMemberAction({
            title: '移出俱乐部',
            content: `确认将 ${toText(target && target.name, '该成员')} 移出俱乐部吗？`,
            loadingText: '移出中...',
            successText: '已移出俱乐部',
            request: () => EXIT_CLUB({ clubId: Number(this.data.clubId), userId: targetUserId }),
          })
          return
        }
        if (action === '退出俱乐部') {
          this.confirmExitClub(targetUserId || currentUserId)
          return
        }
        wx.showToast({ title: `${action}(${id})`, icon: 'none' })
      },
    })
  },

  confirmExitClub(userId) {
    const clubId = Number(this.data.clubId)
    const uid = toText(userId || pickOpenId())
    if (!clubId || !uid) {
      wx.showToast({ title: '参数异常，无法退出', icon: 'none' })
      return
    }
    wx.showModal({
      title: '提示',
      content: '退出后将不再属于该俱乐部，确定继续吗？',
      confirmText: '确认退出',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '退出中...', mask: true })
        EXIT_CLUB({
          clubId,
          userId: uid,
        })
          .then(() => {
            wx.showToast({ title: '已退出俱乐部', icon: 'success' })
            this.fetchClubDetail()
          })
          .catch(() => {})
          .finally(() => {
            wx.hideLoading()
          })
      },
    })
  },

  confirmMemberAction(opts) {
    const title = toText(opts && opts.title, '操作确认')
    const content = toText(opts && opts.content, '确认执行该操作吗？')
    const loadingText = toText(opts && opts.loadingText, '处理中...')
    const successText = toText(opts && opts.successText, '操作成功')
    const request = opts && typeof opts.request === 'function' ? opts.request : null
    if (!request) return
    wx.showModal({
      title,
      content,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: loadingText, mask: true })
        request()
          .then(() => {
            wx.showToast({ title: successText, icon: 'success' })
            this.fetchClubDetail()
          })
          .catch(() => {})
          .finally(() => {
            wx.hideLoading()
          })
      },
    })
  },

  confirmDisbandClub() {
    const clubId = this.data.clubId
    if (!clubId) {
      wx.showToast({ title: '俱乐部信息异常', icon: 'none' })
      return
    }
    wx.showModal({
      title: '是否解散',
      content: '解散后将无法恢复，确定解散该俱乐部吗？',
      confirmText: '确认解散',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '解散中...', mask: true })
        DEL_CLUB({ id: clubId })
          .then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已解散', icon: 'success' })
            setTimeout(() => {
              wx.switchTab({ url: '/pages/mine/index' })
            }, 500)
          })
          .catch(() => {
            wx.hideLoading()
          })
      },
    })
  },

  onTapAdd() {
    wx.showToast({ title: '新增功能接入中', icon: 'none' })
  },

  onJoinClub() {
    if (!this.data.isShareMode) return
    if (this.data.joining) return
    const clubId = Number(this.data.clubId)
    if (!clubId) {
      wx.showToast({ title: '俱乐部信息异常', icon: 'none' })
      return
    }
    if (this.data.hasJoined) {
      wx.showToast({ title: '你已加入该俱乐部', icon: 'none' })
      return
    }

    const app = getApp()
    const openid = pickOpenId()
    const userInfo = (app && app.globalData && app.globalData.userInfo) || {}
    if (!openid) {
      wx.showToast({ title: '请先登录后再加入', icon: 'none' })
      return
    }
    if (!isProfileCompleted(userInfo)) {
      const returnUrl = encodeURIComponent(`/pages/club/details/index?id=${clubId}&mode=share`)
      wx.showModal({
        title: '提示',
        content: '请先完善昵称和头像信息，再加入俱乐部。',
        confirmText: '去完善',
        success: (res) => {
          if (!res.confirm) return
          wx.navigateTo({
            url: `/pages/user/info/index?from=clubShareJoin&clubId=${clubId}&returnUrl=${returnUrl}`,
          })
        },
      })
      return
    }
    const payload = {
      clubId,
      userId: openid,
      userName: toText(userInfo.nickName || userInfo.name, '未命名用户'),
      userAvatar: toText(userInfo.avatar),
      role: 'member',
      joinedAt: new Date().toISOString(),
    }

    this.setData({ joining: true })
    wx.showLoading({ title: '加入中...', mask: true })
    INVITE_CLUB(payload)
      .then(() => {
        wx.showToast({ title: '加入成功', icon: 'success' })
        this.fetchClubDetail()
      })
      .catch(() => {})
      .finally(() => {
        wx.hideLoading()
        this.setData({ joining: false })
      })
  },

  onShareAppMessage() {
    const id = this.data.clubId || '1'
    const randomIndex = Math.floor(Math.random() * 6) + 1
    return {
      title: `邀请你加入「${this.data.club.name}」`,
      path: `/pages/club/details/index?id=${id}&mode=share`,
      imageUrl: `/images/share/${randomIndex}.jpg`,
    }
  },

  fetchClubDetail() {
    const clubId = this.data.clubId
    if (!clubId) return Promise.resolve(null)
    return CLUB_DES({ id: clubId })
      .then((ret) => {
        const payload = ret && typeof ret === 'object' ? ret : {}
        const members = mapMembersToView(payload.members)
        const openid = pickOpenId()
        const currentUserRole = resolveCurrentUserRole(openid, members, payload.club && payload.club.creator)
        const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin'
        const hasJoined = hasJoinedClub(openid, members)
        this.setData({
          club: mapClubToView(payload.club, members, openid),
          members,
          memberCount: members.length,
          currentUserRole,
          canInvite,
          hasJoined,
        })
        return ret
      })
      .catch(() => null)
  },
})
