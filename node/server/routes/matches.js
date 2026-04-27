const router = require('koa-router')()
const MatchController = require('../controllers/matches')

router.prefix('/matches')

//新增比赛
router.post('/create', MatchController.create)

//更新比赛
router.post('/update', MatchController.update)

//查询比赛详情
router.post('/detail', MatchController.detail)

//查询比赛列表(可传 clubId/activityId/type/status)
router.post('/list', MatchController.list)

//删除比赛
router.post('/delete', MatchController.delete)

module.exports = router
