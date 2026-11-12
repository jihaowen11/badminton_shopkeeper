const router = require('koa-router')()
const multer = require('multer')
const R = require('../utils/responseBeautifier')
const UserController = require('../controllers/users')
const UserStatsController = require('../controllers/userStats')

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
})

async function uploadAvatarMulter(ctx, next) {
    try {
        await new Promise((resolve, reject) => {
            upload.single('file')(ctx.req, ctx.res, (err) => {
                if (err) reject(err)
                else resolve()
            })
        })
        await next()
    } catch (e) {
        ctx.body = R.error(412, e && e.message ? e.message : e)
    }
}

router.prefix('/users')

//创建用户
router.post('/create', UserController.create)

//获取openid
router.post('/openid', UserController.openid)

//根据openid更新用户信息
router.post('/update', UserController.updata)

//根据openid查询用户信息
router.post('/findUserByOpenid', UserController.findUserByOpenid)

//上传头像（multipart：openId 字段 + file 文件）
router.post('/uploadAvatar', uploadAvatarMulter, UserController.uploadAvatar)

//我的战绩与最近比赛（openId 不传即看自己）
router.post('/stats', UserStatsController.mine)

module.exports = router
