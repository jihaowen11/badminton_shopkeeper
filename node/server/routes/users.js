const router = require('koa-router')()
const UserController = require('../controllers/users')
router.prefix('/users')

//创建用户
router.post('/create', UserController.create)

//获取openid
router.post('/openid', UserController.openid)

//根据openid更新用户信息
router.post('/update', UserController.updata)

//根据openid查询用户信息
router.post('/findUserByOpenid', UserController.findUserByOpenid)

module.exports = router
