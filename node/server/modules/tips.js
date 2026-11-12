const { DataTypes } = require('sequelize');
const db = require('../config/db');
const Sequelize = db.sequelize;
const tips = require('../schema/tips')(Sequelize, DataTypes);

/**
 * 初始文案：格式 [分类, 短标题, 正文]
 * 只在表为空时灌入，之后运营加的新内容不会被覆盖。
 */
const SEED = [
    ['步法', '启动小跳', '对方击球的一瞬间，双脚要有一次很小的起跳，落地时肌肉被拉长，才有回弹的力气。一直平站着等球，启动会慢半拍，看起来像反应慢，其实是不会启动。'],
    ['步法', '回中的位置', '打完球别停在原地看。回中的"中"不是场地正中心，而是对方最可能回球方向的中点——他压你后场直线，你就回偏直线那一侧，不是机械地跑回中间。'],
    ['步法', '上网最后一步', '右手持拍的话，上网最后一步用右脚向前跨，脚跟先落地再过渡到全脚掌。膝盖不要超过脚尖，超过就是在用膝盖刹车，久了必伤。'],
    ['步法', '并步与交叉步', '球近用并步小碎步调整，球远才用交叉步。业余球友常犯的错是全程交叉步，结果最后一步永远调整不到位，球不是下网就是出界。'],
    ['发力', '高远球的击球点', '高远球打不到后场，多半不是力量不够。击球点要在头顶正上方稍偏前，一旦落到身后就变成够着打，力量全被肩关节吃掉了。'],
    ['发力', '鞭打顺序', '正确顺序是蹬地、转髋、转肩、抬肘、甩腕，最后手指收紧，像甩鞭子一节一节传上去。直接从手臂开始抡，只能用到三成力。'],
    ['发力', '手指的作用', '击球瞬间拇指和食指要有一个捏紧的动作，拍头才会在最后十几厘米突然加速。全程死死握住拍柄，力量反而出不去。'],
    ['发力', '反手高远', '反手打不到后场，问题常在转身——要先转体让背对球网，用拇指顶住拍柄宽面发力。不转身只靠手臂硬抡，永远差一口气。'],
    ['杀球', '起跳时机', '起跳时机比弹跳高度重要。等球下落到头顶才起跳就晚了，要在球还在上升时蹬地，让拍面正好在最高点碰到球。'],
    ['杀球', '拍面角度', '杀球下网大多是拍面压得太狠。击球瞬间拍面稍稍前压就行，球是压过网的，不是垂直往下砸的。'],
    ['杀球', '杀完要跟进', '杀球落地就把重心往前推，别站着看效果。对方最可能的回球是挡网前，你不跟进，就只能眼看着球落地。'],
    ['网前', '搓球是抬不是切', '搓球拍面要从下往上带，球才会翻滚过网。从上往下切，球容易飞高，等着被扑。'],
    ['网前', '扑球靠手指', '扑球别大幅摆手，用短促的手腕和手指发力，动作越小越快。抡开胳膊扑，十次有八次下网。'],
    ['网前', '推球看站位', '网前推直线还是推斜线，取决于对方重心偏向哪边。他重心压向一侧，就往另一侧后场推，比勉强搓个小球有效得多。'],
    ['网前', '勾对角的隐蔽', '勾对角的关键是引拍动作要和高点搓球一模一样，对方才判断不出来。动作一大，意图就暴露了。'],
    ['双打', '进攻前后防守左右', '双打进攻时前后站位，防守时左右分边。最容易丢分的是进攻时两人都留在后场，或者防守时一前一后留出大片空当。'],
    ['双打', '起高球立刻分边', '你起了一个高球，那一刻就该立刻和搭档左右分开。很多人起完高球还站在原地，等搭档退到后场，两人挤在同一侧。'],
    ['双打', '封网跟着杀球走', '网前封网不要死站正中，要跟着搭档杀球的方向移。搭档杀直线就封直线，封错边等于给对方让路。'],
    ['双打', '接发球别站太深', '接发球站位过深是业余双打最常见的失分点。对方一个贴网小球，你根本来不及。站在前发球线后方一步左右比较合适。'],
    ['双打', '混双的分工', '混双女选手守网前不要后退，男选手负责后场两个角。位置一旦乱，防守立刻出大洞。'],
    ['战术', '打追身和中间', '双打最有效的落点是两人结合部和持拍手肩部。对方互相让球或抢球的那一瞬间，就是最大的空当。'],
    ['战术', '连续压反手', '业余选手反手普遍是短板。连续压他反手后场，等他回出一个半场高球再杀，比盲目乱杀得分率高得多。'],
    ['战术', '用节奏换主动', '落后时把球打高、打慢，多拍相持等对方失误；领先时可以加速抢攻。节奏是场上少数你能主动控制的东西。'],
    ['战术', '双打发球要贴网', '双打发球要贴着网过，落点在前发球线附近。发高了被扑，发远了被推后场，两种都是直接送分。'],
    ['装备', '磅数不是越高越好', '22 到 24 磅适合绝大多数业余球友。磅数越高甜区越小，打不中拍面中心反而更没力，还容易震手。'],
    ['装备', '拍子重量', '3U 约 85 到 89 克适合大部分人。太轻的拍子杀球没威胁，太重的打久了手腕和肩膀吃不消。'],
    ['装备', '手胶打滑', '手胶打滑是最容易被忽略的失误来源。握把一滑，发力时拍子会在手里转动，出球方向就控制不住了。'],
    ['装备', '线的选择', '新手优先选耐打的粗线，别一上来就追求细线的手感。细线手感好但断得快，一个月换两次线的成本比拍子还高。'],
    ['热身', '上场前五分钟', '至少花五分钟做动态热身：高抬腿、弓步走、肩绕环、手腕绕环。不做热身直接开打，是业余球友拉伤的第一原因。'],
    ['热身', '手腕疼多半是动作错', '手腕疼通常不是用力过猛，而是靠手腕甩而不是靠前臂旋转。纠正发力方式比戴护腕有用得多。'],
    ['热身', '保护膝盖', '跨步时膝盖超过脚尖、落地时腿是直的，这两个动作最伤膝盖。落地要有缓冲，膝盖始终保持微屈。'],
    ['心态', '少失误就是赢', '业余比赛八成是输在自己的失误上，不是对手多强。先保证球过网、落点在界内，再考虑打多刁钻。']
];

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * 东八区的"第几天"（自 1970-01-01 起算）。
 *
 * 直接拿 Date.now() 除以一天是错的——那会在 UTC 零点（北京时间早上 8 点）
 * 换贴士。加上 8 小时偏移后取整，才是北京时间每天零点切换。
 */
