#!/usr/bin/env node
/**
 * 垃圾数据回收 CLI
 *
 * 服务启动后由 utils/recycler 自动定时跑，这个脚本用于手动执行 / 上线前预演。
 *
 * 用法：
 *   node scripts/recycle.js                  # 真跑一轮
 *   node scripts/recycle.js --dry            # 只报告会动哪些数据，不写库
 *   node scripts/recycle.js --open-days 30 --playing-days 3 --cancelled-days 3
 *   node scripts/recycle.js --now 2026-12-31T00:00:00+08:00   # 用假时钟预演
 */
const recycler = require('../utils/recycler');
const db = require('../config/db');

function readArg(name, fallback) {
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const item = argv[i];
        if (item === `--${name}`) {
            const next = argv[i + 1];
            return next && next.indexOf('--') !== 0 ? next : true;
        }
        if (item.indexOf(`--${name}=`) === 0) return item.slice(name.length + 3);
    }
    return fallback;
}

function toNumber(value, fallback) {
    if (value === undefined || value === null || value === true) return fallback;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function main() {
    const dry = !!readArg('dry', false);
    const nowRaw = readArg('now', '');
    let now = new Date();
    if (nowRaw) {
        now = new Date(String(nowRaw));
        if (isNaN(now.getTime())) {
            console.error(`[recycle] --now 不是合法时间：${nowRaw}`);
            process.exit(1);
        }
    }

    const report = await recycler.run({
        now,
        dry,
        openDays: toNumber(readArg('open-days', undefined), undefined),
        playingDays: toNumber(readArg('playing-days', undefined), undefined),
        cancelledDays: toNumber(readArg('cancelled-days', undefined), undefined),
        maxRemove: toNumber(readArg('max-remove', undefined), undefined),
    });

    const head = `[recycle] 基准时间 ${report.at.toISOString()}${dry ? '（试运行，未写库）' : ''}`;
    console.log(head);
    console.log(
        `  报名中 > ${report.openDays} 天 → 已取消：${report.cancelled} 场 ${short(report.cancelledIds)}`
    );
    console.log(
        `  进行中 > ${report.playingDays} 天 → 已结束：${report.finished} 场 ${short(report.finishedIds)}`
    );
    console.log(
        `  已取消 > ${report.cancelledDays} 天 → 删除：${report.removed} 场 ${short(report.removedIds)}` +
            (report.removedSkipped ? `（另有 ${report.removedSkipped} 场超出单次上限）` : '')
    );
    if (dry) console.log('  * 加 --dry 只是预演，去掉该参数才会真正写库');
}

function short(ids) {
    if (!ids || !ids.length) return '';
    const head = ids.slice(0, 10).join(',');
    return ids.length > 10 ? `[${head} …共 ${ids.length} 个]` : `[${head}]`;
}

main()
    .then(() => db.sequelize.close())
    .then(() => process.exit(0))
    .catch(async (err) => {
        console.error('[recycle] 执行失败：', err && err.stack ? err.stack : err);
        try {
            await db.sequelize.close();
        } catch (e) {
            /* 忽略关闭异常 */
        }
        process.exit(1);
    });
