const router = require('koa-router')()
const ClubController = require('../controllers/clubs')

router.prefix('/clubs')

//创建俱乐部
router.post('/create', ClubController.create)

//更新俱乐部
router.post('/update', ClubController.update)

//查询俱乐部详情
router.post('/detail', ClubController.detail)

//查询俱乐部列表
router.post('/list', ClubController.list)

//我的俱乐部列表（含成员）：body.openId / openid
router.post('/myList', ClubController.myList)

//俱乐部动态（自动流，仅成员可见）：body.clubId / cursor / pageSize
router.post('/feed', ClubController.feed)

//删除俱乐部
router.post('/delete', ClubController.delete)


module.exports = router
