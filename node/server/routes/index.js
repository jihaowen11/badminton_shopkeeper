const router = require('koa-router')()
const R = require('../utils/responseBeautifier')

router.get('/', async (ctx, next) => {
  await ctx.render('index', {
    title: 'Hello Koa 2! badminton'
  })
})

// 探活：只回进程状态，不查库——健康检查不该给数据库加压力
router.get('/health', async (ctx) => {
  ctx.body = R.set({ status: 'ok', uptime: Math.round(process.uptime()) }, '200', 'ok')
})

module.exports = router
