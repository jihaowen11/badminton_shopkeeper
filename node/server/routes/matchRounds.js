const router = require('koa-router')()
const MatchRoundController = require('../controllers/matchRounds')

router.prefix('/matchRounds')

//生成轮转排期（仅组织者）
router.post('/generate', MatchRoundController.generate)

//查询排期 + 排名
router.post('/list', MatchRoundController.list)

//录入某场比分（组织者或本场参赛者）
router.post('/submitScore', MatchRoundController.submitScore)

//撤销某场比分（仅组织者）
router.post('/clearScore', MatchRoundController.clearScore)

//清空整场排期（仅组织者）
router.post('/reset', MatchRoundController.reset)

module.exports = router
