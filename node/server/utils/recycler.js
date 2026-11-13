/**
 * 垃圾数据回收器（定时任务）
 *
 * 三条规则，全部基于"多久没动过"来判断，避免把正常比赛误伤：
 *
 *   1. 报名中（1）创建超过 N 天还没开赛  → 已取消（5）
 *      基准用 createdAt。报名中的场次只要没开打，createdAt 就是它"诞生"的时间，
 *      用 updatedAt 的话，组织者改个备注就会把过期时间往后推，永远清不掉。
 *
 *   2. 进行中（2）超过 N 天还没结束        → 已结束（3）
 *      基准优先 startTime（有开赛时间就以开赛时间算），
 *      没填开赛时间的老数据退化成 updatedAt（最后一次变动时间）。
 *      这里必须区分两种，不能只用一个字段：现场组织的比赛往往不填 startTime。
 *
 *   3. 已取消（5）超过 N 天                → 物理删除（连同报名 / 排期 / 比分）
 *      基准用 updatedAt，也就是进入"已取消"的时间。
 *      宁可晚删：取消后又被编辑过一次，就再等 N 天。
 *
 * 所有天数、执行间隔都能用环境变量覆盖，默认写死 30 / 3 / 3 天、每 60 分钟跑一次。
 * 单次最多删 MAX_REMOVE 场，防止某次逻辑写错把库清空——真出了 bug 也只是一次删一点。
 */
const { Op } = require('sequelize');
const env = require('../config/env');
const db = require('../config/db');

// modules/* 导出的是业务类而不是 Sequelize 模型，所以这里先 require 一遍让 schema
// 完成注册，再从 sequelize.models 上取同一个模型实例——避免自己 define 一份导致
// 同名模型被覆盖、两处各持一个类。
require('../modules/matches');
require('../modules/matchParticipants');
require('../modules/matchRounds');
require('../modules/matchScores');

const MatchModel = db.sequelize.models.matches;
const MatchParticipantModel = db.sequelize.models.match_participants;
const MatchRoundModel = db.sequelize.models.match_rounds;
const MatchScoreModel = db.sequelize.models.match_scores;

/** 比赛状态：与 schema/matches.js 的注释保持一致 */
const STATUS = {
    OPEN: 1,
    PLAYING: 2,
    END: 3,
    INTERRUPTED: 4,
    CANCELLED: 5,
};

const DAY = 24 * 60 * 60 * 1000;
/** 每批处理的 id 数，避免 IN (...) 过长 */
const BATCH_SIZE = 100;

