var exceptionAddrArr = []

function getServerBase() {
  try {
    const app = getApp()
    if (app && app.globalData && app.globalData.serverUrl) {
      return app.globalData.serverUrl
    }
  } catch (e) {}
  return ''
}

//轻提示
function showToast(title) {
  wx.showToast({
    title: title,
    icon: 'none',
    duration: 2000
  })
}

//重提示
function showModel(content, cb) {
  wx.showModal({
    title: '提示',
    content: content,
    showCancel: false,
    success(res) {
      if (res.confirm) {
        cb && cb()
      }
    }
  })
}

// 请求头处理函数
function CreateHeader(url, type) {
  let header = {}
  if (type == 'POST_PARAMS') {
    header = {
      'content-type': 'application/json'
    }
  } else {
    header = {
      'content-type': 'application/json;charset=UTF-8'
    }
  }
  if (exceptionAddrArr.indexOf(url) == -1) { //排除请求的地址不需要token的地址
    let token = wx.getStorageSync("token");
    header['Authorization'] = token;
  }
  return header;
}

/** wx.uploadFile 由客户端自动带 multipart boundary，不要写死 application/json */
function CreateUploadHeader(url) {
  const header = {}
  if (exceptionAddrArr.indexOf(url) === -1) {
    const token = wx.getStorageSync('token')
    if (token) header.Authorization = token
  }
  return header
}

//post请求，数据在body中
function postRequest(url, data, options) {
  const opts = options && typeof options === 'object' ? options : {}
  wx.showNavigationBarLoading()
  let header = CreateHeader(url, 'POST');
  return new Promise((resolve, reject) => {
    wx.request({
      url: getServerBase() + url,
      data: data,
      header: header,
      method: 'POST',
      success: (res => {
        if (res.statusCode === 200) {
          //200: 服务端业务处理正常结束
          let { code, object, message } = res.data
          if (code == 200) {
            if (opts.withMessage) {
              resolve({ object, message: message || '' })
            } else {
              resolve(object)
            }
          }  else {
            reject(object)
            showToast(message)
          }
        } else {
          showToast('网络失败')
          reject(res)
        }
        wx.hideNavigationBarLoading()
      }),
      fail: (res => {
        showModel('网络失败')
        wx.hideNavigationBarLoading()
        reject(res)
      })
    })
  })
}

//get 请求
function getRequest(url, data) {
  wx.showNavigationBarLoading()
  let header = CreateHeader(url, 'GET');
  return new Promise((resolve, reject) => {
    wx.request({
      url: getServerBase() + url,
      data: data,
      header: header,
      method: 'GET',
      success: (res => {
        if (res.statusCode === 200) {
          //200: 服务端业务处理正常结束
          let { code, object, message } = res.data
          if (code == 200) {
            resolve(object)
          }  else {
            reject(object)
            showToast(message)
          }
        } else {
          showToast('网络失败')
          reject(res)
        }
        wx.hideNavigationBarLoading()
      }),
      fail: (res => {
        showToast('网络失败')
        wx.hideNavigationBarLoading()
        reject(res)
      })
    })
  })
}

//文件上传（表单字段名 file，与多数 Spring / Node 接收一致）
function uploadFile(url, filePath, data) {
  const header = CreateUploadHeader(url)
  const formData = data && typeof data === 'object' ? data : {}
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      filePath: filePath,
      header: header,
      name: 'file',
      formData,
      url: getServerBase() + url,
      success: (res) => {
        if (res.statusCode !== 200) {
          showToast('网络失败')
          reject(res)
          return
        }
        let body
        try {
          body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
        } catch (err) {
          showToast('上传响应异常')
          reject(err)
          return
        }
        const { code, object, message } = body || {}
        if (code == 200 || code == 1) {
          resolve(object)
        } else {
          showToast(message || '上传失败')
          reject(body)
        }
      },
      fail: (res) => {
        showToast('网络失败')
        reject(res)
      },
    })
  })
}

module.exports.getRequest = getRequest;
module.exports.postRequest = postRequest;
module.exports.uploadFile = uploadFile;