/**
 * 页面滚动 → back 组件蒙版的同步器
 *
 * 页面原先每收到一次 onPageScroll 就 setData 一次 scrollTop，滚一次列表要跨线程通信几十上百次，
 * 低端机上会明显掉帧；而 back 组件真正需要的只是"有没有越过阈值"这一个布尔值。
 * 这里只在跨过阈值的那一刻 setData 一次，方向上下都覆盖。
 *
 * @param {string} field 页面 data 里存 scrollTop 的字段名
 * @param {number} [threshold] 蒙版阈值(px)，要和 wxml 里 <back maskThreshold> 传的值一致
 * @returns {(e: {scrollTop: number}) => void} 可直接赋给 onPageScroll
 */
function createScrollSync(field, threshold) {
  const th = Number(threshold) > 0 ? Number(threshold) : 10
  return function onPageScroll(e) {
    const st = e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    if (st < 0) return
    const next = st > th
    const prev = Number(this.data[field]) > th
    if (next === prev) return
    const patch = {}
    patch[field] = st
    this.setData(patch)
  }
}

module.exports = { createScrollSync }
