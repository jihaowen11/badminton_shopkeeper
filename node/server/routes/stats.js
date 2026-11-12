const router = require('koa-router')()
const UserStatsController = require('../controllers/userStats')

router.prefix('/stats')

// 首页平台总量（公开）
router.post('/overview', UserStatsController.overview)

module.exports = router
