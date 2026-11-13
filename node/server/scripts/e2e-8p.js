#!/usr/bin/env node
/**
 * 八人转端到端测试
 *
 * 为什么要这个脚本：八人转必须凑够 8 个不同身份，开发者工具里只能登一个微信号，
 * 真找 8 个人来点一遍成本太高。这里用真实 HTTP 接口 + 自签令牌模拟另外 7 个球友，
 * 组织者仍用你数据库里真实的 openId，所以 --keep 模式下小程序里能直接看到这场测试赛。
 *
 * 用法：
 *   node scripts/e2e-8p.js                 # 跑完自动清理，不留垃圾数据
 *   node scripts/e2e-8p.js --keep          # 保留数据，用于在小程序里点 UI
 *   node scripts/e2e-8p.js --keep --organizer o_xxx
 *   node scripts/e2e-8p.js --host http://127.0.0.1:3000
 *
 * 覆盖：创建比赛 → 8 人报名 → 生成排期 → 轮转质量 → 自定义轮数 → 录入 14 场比分
 *      → 排名汇总 → 撤销单场 → 权限校验 → 结束后锁定 → 清理
 */
const http = require('http');
const assert = require('assert');
const { URL } = require('url');
const { signToken } = require('../utils/token');
const db = require('../config/db');

// ---------- 参数 ----------
const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes('--' + name);
const getArg = (name, fallback) => {
    const i = argv.indexOf('--' + name);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const HOST = getArg('host', 'http://127.0.0.1:3000');
const KEEP = hasFlag('keep');
const STAMP = Date.now();
const TAG = `e2e_${STAMP}`;
const FAKE_COUNT = 7; // 组织者自己算 1 人，凑齐 8 人

let passed = 0;
let stepNo = 0;

function step(title) {
    stepNo += 1;
    console.log(`\n[${stepNo}] ${title}`);
}

function ok(desc) {
    passed += 1;
    console.log('    ✓ ' + desc);
}

function info(desc) {
    console.log('    · ' + desc);
}

// ---------- HTTP ----------
function post(path, body, token) {
    const u = new URL(path, HOST);
    const data = JSON.stringify(body || {});
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                host: u.hostname,
                port: u.port || 80,
                path: u.pathname,
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'content-length': Buffer.byteLength(data),
                    ...(token ? { authorization: token } : {}),
                },
            },
            (res) => {
                let raw = '';
                res.on('data', (c) => (raw += c));
                res.on('end', () => {
                    let json = null;
                    try {
                        json = JSON.parse(raw);
                    } catch (e) {
                        /* 非 JSON 说明命中了异常分支，交给调用方断言 */
                    }
                    resolve({ httpStatus: res.statusCode, body: json, raw });
                });
            }
        );
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

/** 断言接口返回 code=200，否则把后端 message 带出来 */
function expectOk(ret, desc) {
    const code = ret.body && ret.body.code;
    const msg = (ret.body && ret.body.message) || ret.raw || '(空响应)';
    assert.strictEqual(String(code), '200', `${desc} 期望 code=200，实际 ${code}：${msg}`);
    return ret.body.object;
}

function expectError(ret, code, desc) {
    const actual = ret.body && String(ret.body.code);
    const msg = (ret.body && ret.body.message) || ret.raw || '(空响应)';
    assert.strictEqual(actual, String(code), `${desc} 期望 code=${code}，实际 ${actual}：${msg}`);
    return msg;
}

// ---------- 数据准备 ----------
async function pickOrganizer() {
    const explicit = getArg('organizer', '');
    if (explicit) return explicit;
    // 默认取"创建比赛最多的人"，也就是真正在用这个小程序的人
    const [rows] = await db.sequelize.query(
        `SELECT created_by, COUNT(*) n FROM matches
         WHERE created_by IS NOT NULL AND created_by <> ''
         GROUP BY created_by ORDER BY n DESC LIMIT 1`
    );
    if (rows.length) return String(rows[0].created_by);
    const [users] = await db.sequelize.query('SELECT open_id FROM users ORDER BY id LIMIT 1');
    if (users.length) return String(users[0].open_id);
    throw new Error('数据库里没有可用用户，请先从微信登录一次');
}

