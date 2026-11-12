//app.js
const { GET_OPENID, FIND_USER } = require('./request/api')
const CONFIG = require('./config')

App({
  onLaunch: function () {
    this.globalData = {
      openid: '',
      userInfo: {},
      serverUrl: CONFIG.serverUrl,
      staticUrl: CONFIG.staticUrl,
      code: CONFIG.code,
      dicts: {
        isAd: true,
      }
    }

    this.fun = {
      /** 头像等静态资源：相对路径拼 globalData.staticUrl；已是 http(s)/wxfile/本地 /images 则原样返回 */
      joinStaticUrl(path) {
        if (path == null || path === '') return ''
        const p = String(path).trim()
        if (!p) return ''
        if (/^(https?:|wxfile:)\/\//i.test(p)) return p
        if (p.startsWith('/') && p.indexOf('/images/') === 0) return p
        const app = getApp()
        const base = (app.globalData.staticUrl || '').replace(/\/$/, '')
        if (!base) return p
        return base + (p.startsWith('/') ? p : '/' + p)
      },
      /** 提交接口用：去掉 staticUrl 前缀，得到相对路径 */
      stripStaticUrl(fullOrRelative) {
        const p = String(fullOrRelative || '').trim()
        if (!p) return ''
        const app = getApp()
        const base = (app.globalData.staticUrl || '').replace(/\/$/, '')
        if (base && p.indexOf(base) === 0) {
          const rest = p.slice(base.length)
          return rest.startsWith('/') ? rest : '/' + rest
        }
        return p
      },
      formatTime(formatStr) {
        var str = formatStr;
        var curData = new Date()
        var Week = ['日', '一', '二', '三', '四', '五', '六'];

        str = str.replace(/yyyy|YYYY/, curData.getFullYear());
        str = str.replace(/yy|YY/, (curData.getYear() % 100) > 9 ? (curData.getYear() % 100).toString() : '0' + (curData.getYear() % 100));

        str = str.replace(/MM/, (curData.getMonth() + 1) > 9 ? (curData.getMonth() + 1).toString() : '0' + (curData.getMonth() + 1));
        str = str.replace(/M/g, curData.getMonth() + 1);

        str = str.replace(/w|W/g, Week[curData.getDay()]);

        str = str.replace(/dd|DD/, curData.getDate() > 9 ? curData.getDate().toString() : '0' + curData.getDate());
        str = str.replace(/d|D/g, curData.getDate());

        str = str.replace(/hh|HH/, curData.getHours() > 9 ? curData.getHours().toString() : '0' + curData.getHours());
        str = str.replace(/h|H/g, curData.getHours());
        str = str.replace(/mm/, curData.getMinutes() > 9 ? curData.getMinutes().toString() : '0' + curData.getMinutes());
        str = str.replace(/m/g, curData.getMinutes());

        str = str.replace(/ss|SS/, curData.getSeconds() > 9 ? curData.getSeconds().toString() : '0' + curData.getSeconds());
        str = str.replace(/s|S/g, curData.getSeconds());

        return str;
      }
    }

    /**
     * 登录就绪信号：需要身份的请求都会等这个 Promise 完成后再发。
     * resolve 结果固定为 { ok, openid, message }，失败也不 reject，
     * 避免调用方出现未捕获的 Promise 拒绝。
     */
    this.loginReady = this.login()
  },

  /**
   * wx.login → 后端换 openid 与 token → 拉取用户资料
   * @returns {Promise<{ok: boolean, openid: string, message: string}>}
   */
  login() {
    return new Promise((resolve) => {
      const done = (payload) =>
        resolve(Object.assign({ ok: false, openid: '', message: '' }, payload))

      wx.login({
        success: (loginRes) => {
          if (!loginRes || !loginRes.code) {
            done({ message: '未获取到登录凭证' })
            return
          }
          GET_OPENID({ code: loginRes.code })
            .then((obj) => {
              const isString = typeof obj === 'string'
              const token = isString ? '' : (obj && (obj.token || obj.accessToken)) || ''
              const openid = isString ? obj : (obj && (obj.openid || obj.openId || obj.openID)) || ''

              if (token) {
                try {
                  wx.setStorageSync('token', token)
                } catch (e) {}
              }
              if (openid) this.globalData.openid = openid
              if (!openid) return null
              return FIND_USER({ openId: openid })
            })
            .then((user) => {
              if (user != null && typeof user === 'object') {
                this.globalData.userInfo = user
              }
              done({ ok: !!this.globalData.openid, openid: this.globalData.openid })
            })
            .catch((err) => {
              done({
                openid: this.globalData.openid,
                message: (err && err.message) || '登录失败',
              })
            })
        },
        fail: () => {
          done({ message: 'wx.login 调用失败' })
        },
      })
    })
  },

  /** 令牌失效时重新登录，结果仍走 loginReady，供请求层复用 */
  relogin() {
    try {
      wx.removeStorageSync('token')
    } catch (e) {}
    this.loginReady = this.login()
    return this.loginReady
  },
})
