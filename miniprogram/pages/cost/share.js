// pages/cost/share.js
// 把账单压进分享路径。分享卡片只能带 query，账单不跟着走的话，
// 好友点开看到的是他自己的本地草稿，卡片上却写着你这场的金额——完全对不上。
//
// 编码格式（只求短、可读性无所谓）：
//   名字1,名字2|类型,金额,数量,垫付人下标;类型,金额,数量,垫付人下标
//   类型 c = 场地费（金额即总价），s = 球费（金额是单价，数量是球数）

const { DEFAULT_AVATAR } = require('../../utils/static')

const MAX_NAMES = 16
const MAX_LINES = 8
// encodeURIComponent 之后的长度上限。微信分享 path 约 1KB，留出余量给域名和参数名
const MAX_QLEN = 780
const MAX_NAME_LEN = 12

function cleanName(s) {
  return String(s == null ? '' : s)
    .replace(/[,;|]/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LEN)
}

/** 金额归一：非法或非正数返回空串，导入时该行会被丢掉 */
function normMoney(v) {
  const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return ''
  return String(Math.round(n * 100) / 100)
}

/**
 * @returns {string} 已 URL 编码的载荷；无法安全分享时返回空串（调用方退化为不带数据）
 */
function encodeBill(participants, lineItems) {
  const people = (Array.isArray(participants) ? participants : []).slice(0, MAX_NAMES)
  const lines = (Array.isArray(lineItems) ? lineItems : []).slice(0, MAX_LINES)
  if (people.length === 0 || lines.length === 0) return ''

  const indexOfPayer = {}
  people.forEach((p, i) => {
    indexOfPayer[p.id] = i
  })

  const namePart = people
    .map((p, i) => cleanName(p.name) || `球友${i + 1}`)
    .join(',')

  const linePart = lines
    .map((it) => {
      const idx = indexOfPayer[it.payerId]
      const payer = Number.isInteger(idx) && idx >= 0 ? idx : 0
      const isShuttle = it.type === 'shuttle'
      const value = isShuttle ? normMoney(it.unitPrice) : normMoney(it.courtAmount)
      if (!value) return ''
      const qty = isShuttle ? Math.max(1, Math.floor(Number(it.qty) || 0)) : 1
      return `${isShuttle ? 's' : 'c'},${value},${qty},${payer}`
    })
    .filter(Boolean)
    .join(';')

  if (!linePart) return ''

  const encoded = encodeURIComponent(`${namePart}|${linePart}`)
  // 超长就整份不带，不做裁剪：人数和金额会被截得对不上，比不带更糟
  return encoded.length > MAX_QLEN ? '' : encoded
}

/**
 * @returns {{participants: Array, lineItems: Array}|null} 解析失败返回 null，页面按普通模式打开
 */
function decodeBill(raw) {
  const s = String(raw == null ? '' : raw)
  if (!s) return null

  // 微信传进来的 query 有的场景是编码过的、有的已经是明文，两种都要能吃
  let payload = s
  if (s.indexOf('%') >= 0) {
    try {
      payload = decodeURIComponent(s)
    } catch (e) {
      payload = s
    }
  }

  const parts = payload.split('|')
  if (parts.length !== 2) return null

  const names = parts[0]
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, MAX_NAMES)
  if (names.length === 0) return null

  const participants = names.map((name, i) => ({ id: `s${i}`, name, avatar: DEFAULT_AVATAR }))

  const lineItems = []
  parts[1].split(';').forEach((row) => {
    const f = row.split(',')
    if (f.length < 4) return
    const isShuttle = f[0] === 's'
    const value = normMoney(f[1])
    if (!value) return
    const qty = isShuttle ? Math.max(1, Math.floor(Number(f[2]) || 1)) : 1
    const idx = Math.floor(Number(f[3]))
    const payerId = participants[Number.isInteger(idx) && idx >= 0 && idx < participants.length ? idx : 0].id
    lineItems.push({
      id: `sl${lineItems.length}`,
      type: isShuttle ? 'shuttle' : 'court',
      label: isShuttle ? '球费' : '场地费',
      courtAmount: isShuttle ? '' : value,
      unitPrice: isShuttle ? value : '',
      qty,
      payerId,
    })
  })

  if (lineItems.length === 0) return null
  return { participants, lineItems }
}

module.exports = { encodeBill, decodeBill, MAX_NAMES, MAX_LINES, MAX_QLEN }