// ---------- 主流程 ----------
async function main() {
    const organizer = await pickOrganizer();
    const orgToken = signToken(organizer).token;
    const fakes = Array.from({ length: FAKE_COUNT }, (_, i) => ({
        openId: `${TAG}_p${i + 1}`,
        name: `测试球友${i + 1}`,
        token: signToken(`${TAG}_p${i + 1}`).token,
    }));

    info(`目标服务：${HOST}`);
    info(`组织者：${organizer}`);
    info(`模拟球友：${fakes.length} 人（${TAG}_p1 ~ p${FAKE_COUNT}）`);

    // ---------- 1. 创建比赛 ----------
    step('创建比赛（8 人 / 14 场 / 21 分制）');
    const match = expectOk(
        await post(
            '/matches/create',
            {
                type: 2,
                name: `E2E 八人转 ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
                playerCount: 8,
                sessionCount: 14,
                targetScore: 21,
                bestOf: 1,
                competitionFormat: 'doubles',
                status: 1,
                remark: TAG,
            },
            orgToken
        ),
        '创建比赛'
    );
    const matchId = match.id;
    ok(`比赛已创建，id=${matchId}，创建人自动报名`);
    assert.strictEqual(String(match.createdBy), organizer, '创建人必须是登录者');

    // ---------- 2. 报名 ----------
    step('7 个球友报名');
    for (const f of fakes) {
        const obj = expectOk(
            await post('/matchParticipants/create', { matchId, userName: f.name }, f.token),
            `${f.name} 报名`
        );
        assert.ok(obj && obj.id, `${f.name} 报名后应返回记录`);
    }
    const dup = await post('/matchParticipants/create', { matchId }, fakes[0].token);
    expectOk(dup, '重复报名');
    assert.strictEqual(dup.body.message, '已报名', '重复报名应返回「已报名」而不是报错');
    ok(`8 人报名完成，重复报名幂等`);

    // ---------- 3. 生成排期 ----------
    step('生成排期（默认 1 片场地，8 人 14 场 → 14 轮）');
    const genOne = expectOk(await post('/matchRounds/generate', { matchId }, orgToken), '生成排期');
    assert.strictEqual(genOne.courts, 1, `默认应为 1 片场地，实际 ${genOne.courts}`);
    assert.strictEqual(genOne.totalRounds, 14, `8 人 14 场 ÷ 1 片场 = 14 轮，实际 ${genOne.totalRounds}`);
    assert.strictEqual(genOne.totalMatches, 14, `应生成 14 场，实际 ${genOne.totalMatches}`);
    ok('默认 1 片场地 → 14 轮 14 场，每轮 4 人上场 4 人轮空');

    // 1 片场地同样要做到 28 组搭档不重复（14 轮 × 2 组搭档 = C(8,2)）
    const listOne = expectOk(await post('/matchRounds/list', { matchId }, orgToken), '查询 1 片场排期');
    assert.strictEqual(listOne.rounds.length, 14, `应有 14 轮，实际 ${listOne.rounds.length}`);
    const onePairs = [];
    const onePlayed = new Map();
    listOne.rounds.forEach((rd) => {
        assert.strictEqual(rd.courts.length, 1, `第 ${rd.no} 轮应只有 1 场`);
        assert.strictEqual(rd.resting.length, 4, `8 人 1 片场每轮应有 4 人轮空，第 ${rd.no} 轮 ${rd.resting.length} 人`);
        const c = rd.courts[0];
        const t1 = c.team1.map((p) => p.openId);
        const t2 = c.team2.map((p) => p.openId);
        onePairs.push([t1[0], t1[1]].sort().join('|'), [t2[0], t2[1]].sort().join('|'));
        [...t1, ...t2].forEach((id) => onePlayed.set(id, (onePlayed.get(id) || 0) + 1));
    });
    assert.strictEqual(
        new Set(onePairs).size,
        onePairs.length,
        `1 片场地下搭档重复：${onePairs.length} 组只有 ${new Set(onePairs).size} 组不同`
    );
    const onePlays = [...onePlayed.values()];
    assert.ok(onePlays.every((v) => v === 7), `1 片场地每人应打 7 场，实际 ${onePlays.join('/')}`);
    ok('1 片场地 14 轮：28 组搭档全部不同，每人 7 场 7 休');

    step('改为 2 片场地重新排期');
    const gen = expectOk(
        await post('/matchRounds/generate', { matchId, courts: 2, force: true }, orgToken),
        '生成排期'
    );
    assert.strictEqual(gen.courts, 2, `应使用 2 片场地，实际 ${gen.courts}`);
    assert.strictEqual(gen.totalRounds, 7, `8 人 14 场 ÷ 2 片场 = 7 轮，实际 ${gen.totalRounds}`);
    assert.strictEqual(gen.totalMatches, 14, `应生成 14 场，实际 ${gen.totalMatches}`);
    ok(`7 轮 / 14 场 / 2 片场，与计划一致`);

    step('场地片数越界兜底');
    const genOver = expectOk(
        await post('/matchRounds/generate', { matchId, courts: 9, force: true }, orgToken),
        '生成排期'
    );
    assert.strictEqual(genOver.courts, 2, `8 人最多 2 片场地，实际 ${genOver.courts}`);
    ok('courts 超出人数上限时截断为 floor(8/4)=2');
    expectOk(
        await post('/matchRounds/generate', { matchId, courts: 2, force: true }, orgToken),
        '恢复 2 片场'
    );

    // 比赛状态应自动从"报名中"推进到"进行中"
    const detail = expectOk(await post('/matches/detail', { id: matchId }, orgToken), '比赛详情');
    const detailMatch = detail && detail.match ? detail.match : detail;
    assert.strictEqual(Number(detailMatch.status), 2, '生成排期后状态应变为进行中(2)');
    assert.strictEqual(detail.participants.length, 8, `详情应带 8 名报名，实际 ${detail.participants.length}`);
    ok('比赛状态自动推进：报名中 → 进行中');

    // ---------- 4. 轮转质量 ----------
    step('检查轮转质量（搭档不重复 / 对手分布 / 轮空）');
    let list = expectOk(await post('/matchRounds/list', { matchId }, orgToken), '排期查询');
    assert.strictEqual(list.generated, true);
    assert.strictEqual(list.rounds.length, 7);
    assert.strictEqual(list.players.length, 8);
    assert.strictEqual(list.finishedMatches, 0);

    const partnerPairs = [];
    const opponentCount = new Map();
    const playCount = new Map();
    const restCount = new Map();
    const key = (a, b) => [a, b].sort().join('|');

    list.rounds.forEach((rd) => {
        const slots = rd.courts.reduce((n, c) => n + c.team1.length + c.team2.length, 0);
        assert.strictEqual(slots, 8, `第 ${rd.no} 轮应有 8 人上场`);
        assert.strictEqual(rd.courts.length, 2, `第 ${rd.no} 轮应有 2 场`);
        assert.strictEqual(rd.resting.length, 0, `8 人 2 片场不应有轮空，第 ${rd.no} 轮轮到 ${rd.resting.length} 人`);
        rd.resting.forEach((p) => restCount.set(p.openId, (restCount.get(p.openId) || 0) + 1));

        rd.courts.forEach((c) => {
            const t1 = c.team1.map((p) => p.openId);
            const t2 = c.team2.map((p) => p.openId);
            assert.strictEqual(t1.length, 2);
            assert.strictEqual(t2.length, 2);
            partnerPairs.push(key(t1[0], t1[1]), key(t2[0], t2[1]));
            [...t1, ...t2].forEach((id) => playCount.set(id, (playCount.get(id) || 0) + 1));
            t1.forEach((a) => t2.forEach((b) => {
                const k = key(a, b);
                opponentCount.set(k, (opponentCount.get(k) || 0) + 1);
            }));
        });
    });

    const uniquePartners = new Set(partnerPairs);
    assert.strictEqual(
        uniquePartners.size,
        partnerPairs.length,
        `搭档出现重复：${partnerPairs.length} 组里只有 ${uniquePartners.size} 组不重复`
    );
    ok(`搭档 28 组全部不重复（8 人 7 轮完美解）`);

    const plays = [...playCount.values()];
    assert.ok(plays.every((n) => n === 7), `每人应打 7 场，实际 ${plays.join('/')}`);
    ok('每人上场 7 场，无轮空');

    const oppValues = [...opponentCount.values()];
    const oppMin = Math.min(...oppValues);
    const oppMax = Math.max(...oppValues);
    info(`对手组合 ${opponentCount.size} 组，出现次数 ${oppMin}~${oppMax}（理想值 2）`);
    if (oppMin === 2 && oppMax === 2) ok('每对对手正好交手 2 次，轮转均衡');
    else console.log('    ! 对手分布未做到完全均衡（不影响使用，仅提示）');

    // ---------- 5. 自定义轮数 ----------
    step('自定义轮数（rounds=3 + courts=2，验证现场压缩时间）');
    const gen3 = expectOk(
        await post('/matchRounds/generate', { matchId, rounds: 3, courts: 2, force: true }, orgToken),
        '生成 3 轮'
    );
    assert.strictEqual(gen3.totalRounds, 3, `应生成 3 轮，实际 ${gen3.totalRounds}`);
    assert.strictEqual(gen3.totalMatches, 6, `3 轮 × 2 片场 = 6 场，实际 ${gen3.totalMatches}`);
    ok('rounds=3 + courts=2 → 3 轮 6 场');

    step('恢复默认轮数与场地（courts=2 → 7 轮）');
    const gen7 = expectOk(
        await post('/matchRounds/generate', { matchId, courts: 2, force: true }, orgToken),
        '恢复 7 轮'
    );
    assert.strictEqual(gen7.totalRounds, 7);
    assert.strictEqual(gen7.totalMatches, 14);
    ok('恢复 7 轮 14 场');

    // ---------- 6. 录入比分 ----------
    step('录入 14 场比分（奇数轮一队胜、偶数轮二队胜）');
    list = expectOk(await post('/matchRounds/list', { matchId }, orgToken), '重新拉取排期');
    let submitted = 0;
    for (const rd of list.rounds) {
        for (const c of rd.courts) {
            const team1Wins = rd.no % 2 === 1;
            const s1 = team1Wins ? 21 : 15;
            const s2 = team1Wins ? 15 : 21;
            expectOk(
                await post('/matchRounds/submitScore', { roundId: c.id, team1Score: s1, team2Score: s2 }, orgToken),
                `第 ${rd.no} 轮第 ${c.courtNo} 场录分`
            );
            submitted += 1;
            c.score1 = s1;
            c.score2 = s2;
            c.done = true;
        }
    }
    assert.strictEqual(submitted, 14);
    ok('14 场比分全部写入');

    step('校验排名汇总');
    const after = expectOk(await post('/matchRounds/list', { matchId }, orgToken), '排名查询');
    assert.strictEqual(after.finishedMatches, 14, `应完成 14 场，实际 ${after.finishedMatches}`);
    assert.strictEqual(after.rankings.length, 8, `应有 8 条排名，实际 ${after.rankings.length}`);

    const sumWin = after.rankings.reduce((n, r) => n + r.win, 0);
    const sumLose = after.rankings.reduce((n, r) => n + r.lose, 0);
    // 一场双打 4 人，胜方 2 人各记 1 胜，所以 14 场 = 28 胜 28 负
    assert.strictEqual(sumWin, 28, `胜场合计应为 28（14 场 × 2 人），实际 ${sumWin}`);
    assert.strictEqual(sumLose, 28, `负场合计应为 28（14 场 × 2 人），实际 ${sumLose}`);
    assert.ok(after.rankings.every((r) => r.played === 7), '每人played应为7');
    assert.ok(
        after.rankings.every((r) => r.win + r.lose === r.played),
        '胜+负应等于总场次'
    );
    for (let i = 1; i < after.rankings.length; i++) {
        assert.ok(
            after.rankings[i - 1].win >= after.rankings[i].win,
            '排名应按胜场降序'
        );
    }
    ok('胜负合计 28/28（14 场 × 2 人），每人 7 场，排序正确');
    info('前三名：' + after.rankings.slice(0, 3).map((r) => `${r.name} ${r.win}胜${r.lose}负 净${r.diff >= 0 ? '+' : ''}${r.diff}`).join(' | '));

    // ---------- 7. 撤销单场 ----------
    step('撤销一场比分');
    const victim = after.rounds[0].courts[0];
    const beforePlayers = victim.team1.concat(victim.team2).map((p) => p.openId);
    const clearRet = expectOk(await post('/matchRounds/clearScore', { roundId: victim.id }, orgToken), '撤销比分');
    assert.strictEqual(clearRet.team1Score, null, '撤销后比分应清空');
    assert.strictEqual(Number(clearRet.status), 0, '撤销后场次状态应回到未开始');

    const afterClear = expectOk(await post('/matchRounds/list', { matchId }, orgToken), '撤销后查询');
    assert.strictEqual(afterClear.finishedMatches, 13, `撤销后应剩 13 场，实际 ${afterClear.finishedMatches}`);
    beforePlayers.forEach((id) => {
        const row = afterClear.rankings.find((r) => r.openId === id);
        assert.strictEqual(row.played, 6, `${row.name} 撤销后应打 6 场，实际 ${row.played}`);
    });
    ok('比分清空、排名同步回退（4 名参与者场次各减 1）');

    // ---------- 8. 权限校验 ----------
    step('权限校验（陌生人 / 非本场参赛者 / 本场参赛者 / 非组织者）');
    const stranger = signToken(`${TAG}_stranger`).token;
    expectError(
        await post('/matchRounds/submitScore', { roundId: afterClear.rounds[0].courts[1].id, team1Score: 21, team2Score: 10 }, stranger),
        403,
        '陌生人录分'
    );
    ok('陌生人录分被拒 403');

    // 找一个不含 fakes[0] 的场次：参赛者也只能动自己那场，不能撤别人的
    let foreignCourt = null;
    for (const rd of afterClear.rounds) {
        foreignCourt = rd.courts.find((c) => c.team1.concat(c.team2).every((p) => String(p.openId) !== fakes[0].openId));
        if (foreignCourt) break;
    }
    assert.ok(foreignCourt, '应存在不含 fakes[0] 的场次');
    expectError(
        await post('/matchRounds/clearScore', { roundId: foreignCourt.id }, fakes[0].token),
        403,
        '撤销别人那场'
    );
    ok('非本场参赛者撤销比分被拒 403');

    // 本场参赛者：可以录自己的场次，也可以撤销自己的场次
    const ownCourt = afterClear.rounds[0].courts[1];
    const fourIds = ownCourt.team1.concat(ownCourt.team2).map((p) => p.openId);
    const ownToken = fakes.find((f) => fourIds.indexOf(f.openId) !== -1);
    assert.ok(ownToken, '这一场里应至少有一名模拟球友');
    expectOk(
        await post('/matchRounds/submitScore', { roundId: ownCourt.id, team1Score: 21, team2Score: 18 }, ownToken.token),
        '参赛者录自己场次'
    );
    ok(`参赛者 ${ownToken.name}（非组织者）可以录自己的场次`);

    const ownClear = expectOk(
        await post('/matchRounds/clearScore', { roundId: ownCourt.id }, ownToken.token),
        '参赛者撤销自己场次'
    );
    assert.strictEqual(ownClear.team1Score, null, '撤销后比分应清空');
    assert.strictEqual(Number(ownClear.status), 0, '撤销后状态应回到未开始');
    ok(`参赛者 ${ownToken.name}（非组织者）可以撤销自己的场次`);

    // 补回比分，保持后面「13 场已录分」的口径
    expectOk(
        await post('/matchRounds/submitScore', { roundId: ownCourt.id, team1Score: 21, team2Score: 18 }, ownToken.token),
        '补回比分'
    );

    expectError(await post('/matchRounds/generate', { matchId }, fakes[0].token), 403, '非组织者排期');
    ok('非组织者生成排期被拒 403');

    // ---------- 9. 结束后锁定 ----------
    step('比赛结束后锁定比分');
    expectOk(await post('/matches/updateStatus', { id: matchId, status: 3 }, orgToken), '结束比赛');
    const lockedMsg = expectError(
        await post('/matchRounds/submitScore', { roundId: afterClear.rounds[0].courts[1].id, team1Score: 21, team2Score: 5 }, orgToken),
        412,
        '结束后录分'
    );
    assert.ok(lockedMsg.includes('已结束'), `提示应说明比赛已结束，实际：${lockedMsg}`);
    ok('结束后录分被拒：' + lockedMsg);

    const lockedClear = expectError(
        await post('/matchRounds/clearScore', { roundId: afterClear.rounds[0].courts[1].id }, orgToken),
        412,
        '结束后撤销'
    );
    assert.ok(lockedClear.includes('已结束'));
    ok('结束后撤销被拒：' + lockedClear);

    // ---------- 10. 收尾 ----------
    if (KEEP) {
        // 留成"进行中"，方便在小程序里继续点记分/撤销
        expectOk(await post('/matches/updateStatus', { id: matchId, status: 2 }, orgToken), '恢复进行中');
        console.log('\n===== 已保留测试数据（小程序里可直接打开）=====');
        console.log(`比赛 id：${matchId}`);
        console.log(`组织者 openId：${organizer}`);
        console.log(`开发者工具页面路径：pages/match/details/index?id=${matchId}`);
        console.log('状态：进行中，13 场已录分、1 场空着，方便试「记分 / 撤销 / 当前轮定位」');
        console.log(`清理方式：node scripts/e2e-8p.js --cleanup ${matchId}`);
    } else {
        step('清理测试数据');
        await post('/matches/delete', { id: matchId }, orgToken);
        const [left] = await db.sequelize.query('SELECT COUNT(*) n FROM matches WHERE id = ?', {
            replacements: [matchId],
        });
        assert.strictEqual(Number(left[0].n), 0, '比赛应已删除');
        const [rp] = await db.sequelize.query(
            'SELECT (SELECT COUNT(*) FROM match_rounds WHERE match_id = ?) r, (SELECT COUNT(*) FROM match_participants WHERE match_id = ?) p',
            { replacements: [matchId, matchId] }
        );
        assert.strictEqual(Number(rp[0].r), 0, '排期应级联删除');
        assert.strictEqual(Number(rp[0].p), 0, '报名应级联删除');
        ok('比赛 / 排期 / 报名全部清理干净');
    }

    console.log(`\n全部通过：${passed} 项断言，共 ${stepNo} 步`);
    await db.sequelize.close();
}

/** 只清理 --keep 留下的数据 */
async function cleanup(matchId) {
    const [rows] = await db.sequelize.query('SELECT id, name, created_by FROM matches WHERE id = ?', {
        replacements: [matchId],
    });
    if (!rows.length) {
        console.log(`比赛 ${matchId} 不存在，无需清理`);
        await db.sequelize.close();
        return;
    }
    const organizer = String(rows[0].created_by || '');
    const token = signToken(organizer).token;
    await post('/matches/delete', { id: matchId }, token);
    const [left] = await db.sequelize.query('SELECT COUNT(*) n FROM matches WHERE id = ?', { replacements: [matchId] });
    console.log(Number(left[0].n) === 0 ? `比赛 ${matchId} 已删除` : `删除失败，请手动检查 ${matchId}`);
    await db.sequelize.close();
}

const cleanupTarget = getArg('cleanup', '');
if (cleanupTarget) {
    cleanup(cleanupTarget).catch(async (e) => {
        console.error('清理失败：', e.message);
        try { await db.sequelize.close(); } catch (x) {}
        process.exit(1);
    });
} else {
    main().catch(async (e) => {
        console.error('\n测试失败：', e && e.message ? e.message : e);
        if (e && e.stack) console.error(e.stack.split('\n').slice(1, 4).join('\n'));
        try { await db.sequelize.close(); } catch (x) {}
        process.exit(1);
    });
}
