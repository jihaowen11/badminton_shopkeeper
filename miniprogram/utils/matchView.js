/**
 * 把后端战绩记录（/users/stats 的 recent）转成页面卡片的展示模型
 *
 * 我的页和个人主页的"最近比赛"卡片结构完全一样，抽出来避免两份逻辑漂移。
 * 约定：左队永远是"我这边"，这样列表读起来视线一致。
 */

const { pad2, toText } = require('./format')

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatTimeText(raw) {
  if (!raw) return '--'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '--'
  const now = new Date()
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  if (isSameDay(d, now)) return `今天 ${time}`
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000)
  if (isSameDay(d, yesterday)) return `昨天 ${time}`
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${time}`
}

function abbrOf(name) {
  const s = toText(name, '球友')
  return s.slice(0, 1)
}

function toSide(list, myOpenId) {
  return (Array.isArray(list) ? list : []).map((p) => {
    const isMe = !!myOpenId && String(p && p.openId) === String(myOpenId)
    const name = isMe ? '我' : toText(p && p.name, '球友')
    return {
      name,
      abbr: isMe ? '我' : abbrOf(name),
      openId: (p && p.openId) || '',
    }
  })
}

function mapOne(rec, myOpenId) {
  const isTeam2 = rec && rec.mySide === 'team2'
  const mine = toSide(isTeam2 ? rec.team2 : rec.team1, myOpenId)
  const other = toSide(isTeam2 ? rec.team1 : rec.team2, myOpenId)
  return {
    id: `r${rec.roundId}`,
    roundId: rec.roundId,
    matchId: rec.matchId,
    result: rec.result === 'win' ? 'win' : 'loss',
    // 八人转转的都是双打，人数不足 2 人时按单打渲染，避免出现空位
    type: mine.length >= 2 ? 'double' : 'single',
    timeText: formatTimeText(rec.startTime),
    clubName: toText(rec.clubName, toText(rec.matchName, '羽毛球活动')),
    roundLabel: toText(rec.roundLabel),
    scoreText: toText(rec.scoreText, '--'),
    left: mine,
    right: other,
  }
}

/** @param {Array} list 后端 recent 数组 @param {string} myOpenId 当前查看的用户 */
function mapRecentMatches(list, myOpenId) {
  return (Array.isArray(list) ? list : []).map((rec) => mapOne(rec, myOpenId))
}

/** 统计数字的展示文本，没打过就是 "--" 而不是 0 */
function formatStats(summary) {
  const s = summary && typeof summary === 'object' ? summary : {}
  const played = Number(s.played) || 0
  const win = Number(s.win) || 0
  const rate = s.winRate
  return {
    playedText: played > 0 ? String(played) : '0',
    winText: played > 0 ? String(win) : '0',
    winRateText: rate == null ? '--' : `${rate}%`,
    streakText: played > 0 ? (toText(s.streakText) || '0') : '0',
    diffText: Number(s.diff) > 0 ? `+${s.diff}` : String(Number(s.diff) || 0),
  }
}

module.exports = {
  mapRecentMatches,
  formatStats,
  formatTimeText,
}
