// utils/shareCard.js
// 品牌向分享卡片：首页、「我的」、以及没加载出具体内容的兜底场景共用一份，
// 免得每个页面各写一套标题和随机图，改文案时到处找。

const SHARE_IMAGE_COUNT = 6

const BRAND_TITLES = [
  '羽球掌柜：一键组局约球，今天就开打',
  '还在群里刷屏约球？试试羽球掌柜',
  '建俱乐部、排八人转、算球费，一个就够了',
  '打球搭子难找？羽球掌柜帮你快速组局',
  '从建俱乐部到记比赛，羽球掌柜全搞定',
  '球友都在用的羽球掌柜，快来一起玩',
]

/** 随机一张分享封面，images/share/1.jpg ~ 6.jpg */
function randomShareImage() {
  const idx = Math.floor(Math.random() * SHARE_IMAGE_COUNT) + 1
  return `/images/share/${idx}.jpg`
}

function randomTitle() {
  return BRAND_TITLES[Math.floor(Math.random() * BRAND_TITLES.length)]
}

/** 通用品牌卡片：一律指向首页，没有具体内容可带时用它 */
function brandCard() {
  return {
    title: randomTitle(),
    path: '/pages/index/index',
    imageUrl: randomShareImage(),
  }
}

module.exports = { brandCard, randomShareImage, randomTitle }
