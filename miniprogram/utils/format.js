/**
 * 取值与格式化小工具
 *
 * 这几行代码原先在 6～8 个页面里各写一份（pad2 / toText），
 * 改一处很容易漏掉另一处，统一收到这里。
 */

/** 2 → '02'，拼日期时间用 */
function pad2(n) {
  return String(n).padStart(2, '0')
}

/** 取字符串：null / undefined / 纯空白都落到 fallback */
function toText(v, fallback = '') {
  const s = v == null ? '' : String(v).trim()
  return s || fallback
}

module.exports = {
  pad2,
  toText,
}
