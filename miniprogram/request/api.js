const { postRequest } = require('./http')

/** 使用 wx.login 拿到的 code 换取 openid */
const GET_OPENID = (data) => postRequest(`/users/openid`, data)

const UPDATA_USER = (data) => postRequest(`/users/update`, data)

const FIND_USER = (data) => postRequest(`/users/findUserByOpenid`, data)

module.exports = {
  GET_OPENID,
  UPDATA_USER,
  FIND_USER,
}
