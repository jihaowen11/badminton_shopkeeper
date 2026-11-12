const router = require('koa-router')()
const TipsController = require('../controllers/tips')

router.prefix('/tips')

// 今日一条（公开，按北京时间的日期轮换）
router.post('/daily', TipsController.daily)

// 全量列表（公开，方便以后做贴士列表页）
router.post('/list', TipsController.list)

module.exports = router
