// pages/match/create/index.js

function pad2(n) {
  return String(n).padStart(2, '0')
}

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
  const p = Number(people) || 4
  const max = Math.max(1, Math.min(8, p))
  const list = []
  for (let i = 1; i <= max; i += 1) {
    list.push({ value: i, label: `${i}场` })
  }
  return list
}

Page({
  data: {
    pageScrollTop: 0,
    mode: 'on', // pre | on

    matchTypes: [{ id: 'eight', title: '八人转' }],
    selectedTypeIndex: 0,

    matchName: '',
    nameMax: 20,
    nameLen: 0,
    nameTouched: false,

    peopleCount: 8,
    roundOptions: buildRoundOptions(8),
    selectedRound: 3,

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
      { id: 'c1', name: '羽林高手俱乐部' },
      { id: 'c2', name: '周末约球小分队' },
      { id: 'c3', name: '朝阳公园晨练组' },
    ],
    clubId: '',
    clubText: '',
  },

  onLoad() {
    this.syncDefaultName()
  },

  onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st !== this.data.pageScrollTop) {
      this.setData({ pageScrollTop: st })
    }
  },

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
    let selectedRound = this.data.selectedRound
    const max = roundOptions.length ? roundOptions[roundOptions.length - 1].value : 1
    if (selectedRound > max) selectedRound = max
    if (selectedRound < 1) selectedRound = 1
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

  onPickClub() {
    const items = this.data.clubOptions || []
    wx.showActionSheet({
      itemList: ['不关联俱乐部'].concat(items.map((c) => c.name)),
      success: (res) => {
        if (res.tapIndex === 0) {
          this.setData({ clubId: '', clubText: '' })
          return
        }
        const idx = res.tapIndex - 1
        const c = items[idx]
        if (!c) return
        this.setData({ clubId: c.id, clubText: c.name })
      },
    })
  },

  noop() {},

  onCreateMatch() {
    const name = (this.data.matchName || '').trim()
    const typeTitle = this.getTypeTitle()
    const system = this.data.systems.find((s) => s.id === this.data.systemId)
    const payload = {
      mode: this.data.mode, // pre | on
      name,
      type: typeTitle,
      peopleCount: this.data.peopleCount,
      rounds: this.data.selectedRound,
      system: system ? system.title : this.data.systemId,
      club: this.data.clubId ? { id: this.data.clubId, name: this.data.clubText } : null,
      matchTime:
        this.data.mode === 'pre'
          ? { date: this.data.matchDate, time: this.data.matchTime }
          : null,
      venue: this.data.mode === 'pre' ? (this.data.venueText || '').trim() : null,
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
      if (!payload.venue) {
        wx.showToast({ title: '请选择场地', icon: 'none' })
        return
      }
    }

    console.log('[createMatch]', payload)
    wx.showToast({ title: '已打印到控制台', icon: 'none' })
  },
})