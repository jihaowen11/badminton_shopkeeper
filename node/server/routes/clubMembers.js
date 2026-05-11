const router = require('koa-router')()
const ClubMemberController = require('../controllers/clubMembers')

router.prefix('/clubMembers')

//新增俱乐部成员
router.post('/create', ClubMemberController.create)

//更新俱乐部成员
router.post('/update', ClubMemberController.update)

//查询成员详情
router.post('/detail', ClubMemberController.detail)

//查询成员列表(可传 clubId/userId/status)
router.post('/list', ClubMemberController.list)

//删除成员
router.post('/delete', ClubMemberController.delete)

//设置管理员（club_id + user_id 或 clubId + userId）
router.post('/setAdmin', ClubMemberController.setAdmin)

//移除管理员（admin → member）
router.post('/removeAdmin', ClubMemberController.removeAdmin)

module.exports = router