/** 取第一个有效值（0 是合法值，不能被当成空） */
function pick(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * 读取运行参数
 * @param {object} options 显式传入优先（测试用），否则读环境变量，最后用默认值
 */
function readConfig(options) {
    const opts = options || {};
    return {
        openDays: pick(opts.openDays, env.getNumber('RECYCLE_OPEN_DAYS', 30)),
        playingDays: pick(opts.playingDays, env.getNumber('RECYCLE_PLAYING_DAYS', 3)),
        cancelledDays: pick(opts.cancelledDays, env.getNumber('RECYCLE_CANCELLED_DAYS', 3)),
        intervalMinutes: pick(opts.intervalMinutes, env.getNumber('RECYCLE_INTERVAL_MINUTES', 60)),
        maxRemove: Math.max(1, pick(opts.maxRemove, env.getNumber('RECYCLE_MAX_REMOVE', 200))),
        enabled: String(env.get('RECYCLE_ENABLED', 'true')).toLowerCase() !== 'false',
    };
}

/** 基准时间往前推 days 天 */
function before(base, days) {
    return new Date(base.getTime() - days * DAY);
}

/** 只取 id，减少查询开销 */
function queryIds(where) {
    return MatchModel.findAll({
        where,
        attributes: ['id'],
        raw: true,
    }).then((rows) => rows.map((r) => Number(r.id)).filter((id) => id > 0));
}

/** 按批把数组切成小块 */
function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

/**
 * 规则 1：报名中超期 → 已取消
 * @returns {Promise<number[]>} 命中的比赛 id
 */
async function cancelStaleOpen(base, cfg, dry) {
    const cutoff = before(base, cfg.openDays);
    const ids = await queryIds({
        status: STATUS.OPEN,
        createdAt: { [Op.lt]: cutoff },
    });
    if (!ids.length) return { ids: [], cutoff };

    if (!dry) {
        // update 会自动刷新 updatedAt，等于记下"取消时间"，规则 3 从这一刻开始计时
        await MatchModel.update({ status: STATUS.CANCELLED }, { where: { id: { [Op.in]: ids } } });
    }
    return { ids, cutoff };
}

/**
 * 规则 2：进行中超期 → 已结束
 * 分两段查：填了开赛时间的按 startTime，没填的退回 updatedAt。
 * @returns {Promise<number[]>}
 */
async function finishStalePlaying(base, cfg, dry) {
    const cutoff = before(base, cfg.playingDays);
    const [byStart, byUpdate] = await Promise.all([
        queryIds({
            status: STATUS.PLAYING,
            startTime: { [Op.lt]: cutoff },
        }),
        queryIds({
            status: STATUS.PLAYING,
            startTime: null,
            updatedAt: { [Op.lt]: cutoff },
        }),
    ]);
    // 两段理论上不会重叠（startTime 为空 vs 非空），保险起见去个重
    const ids = Array.from(new Set(byStart.concat(byUpdate)));
    if (!ids.length) return { ids: [], cutoff };

    if (!dry) {
        await MatchModel.update({ status: STATUS.END }, { where: { id: { [Op.in]: ids } } });
        // 结束时间没填的补一个，海报和统计里"结束时间"就不会空着；
        // 已有 endTime 的不动，避免覆盖真实结束时间。
        await MatchModel.update(
            { endTime: base },
            { where: { id: { [Op.in]: ids }, endTime: null } }
        );
    }
    return { ids, cutoff };
}

/**
 * 规则 3：已取消超期 → 物理删除
 * 先删子表（报名 / 排期 / 比分）再删主表，整批放在一个事务里。
 * @returns {Promise<number[]>} 实际删除的比赛 id
 */
async function removeStaleCancelled(base, cfg, dry) {
    const cutoff = before(base, cfg.cancelledDays);
    const found = await queryIds({
        status: STATUS.CANCELLED,
        updatedAt: { [Op.lt]: cutoff },
    });
    if (!found.length) return { ids: [], cutoff, skipped: 0 };

    // 超过单次上限的部分留到下一轮，不一次性清空
    const ids = found.slice(0, cfg.maxRemove);
    const skipped = found.length - ids.length;
    if (dry) return { ids, cutoff, skipped };

    for (const group of chunk(ids, BATCH_SIZE)) {
        // 这里用模型属性名 matchId，不是数据库列名 match_id
        const where = { matchId: { [Op.in]: group } };
        await db.sequelize.transaction(async (t) => {
            await MatchRoundModel.destroy({ where, transaction: t });
            await MatchParticipantModel.destroy({ where, transaction: t });
            await MatchScoreModel.destroy({ where, transaction: t });
            await MatchModel.destroy({ where: { id: { [Op.in]: group } }, transaction: t });
        });
    }
    return { ids, cutoff, skipped };
}

/**
 * 执行一轮回收
 * @param {object} options
 * @param {Date}   [options.now]   基准时间（默认当前时间，测试可传假时钟）
 * @param {boolean}[options.dry]   true = 只查不写，用于上线前先看看会动哪些数据
 * @param {number} [options.openDays] / playingDays / cancelledDays / maxRemove 覆盖配置
 * @returns {Promise<object>} 汇总报告
 */
async function run(options) {
    const opts = options || {};
    const base = opts.now instanceof Date && !isNaN(opts.now.getTime()) ? opts.now : new Date();
    const dry = opts.dry === true;
    const cfg = readConfig(opts);

    // 三条规则串行跑：先"改状态"，最后"删数据"。
    // 反过来的话，本轮刚被取消的比赛理论上可能被同一轮的删除规则扫到（虽然
    // updatedAt 已经刷新，实际不会命中），串行就是把这个可能性彻底排掉。
    const open = await cancelStaleOpen(base, cfg, dry);
    const playing = await finishStalePlaying(base, cfg, dry);
    const dead = await removeStaleCancelled(base, cfg, dry);

    const report = {
        at: base,
        dry: dry,
        openDays: cfg.openDays,
        playingDays: cfg.playingDays,
        cancelledDays: cfg.cancelledDays,
        cancelled: open.ids.length, // 规则 1：报名中 → 已取消
        finished: playing.ids.length, // 规则 2：进行中 → 已结束
        removed: dead.ids.length, // 规则 3：已取消 → 删除
        removedSkipped: dead.skipped || 0,
        cancelledIds: open.ids,
        finishedIds: playing.ids,
        removedIds: dead.ids,
    };

    if (report.cancelled || report.finished || report.removed) {
        const tag = dry ? '试运行' : '已处理';
        console.log(
            `[recycle] ${tag}：报名中超${cfg.openDays}天→取消 ${report.cancelled} 场，` +
                `进行中超${cfg.playingDays}天→结束 ${report.finished} 场，` +
                `已取消超${cfg.cancelledDays}天→删除 ${report.removed} 场` +
                (report.removedSkipped ? `（还有 ${report.removedSkipped} 场超出单次上限，留到下一轮）` : '')
        );
    }
    return report;
}

let timer = null;
let kickoff = null;
let running = false;

/** 单次执行的包装：防重入 + 吞掉异常，定时任务不能因为一次失败就断掉 */
async function tick() {
    if (running) return;
    running = true;
    try {
        await run();
    } catch (err) {
        console.error('[recycle] 执行异常：', err && err.stack ? err.stack : err);
    } finally {
        running = false;
    }
}

/**
 * 启动定时回收
 * @param {object} [options] { intervalMinutes, enabled, immediate }
 * @returns {boolean} 是否真的启动了
 */
function start(options) {
    const cfg = readConfig(options);
    const opts = options || {};
    if (!cfg.enabled) {
        console.log('[recycle] 已通过 RECYCLE_ENABLED=false 关闭');
        return false;
    }
    if (timer) return true;

    const intervalMs = Math.max(1, cfg.intervalMinutes) * 60 * 1000;
    // 启动后延迟 30 秒跑第一轮：避开建表/建索引，也避开启动瞬间的请求高峰
    const delay = opts.immediate ? 0 : 30 * 1000;
    kickoff = setTimeout(tick, delay);
    if (typeof kickoff.unref === 'function') kickoff.unref();

    timer = setInterval(tick, intervalMs);
    // unref 之后这个定时器不会阻止进程退出
    if (typeof timer.unref === 'function') timer.unref();

    console.log(
        `[recycle] 已启动：每 ${cfg.intervalMinutes} 分钟检查一次` +
            `（报名中>${cfg.openDays}天取消 / 进行中>${cfg.playingDays}天结束 / 已取消>${cfg.cancelledDays}天删除）`
    );
    return true;
}

/** 停止定时回收 */
function stop() {
    if (kickoff) clearTimeout(kickoff);
    if (timer) clearInterval(timer);
    kickoff = null;
    timer = null;
}

module.exports = {
    STATUS,
    run,
    start,
    stop,
    readConfig,
};