function dayIndexOf(ts = Date.now()) {
    return Math.floor((ts + BEIJING_OFFSET_MS) / 86400000);
}

/** 东八区的今天，格式 YYYY-MM-DD */
function todayText(ts = Date.now()) {
    const d = new Date(ts + BEIJING_OFFSET_MS);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function seedIfEmpty() {
    const exists = await tips.count();
    if (exists > 0) return 0;
    const rows = SEED.map(([category, title, content]) => ({
        category,
        title,
        content,
        status: 1
    }));
    await tips.bulkCreate(rows);
    console.log(`[tips] 已写入 ${rows.length} 条初始贴士`);
    return rows.length;
}

// 建表 + 首次灌数据，只做一次；后面的查询都等这个 ready
const ready = tips.sync({ force: false })
    .then(() => seedIfEmpty())
    .catch((e) => {
        console.error('[tips] 初始化失败：', e && e.message ? e.message : e);
    });

/**
 * 当天结果缓存
 *
 * 同一天所有人拿到的是同一条，没必要每次打开首页都去 count + offset 两次查询。
 * 加 5 分钟 TTL：运营改文案或上下架后，最迟 5 分钟就能生效，不用等跨天。
 */
const DAILY_CACHE_TTL_MS = 5 * 60 * 1000;
let dailyCache = { key: '', at: 0, data: null };

class TipsModel {
    /**
     * 今日贴士。
     *
     * 用"天数 % 总条数"当游标，所以不需要任何定时任务或状态字段：
     * 同一天内所有人拿到同一条，跨天自动顺延，走到末尾自然回到第一条。
     */
    static async daily(ts = Date.now()) {
        await ready;
        const today = todayText(ts);
        if (
            dailyCache.data &&
            dailyCache.key === today &&
            Date.now() - dailyCache.at < DAILY_CACHE_TTL_MS
        ) {
            return dailyCache.data;
        }

        const total = await tips.count({ where: { status: 1 } });
        if (!total) return null;
        const seq = ((dayIndexOf(ts) % total) + total) % total;
        const row = await tips.findOne({
            where: { status: 1 },
            order: [['id', 'ASC']],
            offset: seq
        });
        if (!row) return null;

        const data = {
            id: row.id,
            title: row.title,
            category: row.category,
            content: row.content,
            date: today,
            seq: seq + 1,
            total
        };
        dailyCache = { key: today, at: Date.now(), data };
        return data;
    }

    /** 全量列表，按 id 升序 */
    static async list({ page = 1, pageSize = 100 } = {}) {
        await ready;
        const p = Math.max(1, Number(page) || 1);
        const size = Math.min(200, Math.max(1, Number(pageSize) || 100));
        return await tips.findAll({
            where: { status: 1 },
            order: [['id', 'ASC']],
            offset: (p - 1) * size,
            limit: size
        });
    }
}

module.exports = TipsModel;
