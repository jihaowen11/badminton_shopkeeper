// pages/match/create/index.js
const { CLUB_MY_LIST, CREATE_MATCH } = require('../../../request/api')
const { whenLoginReady, pickOpenId } = require('../../../utils/auth')
const { pad2, toText } = require('../../../utils/format')
const { createScrollSync } = require('../../../utils/scrollSync')

function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function ymdToCnMd(ymd) {
  if (!ymd) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd))
  if (!m) return ''
  const mm = Number(m[2])
  const dd = Number(m[3])
  if (!mm || !dd) return ''
  return `${mm}月${dd}日`
}

function buildRoundOptions(people) {
  const p = Math.max(4, Math.min(13, Number(people) || 4))
  let rounds = []
  if (p === 4) {
    rounds = [3, 6, 9, 12]
  } else if (p === 5) {
    rounds = [5, 10, 15]
  } else if (p === 6) {
    rounds = [6, 9, 15]
  } else if (p === 7) {
    rounds = [14, 21]
  } else {
    const raw = (p * (p - 1)) / 4
    if (Number.isInteger(raw)) {
      rounds = [raw]
    } else {
      const low = Math.floor(raw)
      const high = Math.ceil(raw)
      rounds = low === high ? [low] : [low, high]
    }
  }
  return rounds
    .filter((v) => Number.isFinite(v) && v > 0)
    .map((v) => ({ value: v, label: `${v}场` }))
}

function mapMyClubOptions(rawList) {
  const list = Array.isArray(rawList) ? rawList : []
  return list
    .map((item) => {
      const club = item && item.club ? item.club : {}
      const id = club && club.id != null ? String(club.id) : ''
      const name = club && club.name != null ? String(club.name).trim() : ''
      if (!id || !name) return null
      return { id, name }
    })
    .filter(Boolean)
}

function parseTargetScore(systemId) {
  if (systemId === 'sg15') return 15
  if (systemId === 'sg21') return 21
  return null
}

