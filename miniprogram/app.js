//app.js
App({
  onLaunch: function () {
    let _this = this;

    this.globalData = {
        openid:'',
        userInfo:{},
        serverUrl: "https://esccry.top/api/werewolf",
        staticUrl: "https://esccry.top/api/werewolf/images",
        code:'v0.9',
        dicts: {
          isAd: true,
        }
    }

    this.fun = {
        formatTime(formatStr) {
            var str = formatStr;
            var curData = new Date()
            var Week = ['日', '一', '二', '三', '四', '五', '六'];

            str = str.replace(/yyyy|YYYY/, curData.getFullYear());
            str = str.replace(/yy|YY/, (curData.getYear() % 100) > 9 ? (curData.getYear() % 100).toString() : '0' + (curData.getYear() % 100));

            str = str.replace(/MM/, ((curData.getMonth() + 1) + 1) > 9 ? (curData.getMonth() + 1).toString() : '0' + (curData.getMonth() + 1));
            str = str.replace(/M/g, curData.getMonth());

            str = str.replace(/w|W/g, Week[curData.getDay()]);

            str = str.replace(/dd|DD/, curData.getDate() > 9 ? curData.getDate().toString() : '0' + curData.getDate());
            str = str.replace(/d|D/g, curData.getDate());

            str = str.replace(/hh|HH/, curData.getHours() > 9 ? curData.getHours().toString() : '0' + curData.getHours());
            str = str.replace(/h|H/g, curData.getHours());
            str = str.replace(/mm/, curData.getMinutes() > 9 ? curData.getMinutes().toString() : '0' + curData.getMinutes());
            str = str.replace(/m/g, curData.getMinutes());

            str = str.replace(/ss|SS/, curData.getSeconds() > 9 ? curData.getSeconds().toString() : '0' + curData.getSeconds());
            str = str.replace(/s|S/g, curData.getSeconds());

            return str;
        }
    }
  }
})