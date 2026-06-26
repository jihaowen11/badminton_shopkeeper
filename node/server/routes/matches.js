const router = require('koa-router')()
const MatchController = require('../controllers/matches')

router.prefix('/matches')

//新增比赛
router.post('/create', MatchController.create)

//更新比赛
router.post('/update', MatchController.update)

//修改比赛状态（body: id, status）
router.post('/updateStatus', MatchController.updateStatus)

//查询比赛详情
router.post('/detail', MatchController.detail)

//查询比赛列表(可传 clubId/activityId/type/status)
router.post('/list', MatchController.list)

//浏览量 +1（body: id）
router.post('/incrementViews', MatchController.incrementViews)

//删除比赛
router.post('/delete', MatchController.delete)

//邀请俱乐部成员加入比赛（body: clubId, matchId, openIds）
router.post('/inviteClubMembers', MatchController.inviteClubMembers)

module.exports = router
