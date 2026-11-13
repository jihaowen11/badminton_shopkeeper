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
//俱乐部动态（自动流）：{ clubId, cursor, pageSize }
const CLUB_FEED = (data) => postRequest(`/clubs/feed`, data)

//俱乐部成员
//邀请加入俱乐部
const INVITE_CLUB = (data) => postRequest(`/clubMembers/create`, data)
//退出/移除俱乐部
const EXIT_CLUB = (data) => postRequest(`/clubMembers/delete`, data)
//设置管理员
const SET_ADMIN = (data) => postRequest(`/clubMembers/setAdmin`, data)
//移除管理员
const REMOVE_ADMIN = (data) => postRequest(`/clubMembers/removeAdmin`, data)

//创建比赛
const CREATE_MATCH = (data) => postRequest(`/matches/create`, data)
//查询比赛列表
const MATCH_LIST = (data) => postRequest(`/matches/list`, data)
//比赛浏览量+1
const MATCH_INCREMENT_VIEWS = (data) => postRequest(`/matches/incrementViews`, data)
//查询比赛详情
const MATCH_DES = (data) => postRequest(`/matches/detail`, data)
//更新赛事状态
const MATCH_UPDATE_STATUS = (data) => postRequest(`/matches/updateStatus`, data)
/** 邀请俱乐部成员报名比赛 */
const MATCH_INVITE_CLUB_MEMBERS = (data) => postRequest(`/matches/inviteClubMembers`, data)
/** 用户报名比赛（成功时返回 { object, message }） */
const MATCH_JOIN = (data) => postRequest(`/matchParticipants/create`, data, { withMessage: true })
/** 取消报名（删除参赛记录） */
const MATCH_PARTICIPANT_DELETE = (data) => postRequest(`/matchParticipants/delete`, data)

//轮转排期（八人转）
/** 生成排期：body { matchId, rounds?, force? } */
const MATCH_ROUNDS_GENERATE = (data) => postRequest(`/matchRounds/generate`, data, { withMessage: true })
/** 查询排期 + 排名：body { matchId } */
const MATCH_ROUNDS_LIST = (data) => postRequest(`/matchRounds/list`, data)
/** 录入某场比分：body { roundId, team1Score, team2Score } */
const MATCH_ROUNDS_SUBMIT_SCORE = (data) => postRequest(`/matchRounds/submitScore`, data, { withMessage: true })
/** 撤销某场比分：body { roundId } */
const MATCH_ROUNDS_CLEAR_SCORE = (data) => postRequest(`/matchRounds/clearScore`, data, { withMessage: true })
/** 清空整场排期：body { matchId } */
const MATCH_ROUNDS_RESET = (data) => postRequest(`/matchRounds/reset`, data, { withMessage: true })

//统计
/** 我的/某人的战绩与最近比赛：body { openId?, limit? } */
const USER_STATS = (data) => postRequest(`/users/stats`, data)
/** 首页平台总量（公开） */
const STATS_OVERVIEW = (data) => postRequest(`/stats/overview`, data)

//贴士
/** 今日贴士（公开）：返回 { id, title, category, content, date, seq, total } */
const TIP_DAILY = (data) => postRequest(`/tips/daily`, data || {})

module.exports = {
  GET_OPENID,
  UPDATA_USER,
  FIND_USER,
  UPLOAD_AVATAR,
  CREATE_CLUB,
  CLUB_LIST,
  CLUB_DES,
  DEL_CLUB,
  CLUB_MY_LIST,
  CLUB_FEED,
  INVITE_CLUB,
  EXIT_CLUB,
  SET_ADMIN,
  REMOVE_ADMIN,
  CREATE_MATCH,
  MATCH_LIST,
  MATCH_INCREMENT_VIEWS,
  MATCH_DES,
  MATCH_UPDATE_STATUS,
  MATCH_INVITE_CLUB_MEMBERS,
  MATCH_JOIN,
  MATCH_PARTICIPANT_DELETE,
  MATCH_ROUNDS_GENERATE,
  MATCH_ROUNDS_LIST,
  MATCH_ROUNDS_SUBMIT_SCORE,
  MATCH_ROUNDS_CLEAR_SCORE,
  MATCH_ROUNDS_RESET,
  USER_STATS,
  STATS_OVERVIEW,
  TIP_DAILY,
}
