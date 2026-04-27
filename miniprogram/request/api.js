import {
  	getRequest,
    postRequest,
} from './http'

// 获取openid
export const GET_OPENID = data => postRequest(`/users/openid`, data);

// 更新用户
export const UPDATA_USER = data => postRequest(`/users/update`, data);

//根据openid查询
export const FIND_USER = data => postRequest(`/users/findUserByOpenid`, data);
