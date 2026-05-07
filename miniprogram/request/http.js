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

//post请求，数据在body中
function postRequest(url, data) {
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

//文件上传
function uploadFile(url, filePath, data) {
  let header = CreateHeader(url, 'POST');
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      filePath: filePath,
      header: header,
      name: 'file',
      formData: data || '',
      url: getServerBase() + url,
      success: (res => {
        if (res.statusCode === 200) {
          //200: 服务端业务处理正常结束
          let { code, object, message } = JSON.parse(res.data)
          console.log(code, object, message)
          if (code == 1) {
            resolve(object)
          } else {
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

module.exports.getRequest = getRequest;
module.exports.postRequest = postRequest;