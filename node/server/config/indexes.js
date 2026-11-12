/**
 * 二级索引补齐（幂等，可重复执行）
 *
 * 背景：各模型只做了 `sync({ force: false })`，它只建表、不会给已有表补索引。
 * 之前 match_participants / matches / club_members 除主键外没有任何索引，
 * 而详情页、报名、俱乐部成员列表天天按这些字段查，数据一多就是全表扫描。
 *
 * 做法：启动后异步执行，逐项检查 information_schema 再 ALTER，失败只记日志不影响服务。
 * 唯一索引建之前先清理历史重复数据（保留 id 最小的一条），否则 ALTER 会直接报错。
 */
const db = require('./db');

const Sequelize = db.sequelize;

const INDEXES = [
    // 比赛列表/详情：按创建者过滤、按俱乐部 + 状态过滤、按开赛时间排序
    { table: 'matches', name: 'idx_matches_created_by', fields: ['created_by'] },
    { table: 'matches', name: 'idx_matches_club_status', fields: ['club_id', 'status'] },
    { table: 'matches', name: 'idx_matches_start_time', fields: ['start_time'] },

    // 报名表：按用户查"我参加过的比赛"，按 (比赛, 用户) 查重与排序
    { table: 'match_participants', name: 'idx_mp_user', fields: ['user_id'] },
    {
        table: 'match_participants',
        name: 'uk_mp_match_user',
        fields: ['match_id', 'user_id'],
        unique: true,
        // 并发报名/弱网重试可能留下重复行，先按 (match_id,user_id) 去重，保留最早的一条
        dedupeSql:
            'DELETE t1 FROM `match_participants` t1 ' +
            'INNER JOIN `match_participants` t2 ' +
            'ON t1.`match_id` = t2.`match_id` AND t1.`user_id` = t2.`user_id` AND t1.`id` > t2.`id`',
    },

    // 俱乐部成员：按 (俱乐部, 用户) 判重与鉴权、按用户查"我的俱乐部"
    { table: 'club_members', name: 'idx_cm_club_user', fields: ['club_id', 'user_id'] },
    { table: 'club_members', name: 'idx_cm_user', fields: ['user_id'] },

    // 俱乐部列表：按创建者查
    { table: 'clubs', name: 'idx_clubs_creator', fields: ['creator'] },
];

const RETRY_DELAY_MS = 3000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tableExists(table) {
    const [rows] = await Sequelize.query(
        'SELECT 1 FROM information_schema.tables ' +
        'WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
        { replacements: [table] }
    );
    return rows.length > 0;
}

async function indexExists(table, name) {
    const [rows] = await Sequelize.query(
        'SELECT 1 FROM information_schema.statistics ' +
        'WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
        { replacements: [table, name] }
    );
    return rows.length > 0;
}

async function ensureOne(item) {
    if (!(await tableExists(item.table))) return false;
    if (await indexExists(item.table, item.name)) return true;

    if (item.unique && item.dedupeSql) {
        const [result] = await Sequelize.query(item.dedupeSql);
        const removed = result && result.affectedRows ? result.affectedRows : 0;
        if (removed > 0) {
            console.log(`[index] ${item.table} 清理重复数据 ${removed} 行，随后建立唯一索引 ${item.name}`);
        }
    }

    const cols = item.fields.map((f) => '`' + f + '`').join(', ');
    const kind = item.unique ? 'UNIQUE KEY' : 'KEY';
    try {
        await Sequelize.query(
            `ALTER TABLE \`${item.table}\` ADD ${kind} \`${item.name}\` (${cols})`
        );
        console.log(`[index] 已创建 ${item.table}.${item.name}`);
    } catch (err) {
        // 模型 sync() 可能刚好在检查之后把索引建好了，这种情况视为成功
        const msg = err && err.message ? String(err.message) : '';
        if (!/Duplicate key name/i.test(msg)) throw err;
    }
    return true;
}

/**
 * 补索引。表可能还没 sync 出来，所以按轮次重试；全部就绪或重试用尽后结束。
 * @param {{retries?: number}} [options]
 */
async function ensureIndexes(options = {}) {
    const retries = Number.isFinite(options.retries) ? options.retries : 5;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
        const pending = [];
        for (const item of INDEXES) {
            try {
                const ok = await ensureOne(item);
                if (!ok) pending.push(item);
            } catch (err) {
                // 单项失败不影响其它索引，也不该把服务拖垮
                console.error(
                    `[index] ${item.table}.${item.name} 创建失败：`,
                    err && err.message ? err.message : err
                );
            }
        }
        if (pending.length === 0) return true;
        if (attempt < retries) await sleep(RETRY_DELAY_MS);
    }

    const names = INDEXES.map((i) => `${i.table}.${i.name}`).join(', ');
    console.warn(`[index] 有索引未能确认（表可能尚未建好）：${names}`);
    return false;
}

module.exports = { ensureIndexes, INDEXES };
