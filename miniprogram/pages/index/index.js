//index.js
const app = getApp()
import Dialog from '../../dist/dialog/dialog';
import Toast from '../../dist/toast/toast';

Page({
  data: {
    
  },

  onLoad: function () {
    
  },
  
  onShareAppMessage: function (o) {
    return {
      title: '与黑夜一同醒来，看清真相者为神',
      path: '/pages/index/index',
      imageUrl: '../../images/share_bg.jpg',
    }
  },
})