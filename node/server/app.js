const Koa = require('koa')
const app = new Koa()
const views = require('koa-views')
const json = require('koa-json')
const onerror = require('koa-onerror')
const bodyparser = require('koa-bodyparser')
const logger = require('koa-logger')
const cors = require('koa-cors')
const convert = require('koa-convert')

const auth = require('./middlewares/auth')
const R = require('./utils/responseBeautifier')

const index = require('./routes/index')
const users = require('./routes/users')
const clubs = require('./routes/clubs')
const clubMembers = require('./routes/clubMembers')
const matches = require('./routes/matches')
const matchParticipants = require('./routes/matchParticipants')
const matchScores = require('./routes/matchScores')
const matchRounds = require('./routes/matchRounds')
const stats = require('./routes/stats')
const tips = require('./routes/tips')


// error handler
onerror(app)

// 跨域必须放在路由之前，否则 OPTIONS 预检和响应头都不会生效。
// koa-cors@0.0.x 是 generator 中间件，Koa2 下要用 koa-convert 包一层。
app.use(convert(cors({ origin: true })))

/**
 * 统一异常出口
 *
 * 默认 onerror 会给浏览器渲染 HTML 错误页，而小程序只会解析 { code, object, message }，
 * 拿到 HTML 时一律显示"网络失败"，真正的错误信息全被吞掉。
 * 这里把下游抛出的异常统一转成 JSON，并保留 HTTP 状态码便于日志排查。
 */
app.use(async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    const status = Number(err && (err.status || err.statusCode))
    ctx.status = status >= 400 && status < 600 ? status : 500
    const detail = err && err.message ? String(err.message) : ''
    const message = process.env.NODE_ENV === 'production'
      ? R.FALLBACK_MESSAGE
      : (detail || '服务器异常')
    ctx.body = R.error(-1, message)
    console.error(`[server] ${ctx.method} ${ctx.url} -> ${ctx.status}`, err && err.stack ? err.stack : err)
  }
})

// middlewares
app.use(bodyparser({
  enableTypes:['json', 'form', 'text']
}))
app.use(json())
app.use(logger())
app.use(require('koa-static')(__dirname + '/public'))

app.use(views(__dirname + '/views', {
  extension: 'pug'
}))

// logger
app.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const ms = new Date() - start
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`)
})

// 登录态：解析令牌写入 ctx.state.openId，需要身份的接口在此拦截
app.use(auth())

// routes
app.use(index.routes(), index.allowedMethods())
app.use(users.routes(), users.allowedMethods())
app.use(clubs.routes(), clubs.allowedMethods())
app.use(clubMembers.routes(), clubMembers.allowedMethods())
app.use(matches.routes(), matches.allowedMethods())
app.use(matchParticipants.routes(), matchParticipants.allowedMethods())
app.use(matchScores.routes(), matchScores.allowedMethods())
app.use(matchRounds.routes(), matchRounds.allowedMethods())
app.use(stats.routes(), stats.allowedMethods())
app.use(tips.routes(), tips.allowedMethods())

// 没命中任何路由的 POST 接口：也返回 JSON，避免前端拿到纯文本 "Not Found"
app.use(async (ctx) => {
  if (ctx.status !== 404 || ctx.body != null) return
  if (ctx.method !== 'POST') return
  // 先定状态码再赋 body，否则 Koa 会把状态重置成 200
  ctx.status = 404
  ctx.body = R.error(404, '接口不存在')
})

// error-handling
app.on('error', (err, ctx) => {
  console.error('server error', err, ctx)
});


module.exports = app
