/**
 * 请求计数器
 *
 * 为什么需要：app.json 全局是 navigationStyle: custom，微信原生导航栏不存在，
 * 所以 wx.showNavigationBarLoading() 在自定义导航下没有任何视觉表现。
 * 这里用一个极简的发布订阅把"当前有几个请求在飞"广播给页面里的 loading-bar。
 */
let pending = 0
const listeners = []

function emit() {
  for (const fn of listeners.slice()) {
    try {
      fn(pending)
    } catch (e) {}
  }
}

function start() {
  pending += 1
  emit()
  return pending
}

function end() {
  pending = Math.max(0, pending - 1)
  emit()
  return pending
}

/**
 * 订阅计数变化，立即回调一次当前值
 * @returns {Function} 取消订阅
 */
function subscribe(fn) {
  if (typeof fn !== 'function') return () => {}
  listeners.push(fn)
  try {
    fn(pending)
  } catch (e) {}
  return () => {
    const i = listeners.indexOf(fn)
    if (i >= 0) listeners.splice(i, 1)
  }
}

function getPending() {
  return pending
}

module.exports = { start, end, subscribe, getPending }
