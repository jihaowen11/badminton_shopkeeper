#!/usr/bin/env node
/**
 * 测试数据工具
 *
 * 子命令：
 *   node scripts/test-data.js status          # 只看现状，不改数据
 *   node scripts/test-data.js clean           # 删除所有测试比赛（连同排期、报名）
 *   node scripts/test-data.js seed            # 新增 8 个测试用户并加入指定俱乐部
 *   node scripts/test-data.js reset           # clean + seed
 *
 * 可选参数：
 *   --match 22,28        指定要删的比赛 id（默认按名称/备注识别测试数据）
 *   --owner <openId>     俱乐部创建者，默认 ohKbE5C_R7d7Q0xew8IHeEyD4vW0
 *
 * 说明：8 个测试用户是纯数据账号（openId 为 mock_test_01~08），微信登录不了，
 * 用于凑满八人转的人数、验证排期与排名。记分由组织者代录即可。
 */
const db = require('../config/db');

const argv = process.argv.slice(2);
const command = argv[0] || 'status';
const getArg = (name, fallback) => {
    const i = argv.indexOf('--' + name);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const OWNER = getArg('owner', 'ohKbE5C_R7d7Q0xew8IHeEyD4vW0');

const TEST_USERS = [
    { openId: 'mock_test_01', nickName: '测试球员01', gender: 1, level: '初级' },
    { openId: 'mock_test_02', nickName: '测试球员02', gender: 2, level: '初级' },
    { openId: 'mock_test_03', nickName: '测试球员03', gender: 1, level: '中级' },
    { openId: 'mock_test_04', nickName: '测试球员04', gender: 2, level: '中级' },
    { openId: 'mock_test_05', nickName: '测试球员05', gender: 1, level: '中级' },
    { openId: 'mock_test_06', nickName: '测试球员06', gender: 2, level: '初级' },
    { openId: 'mock_test_07', nickName: '测试球员07', gender: 1, level: '高级' },
    { openId: 'mock_test_08', nickName: '测试球员08', gender: 2, level: '中级' },
];

/** 测试比赛的识别条件：e2e-8p.js 造的 + 历史 tmp_test 残留 */
const TEST_MATCH_WHERE = `(
    name LIKE 'tmp_test%'
    OR name LIKE 'e2e\\_%'
    OR name LIKE 'E2E %'
    OR remark LIKE 'e2e\\_%'
    OR remark LIKE 'tmp_test%'
)`;

const q = (sql, replacements, options) =>
    db.sequelize.query(sql, Object.assign({ replacements }, options || {}));

function line(title) {
    console.log('\n' + title);
}

async function showStatus() {
    const [users] = await q(
        `SELECT open_id, nick_name FROM users WHERE open_id LIKE 'mock\\_test\\_%' ORDER BY open_id`
    );
    const [matches] = await q(`SELECT id, name, status FROM matches WHERE ${TEST_MATCH_WHERE} ORDER BY id`);
    const [clubs] = await q('SELECT id, name, creator FROM clubs WHERE creator = ?', [OWNER]);

    line('测试用户');
    if (!users.length) console.log('  （无）');
    users.forEach((u) => console.log(`  ${u.open_id}  ${u.nick_name}`));

    line('测试比赛');
    if (!matches.length) console.log('  （无）');
    matches.forEach((m) => console.log(`  id=${m.id}  status=${m.status}  ${m.name}`));

    line('目标俱乐部');
    if (!clubs.length) {
        console.log(`  creator=${OWNER} 名下没有俱乐部`);
    } else {
        for (const c of clubs) {
            const [members] = await q(
                `SELECT COUNT(*) n FROM club_members WHERE club_id = ? AND status = 1`,
                [c.id]
            );
            const [mockCount] = await q(
                `SELECT COUNT(*) n FROM club_members WHERE club_id = ? AND user_id LIKE 'mock\\_test\\_%'`,
                [c.id]
            );
            console.log(`  id=${c.id}  ${c.name}  成员 ${members[0].n} 人（其中测试账号 ${mockCount[0].n} 人）`);
        }
    }
}

async function cleanTestMatches() {
    const explicit = getArg('match', '');
    let targets;
    if (explicit) {
        const ids = explicit.split(',').map((x) => Number(String(x).trim())).filter((n) => Number.isFinite(n) && n > 0);
        const [rows] = await q(
            `SELECT id, name FROM matches WHERE id IN (${ids.map(() => '?').join(',') || 'NULL'})`,
            ids
        );
        targets = rows;
    } else {
        const [rows] = await q(`SELECT id, name FROM matches WHERE ${TEST_MATCH_WHERE} ORDER BY id`);
        targets = rows;
    }

    line('删除测试比赛');
    if (!targets.length) {
        console.log('  没有匹配到测试比赛，无需清理');
        return;
    }

    const ids = targets.map((t) => t.id);
    const t = await db.sequelize.transaction();
    try {
        const ph = ids.map(() => '?').join(',');
        const opts = { transaction: t };
        const [rounds] = await q(`DELETE FROM match_rounds WHERE match_id IN (${ph})`, ids, opts);
        await q(`DELETE FROM match_participants WHERE match_id IN (${ph})`, ids, opts);
        const [matchRes] = await q(`DELETE FROM matches WHERE id IN (${ph})`, ids, opts);
        await t.commit();
        targets.forEach((m) => console.log(`  ✗ id=${m.id}  ${m.name}`));
        console.log(`  已删除比赛 ${matchRes.affectedRows} 场、排期 ${rounds.affectedRows} 条、报名记录若干`);
    } catch (e) {
        await t.rollback();
        throw e;
    }
}

async function seedUsers() {
    // 1) 用户表
    const [existing] = await q(
        `SELECT open_id, nick_name FROM users WHERE open_id LIKE 'mock\\_test\\_%'`
    );
    const existingMap = new Map(existing.map((u) => [u.open_id, u]));
    let created = 0;
    let updated = 0;
    for (const u of TEST_USERS) {
        if (existingMap.has(u.openId)) {
            await q(
                `UPDATE users SET nick_name = ?, name = ?, gender = ?, badminton_level = ?, remark = ?, updatedAt = NOW()
                 WHERE open_id = ?`,
                [u.nickName, u.nickName, u.gender, u.level, '测试账号', u.openId]
            );
            updated += 1;
        } else {
            await q(
                `INSERT INTO users
                 (open_id, nick_name, avatar, gender, badminton_level, name, phone, account_level, points, remark, createdAt, updatedAt)
                 VALUES (?, ?, NULL, ?, ?, ?, NULL, 0, 0, '测试账号', NOW(), NOW())`,
                [u.openId, u.nickName, u.gender, u.level, u.nickName]
            );
            created += 1;
        }
    }
    line('写入测试用户');
    console.log(`  新增 ${created} 人，已存在并更新 ${updated} 人（共 ${TEST_USERS.length} 人）`);

    // 2) 加入俱乐部
    const [clubs] = await q('SELECT id, name FROM clubs WHERE creator = ? ORDER BY id LIMIT 1', [OWNER]);
    line('加入俱乐部');
    if (!clubs.length) {
        console.log(`  creator=${OWNER} 名下没有俱乐部，跳过`);
        return;
    }
    const club = clubs[0];
    const [members] = await q(
        `SELECT user_id FROM club_members WHERE club_id = ? AND user_id LIKE 'mock\\_test\\_%'`,
        [club.id]
    );
    const memberSet = new Set(members.map((m) => m.user_id));
    let joined = 0;
    for (const u of TEST_USERS) {
        if (memberSet.has(u.openId)) continue;
        await q(
            `INSERT INTO club_members
             (club_id, user_id, user_name, user_avatar, role, status, activity, joined_at, remark, createdAt, updatedAt)
             VALUES (?, ?, ?, NULL, 'member', 1, 0, NOW(), '测试账号', NOW(), NOW())`,
            [club.id, u.openId, u.nickName]
        );
        joined += 1;
    }
    const [total] = await q('SELECT COUNT(*) n FROM club_members WHERE club_id = ? AND status = 1', [club.id]);
    console.log(`  俱乐部「${club.name}」(id=${club.id}) 新加入 ${joined} 人，现有成员 ${total[0].n} 人`);
}

async function main() {
    if (command === 'status') {
        await showStatus();
    } else if (command === 'clean') {
        await cleanTestMatches();
    } else if (command === 'seed') {
        await seedUsers();
    } else if (command === 'reset') {
        await cleanTestMatches();
        await seedUsers();
    } else {
        console.log('未知子命令：' + command);
        console.log('可用：status | clean | seed | reset');
        process.exitCode = 1;
    }
    await db.sequelize.close();
}

main().catch(async (e) => {
    console.error('执行失败：', e && e.message ? e.message : e);
    try {
        await db.sequelize.close();
    } catch (x) {
        /* ignore */
    }
    process.exit(1);
});
