const router = require('koa-router')()
const MatchParticipantController = require('../controllers/matchParticipants')

router.prefix('/matchParticipants')

//新增比赛参与者
router.post('/create', MatchParticipantController.create)

//更新比赛参与者
router.post('/update', MatchParticipantController.update)

//查询参与者详情
router.post('/detail', MatchParticipantController.detail)

//查询参与者列表(可传 matchId/userId/teamId/status)
router.post('/list', MatchParticipantController.list)

//删除参与者
router.post('/delete', MatchParticipantController.delete)

module.exports = router
