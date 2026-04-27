const router = require('koa-router')()
const MatchScoreController = require('../controllers/matchScores')

router.prefix('/matchScores')

//新增比赛记录(局比分)
router.post('/create', MatchScoreController.create)

//更新比赛记录
router.post('/update', MatchScoreController.update)

//查询记录详情
router.post('/detail', MatchScoreController.detail)

//查询记录列表(可传 matchId/gameNumber)
router.post('/list', MatchScoreController.list)

//删除记录
router.post('/delete', MatchScoreController.delete)

module.exports = router
