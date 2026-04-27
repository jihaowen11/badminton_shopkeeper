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

//删除俱乐部
router.post('/delete', ClubController.delete)

module.exports = router
