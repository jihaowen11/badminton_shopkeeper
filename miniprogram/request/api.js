const { postRequest, uploadFile } = require('./http')
//users
/** 使用 wx.login 拿到的 code 换取 openid */
const GET_OPENID = (data) => postRequest(`/users/openid`, data)

const UPDATA_USER = (data) => postRequest(`/users/update`, data)

const FIND_USER = (data) => postRequest(`/users/findUserByOpenid`, data)

/** 头像上传；formData 需含 openid（字符串），及其它后端要求的表单字段 */
const UPLOAD_AVATAR = (filePath, formData) => uploadFile(`/users/uploadAvatar`, filePath, formData)

//clubs
//创建俱乐部
const CREATE_CLUB = (data) => postRequest(`/clubs/create`, data)
//查询俱乐部列表
const CLUB_LIST = (data) => postRequest(`/clubs/list`, data)
//查询俱乐部详情
const CLUB_DES = (data) => postRequest(`/clubs/detail`, data)
//删除/解散俱乐部
const DEL_CLUB = (data) => postRequest(`/clubs/delete`, data)
//查询我的俱乐部列表
const CLUB_MY_LIST = (data) => postRequest(`/clubs/myList`, data)

module.exports = {
  GET_OPENID,
  UPDATA_USER,
  FIND_USER,
  UPLOAD_AVATAR,
  CREATE_CLUB,
  CLUB_LIST,
  CLUB_DES,
  DEL_CLUB,
  CLUB_MY_LIST
}
