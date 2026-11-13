/**
 * 网络层
 *
 * 约定：
 * - 后端统一返回 { code, object, message }，code === 200 视为成功
 * - code === 401 表示令牌缺失/失效：清掉旧 token、静默重新登录并自动重试一次
 * - 需要身份的请求会先等 app.loginReady（登录就绪），避免首屏请求抢跑拿不到 token
 */

/**
 * 不需要令牌的接口
 * - /users/openid 换登录票据本身不能等登录就绪，否则死锁
 * - /tips/* 是公开内容，不必等登录，首屏能更快出结果
 */
var exceptionAddrArr = ['/users/openid', '/users/findUserByOpenid', '/tips/daily', '/tips/list']

const bus = require('../utils/requestBus')

function getServerBase() {
  try {
    const app = getApp()
    if (app && app.globalData && app.globalData.serverUrl) {
      return app.globalData.serverUrl
    }
  } catch (e) {}
  return ''
}

function getToken() {
  try {
    return wx.getStorageSync('token') || ''
  } catch (e) {
    return ''
  }
}

function needToken(url) {
  return exceptionAddrArr.indexOf(url) === -1
}

/** 等登录就绪；失败也不阻塞业务请求，交给后端 401 兜底 */
function waitLogin() {
  try {
    const app = getApp()
    if (app && app.loginReady && typeof app.loginReady.then === 'function') {
      return Promise.resolve(app.loginReady).catch(() => null)
    }
  } catch (e) {}
  return Promise.resolve(null)
}

/** 令牌失效：清缓存 → 重新登录，返回同一个就绪信号 */
function relogin() {
  try {
    const app = getApp()
    if (app && typeof app.relogin === 'function') return app.relogin()
  } catch (e) {}
  return Promise.resolve(null)
}

//轻提示
function showToast(title) {
  wx.showToast({
    title: title || '操作失败',
    icon: 'none',
    duration: 2000
  })
}

/** 网络层失败统一文案：不弹模态框，避免弱网时每进一个页面都被打断 */
const NETWORK_FAIL_TEXT = '网络连接失败，请检查网络'

// 请求头处理函数
function CreateHeader(url, type) {
  let header = {}
  if (type == 'POST_PARAMS') {
    header = {
      'content-type': 'application/json'
    }
  } else {
    header = {
      'content-type': 'application/json;charset=UTF-8'
    }
  }
  if (needToken(url)) {
    const token = getToken()
    if (token) header['Authorization'] = token
  }
  return header
}

/** wx.uploadFile 由客户端自动带 multipart boundary，不要写死 application/json */
function CreateUploadHeader(url) {
  const header = {}
  if (needToken(url)) {
    const token = getToken()
    if (token) header.Authorization = token
  }
  return header
}

/**
 * 统一解析业务响应
 * @returns {{ok: boolean, object: any, message: string, unauthorized: boolean, hasBody: boolean}}
 */
function parseBody(body) {
  const data = body && typeof body === 'object' ? body : null
  const code = data ? data.code : undefined
  return {
    ok: code == 200,
    object: data ? data.object : undefined,
    message: (data && data.message) || '',
    unauthorized: Number(code) === 401,
    // 后端已经按统一结构返回（哪怕是 400/500），可以直接用它的提示
    hasBody: !!data && code != null && code !== '',
  }
}

//post请求，数据在body中
function postRequest(url, data, options) {
  const opts = options && typeof options === 'object' ? Object.assign({}, options) : {}
  bus.start()
  const gate = needToken(url) ? waitLogin() : Promise.resolve(null)

  return gate.then(
    () =>
      new Promise((resolve, reject) => {
        const finish = () => bus.end()

        wx.request({
          url: getServerBase() + url,
          data: data,
          header: CreateHeader(url, 'POST'),
          method: 'POST',
          success: (res) => {
            finish()
            const parsed = parseBody(res.data)
            if (res.statusCode === 200 && parsed.ok) {
              resolve(
                opts.withMessage
                  ? { object: parsed.object, message: parsed.message }
                  : parsed.object
              )
              return
            }
            if ((parsed.unauthorized || res.statusCode === 401) && !opts._retried) {
              opts._retried = true
              relogin()
                .then(() => postRequest(url, data, opts))
                .then(resolve)
                .catch(reject)
              return
            }
            if (parsed.hasBody) {
              // 后端返回了统一结构（含 500 的 JSON），照它的提示展示
              reject(parsed.object)
              showToast(parsed.message || '操作失败')
              return
            }
            showToast(NETWORK_FAIL_TEXT)
            reject(res)
          },
          fail: (res) => {
            showToast(NETWORK_FAIL_TEXT)
            finish()
            reject(res)
          }
        })
      })
  )
}

//get 请求
function getRequest(url, data, options) {
  const opts = options && typeof options === 'object' ? Object.assign({}, options) : {}
  bus.start()
  const gate = needToken(url) ? waitLogin() : Promise.resolve(null)

  return gate.then(
    () =>
      new Promise((resolve, reject) => {
        const finish = () => bus.end()

        wx.request({
          url: getServerBase() + url,
          data: data,
          header: CreateHeader(url, 'GET'),
          method: 'GET',
          success: (res) => {
            finish()
            const parsed = parseBody(res.data)
            if (res.statusCode === 200 && parsed.ok) {
              resolve(parsed.object)
              return
            }
            // 与 POST 保持一致：令牌失效时静默重登并重试一次
            if ((parsed.unauthorized || res.statusCode === 401) && !opts._retried) {
              opts._retried = true
              relogin()
                .then(() => getRequest(url, data, opts))
                .then(resolve)
                .catch(reject)
              return
            }
            if (parsed.hasBody) {
              reject(parsed.object)
              showToast(parsed.message || '操作失败')
              return
            }
            showToast(NETWORK_FAIL_TEXT)
            reject(res)
          },
          fail: (res) => {
            showToast(NETWORK_FAIL_TEXT)
            finish()
            reject(res)
          }
        })
      })
  )
}

//文件上传（表单字段名 file，与后端 multer 接收一致）
function uploadFile(url, filePath, data) {
  const formData = data && typeof data === 'object' ? data : {}
  bus.start()
  const gate = needToken(url) ? waitLogin() : Promise.resolve(null)

  return gate.then(
    () =>
      new Promise((resolve, reject) => {
        const finish = () => bus.end()

        wx.uploadFile({
          filePath: filePath,
          header: CreateUploadHeader(url),
          name: 'file',
          formData,
          url: getServerBase() + url,
          success: (res) => {
            finish()
            if (res.statusCode !== 200) {
              showToast(NETWORK_FAIL_TEXT)
              reject(res)
              return
            }
            let body
            try {
              body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
            } catch (err) {
              showToast('上传响应异常')
              reject(err)
              return
            }
            const parsed = parseBody(body)
            if (parsed.ok) {
              resolve(parsed.object)
            } else {
              showToast(parsed.message || '上传失败')
              reject(body)
            }
          },
          fail: (res) => {
            showToast(NETWORK_FAIL_TEXT)
            finish()
            reject(res)
          },
        })
      })
  )
}

module.exports.getRequest = getRequest;
module.exports.postRequest = postRequest;
module.exports.uploadFile = uploadFile;