Page({
  data: {
    pageScrollTop: 0,
    mode: 'on', // pre | on

    matchTypes: [{ id: 'eight', title: '八人转 · 双打' }],
    selectedTypeIndex: 0,

    matchName: '',
    nameMax: 20,
    nameLen: 0,
    nameTouched: false,

    peopleCount: 8,
    roundOptions: buildRoundOptions(8),
    selectedRound: buildRoundOptions(8)[0].value,

    systems: [
      { id: 'sg21', title: '一局定胜负·21分制' },
      { id: 'sg15', title: '一局定胜负·15分制' },
      // { id: 'bo311', title: '三局两胜·11分制' },
      // { id: 'bo321', title: '三局两胜·21分制' },
    ],
    systemId: 'sg21',

    matchDate: todayYmd(),
    matchTime: '19:00',

    venueText: '',
    venueInputVisible: false,
    tempVenue: '',

    clubOptions: [
    ],
    clubPickerNames: [
      '不关联俱乐部',
    ],
    clubPickerIndex: 0,
    clubId: '',
    clubText: '',
  },

  onLoad(options) {
    // 从俱乐部动态的空状态进来时会带 clubId，默认选中该俱乐部
    const preset = options && options.clubId != null ? String(options.clubId).trim() : ''
    this._presetClubId = preset
    this.syncDefaultName()
    this.fetchMyClubs()
  },

  onPageScroll: createScrollSync('pageScrollTop', 10),

  getTypeTitle() {
    const idx = this.data.selectedTypeIndex
    const item = this.data.matchTypes[idx]
    return item ? item.title : '八人转'
  },

  syncDefaultName() {
    if (this.data.nameTouched) return
    const md = ymdToCnMd(this.data.matchDate) || '今天'
    const typeTitle = this.getTypeTitle()
    const next = `${md}${typeTitle}`
    this.setData({ matchName: next, nameLen: next.length })
  },

  onSelectMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode !== 'pre' && mode !== 'on') return
    this.setData({ mode })
    // 切换到现场组织时，仍然保留日期用于默认名称，但不强制显示时间/场地
    this.syncDefaultName()
  },

  onNameInput(e) {
    const v = (e.detail.value || '').slice(0, this.data.nameMax)
    this.setData({ matchName: v, nameLen: v.length, nameTouched: true })
  },

  onSelectType(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return
    this.setData({ selectedTypeIndex: index })
    this.syncDefaultName()
  },

  onPeopleChange(e) {
    const v = Number(e.detail)
    const peopleCount = Number.isFinite(v) ? v : this.data.peopleCount
    const roundOptions = buildRoundOptions(peopleCount)
    const current = Number(this.data.selectedRound)
    const values = roundOptions.map((it) => it.value)
    const selectedRound = values.includes(current) ? current : (values[0] || 1)
    this.setData({ peopleCount, roundOptions, selectedRound })
  },

  onSelectRound(e) {
    const v = Number(e.currentTarget.dataset.value)
    if (!Number.isFinite(v)) return
    this.setData({ selectedRound: v })
  },

  onSelectSystem(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    this.setData({ systemId: id })
  },

  onPickDate(e) {
    const v = e.detail.value
    this.setData({ matchDate: v })
    this.syncDefaultName()
  },

  onPickTime(e) {
    const v = e.detail.value
    this.setData({ matchTime: v })
  },

  onTapVenue() {
    wx.showActionSheet({
      itemList: ['地图选点', '手动输入'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.chooseLocation({
            success: (loc) => {
              const parts = [loc.name, loc.address].filter(Boolean)
              const text = parts.join(' · ') || '已选场地'
              this.setData({ venueText: text })
            },
            fail: (err) => {
              if (err.errMsg && err.errMsg.indexOf('cancel') !== -1) return
              wx.showToast({ title: '需要位置权限才能选点', icon: 'none' })
            },
          })
        } else if (res.tapIndex === 1) {
          this.setData({
            venueInputVisible: true,
            tempVenue: this.data.venueText || '',
          })
        }
      },
    })
  },

  onCloseVenueInput() {
    this.setData({ venueInputVisible: false })
  },

  onTempVenueInput(e) {
    this.setData({ tempVenue: e.detail.value || '' })
  },

  onConfirmVenueInput() {
    const t = (this.data.tempVenue || '').trim()
    if (!t) {
      wx.showToast({ title: '请输入场地', icon: 'none' })
      return
    }
    this.setData({ venueText: t, venueInputVisible: false })
  },

  fetchMyClubs() {
    return whenLoginReady()
      .then(() => CLUB_MY_LIST({ openId: pickOpenId() }))
      .then((list) => {
        const clubOptions = mapMyClubOptions(list)
        const clubPickerNames = ['不关联俱乐部'].concat(clubOptions.map((c) => c.name))
        const presetId = toText(this._presetClubId)
        const presetIndex = presetId
          ? clubOptions.findIndex((c) => toText(c.id) === presetId)
          : -1
        const selected = presetIndex >= 0 ? clubOptions[presetIndex] : null
        this.setData({
          clubOptions,
          clubPickerNames,
          clubPickerIndex: selected ? presetIndex + 1 : 0,
          clubId: selected ? selected.id : '',
          clubText: selected ? selected.name : '',
        })
        return clubOptions
      })
      .catch(() => {
        this.setData({
          clubOptions: [],
          clubPickerNames: ['不关联俱乐部'],
          clubPickerIndex: 0,
          clubId: '',
          clubText: '',
        })
        return []
      })
  },

  onPickClubChange(e) {
    const index = Number(e && e.detail && e.detail.value)
    if (!Number.isFinite(index) || index < 0) return
    if (index === 0) {
      this.setData({ clubPickerIndex: 0, clubId: '', clubText: '' })
      return
    }
    const clubOptions = this.data.clubOptions || []
    const selected = clubOptions[index - 1]
    if (!selected) return
    this.setData({
      clubPickerIndex: index,
      clubId: selected.id,
      clubText: selected.name,
    })
  },

  noop() {},

  onCreateMatch() {
    const openId = pickOpenId()
    const name = (this.data.matchName || '').trim()
    const typeTitle = this.getTypeTitle()
    const system = this.data.systems.find((s) => s.id === this.data.systemId)
    const clubId = this.data.clubId ? Number(this.data.clubId) : null
    const startTime =
      this.data.mode === 'pre' && this.data.matchDate && this.data.matchTime
        ? `${this.data.matchDate} ${this.data.matchTime}:00`
        : null
    const address = this.data.mode === 'pre' ? (this.data.venueText || '').trim() : ''
    const payload = {
      clubId,
      type: 2, // 八人转固定双打
      organizeMode: this.data.mode === 'pre' ? 2 : 1,
      name,
      competitionFormat: system ? system.title : this.data.systemId,
      targetScore: parseTargetScore(this.data.systemId),
      bestOf: 1,
      status: 1,
      startTime,
      address: address || null,
      createdBy: openId || null,
      playerCount: this.data.peopleCount,
      sessionCount: this.data.selectedRound
    }

    if (!name) {
      wx.showToast({ title: '请填写比赛名称', icon: 'none' })
      return
    }
    if (this.data.mode === 'pre') {
      if (!this.data.matchDate) {
        wx.showToast({ title: '请选择比赛日期', icon: 'none' })
        return
      }
      if (!this.data.matchTime) {
        wx.showToast({ title: '请选择比赛时间', icon: 'none' })
        return
      }
      if (!payload.address) {
        wx.showToast({ title: '请选择场地', icon: 'none' })
        return
      }
    }
    wx.showLoading({ title: '创建中...', mask: true })
    CREATE_MATCH(payload)
      .then((obj) => {
        // 后端没回 id 说明这次创建结果不可用，不能编一个 id 跳到不存在的比赛
        const id = obj && obj.id != null ? String(obj.id) : ''
        if (!id) {
          wx.showToast({ title: '创建结果异常，请到列表查看', icon: 'none' })
          return
        }
        wx.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/match/details/index?id=${encodeURIComponent(id)}&clubId=${clubId || ''}&created=1`,
          })
        }, 500)
      })
      .catch(() => {})
      .finally(() => {
        wx.hideLoading()
      })
  },
})