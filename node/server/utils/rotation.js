/**
 * 双打轮转排期算法（八人转）
 *
 * 需求：N 个人、若干轮，每轮尽量多片场地同时开打（每场 4 人 2v2），要求
 *   1. 搭档尽量不重复（社交羽毛球最在意的一点）
 *   2. 对手尽量不重复
 *   3. 轮空次数尽量平均（N 不是 4 的倍数时每轮必然有人轮空）
 *
 * 数学背景：8 人 7 轮 2 片场地时，总搭档对数 = 7×2×2 = 28 = C(8,2)，
 * 也就是说存在"每人 7 场、每对搭档恰好一次"的完美解。
 * 一般情况（尤其 4-13 人）不一定有完美解，所以这里用
 * "加权代价 + 随机多起点搜索"：每轮打乱若干次，取代价最低的分组方案。
 * 代价里搭档重复权重远高于对手重复，保证优先满足第 1 条。
 *
 * 全部为纯函数，不依赖数据库，便于单测。
 */

/** 搭档重复的代价权重（远高于对手，保证搭档优先不重复） */
const W_PARTNER = 1000;
/** 对手重复的代价权重 */
const W_OPPONENT = 100;
/** 每轮尝试的随机分组次数（多起点搜索，越大越接近最优，代价是毫秒级耗时） */
const ATTEMPTS = 1500;

/** 4 个人的 3 种配对方式（下标指向 4 人数组） */
const PAIRING_PATTERNS = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]],
];

function pairKey(a, b) {
    return a < b ? a + '|' + b : b + '|' + a;
}

/** xorshift32：同一个种子产出同一份排期，便于问题复现 */
function createRandom(seed) {
    let s = (Number(seed) >>> 0) || 0x9e3779b9;
    return function random() {
        s ^= s << 13;
        s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5;
        s >>>= 0;
        return s / 0x100000000;
    };
}

function shuffle(list, random) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

/** 4 人里挑出代价最低的分队方式 */
function bestPairingOfQuad(quad, partnerCount, opponentCount) {
    let best = null;
    for (let p = 0; p < PAIRING_PATTERNS.length; p++) {
        const pattern = PAIRING_PATTERNS[p];
        const a = quad[pattern[0][0]];
        const b = quad[pattern[0][1]];
        const c = quad[pattern[1][0]];
        const d = quad[pattern[1][1]];

        let cost = 0;
        cost += (partnerCount.get(pairKey(a, b)) || 0) * W_PARTNER;
        cost += (partnerCount.get(pairKey(c, d)) || 0) * W_PARTNER;
        cost += (opponentCount.get(pairKey(a, c)) || 0) * W_OPPONENT;
        cost += (opponentCount.get(pairKey(a, d)) || 0) * W_OPPONENT;
        cost += (opponentCount.get(pairKey(b, c)) || 0) * W_OPPONENT;
        cost += (opponentCount.get(pairKey(b, d)) || 0) * W_OPPONENT;

        if (!best || cost < best.cost) {
            best = { cost, team1: [a, b], team2: [c, d] };
        }
    }
    return best;
}

/**
 * 安排一轮：把上场的人分成若干片场地，并决定每场 2v2 的搭档
 * @param {string[]} playing 本轮上场的人
 * @param {number} courtCount 场地数
 * @param {Map} partnerCount 搭档历史 { "a|b": 次数 }
 * @param {Map} opponentCount 对手历史
 * @param {Function} random 随机源
 * @returns {{ courts: Array, cost: number }}
 */
function arrangeRound(playing, courtCount, partnerCount, opponentCount, random) {
    let best = null;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const pool = shuffle(playing, random);
        const courts = [];
        let cost = 0;
        for (let c = 0; c < courtCount; c++) {
            const quad = pool.slice(c * 4, c * 4 + 4);
            const pick = bestPairingOfQuad(quad, partnerCount, opponentCount);
            cost += pick.cost;
            courts.push({ courtNo: c + 1, team1: pick.team1, team2: pick.team2 });
        }
        if (!best || cost < best.cost) best = { courts, cost };
        // 代价为 0 说明本轮没有任何重复搭档/对手，已经最优
        if (best.cost === 0) break;
    }
    return best;
}

/**
 * 选出本轮轮空的人：优先让"休息次数最少"的人休，其次让"打得最多"的人休，
 * 这样 N 不是 4 的倍数时，各人的上场次数差距不会超过 1 场。
 */
function pickResting(players, restCount, restTimes, playedCount, indexOf) {
    const sorted = players.slice().sort((x, y) => {
        const rx = restTimes.get(x) || 0;
        const ry = restTimes.get(y) || 0;
        if (rx !== ry) return rx - ry;
        const px = playedCount.get(x) || 0;
        const py = playedCount.get(y) || 0;
        if (px !== py) return py - px;
        return indexOf.get(x) - indexOf.get(y);
    });
    return sorted.slice(0, restCount);
}

/**
 * 按给定种子生成一版完整排期
 * @returns {{ schedule: Array, stats: object, repeatPartnerPairs: number, spread: number }}
 */
function buildSchedule(ids, cfg) {
    const { rounds, courts, restPerRound, indexOf, seed } = cfg;
    const partnerCount = new Map();
    const opponentCount = new Map();
    const restTimes = new Map(ids.map((id) => [id, 0]));
    const playedCount = new Map(ids.map((id) => [id, 0]));
    const random = createRandom(seed);

    const schedule = [];
    for (let r = 1; r <= rounds; r++) {
        const resting = pickResting(ids, restPerRound, restTimes, playedCount, indexOf);
        const restSet = new Set(resting);
        const playing = ids.filter((id) => !restSet.has(id));

        const arranged = arrangeRound(playing, courts, partnerCount, opponentCount, random);

        arranged.courts.forEach((court) => {
            const [a, b] = court.team1;
            const [c, d] = court.team2;
            partnerCount.set(pairKey(a, b), (partnerCount.get(pairKey(a, b)) || 0) + 1);
            partnerCount.set(pairKey(c, d), (partnerCount.get(pairKey(c, d)) || 0) + 1);
            [[a, c], [a, d], [b, c], [b, d]].forEach(([x, y]) => {
                opponentCount.set(pairKey(x, y), (opponentCount.get(pairKey(x, y)) || 0) + 1);
            });
            playedCount.set(a, (playedCount.get(a) || 0) + 1);
            playedCount.set(b, (playedCount.get(b) || 0) + 1);
            playedCount.set(c, (playedCount.get(c) || 0) + 1);
            playedCount.set(d, (playedCount.get(d) || 0) + 1);
        });

        resting.forEach((id) => restTimes.set(id, (restTimes.get(id) || 0) + 1));

        schedule.push({
            no: r,
            courts: arranged.courts,
            resting,
        });
    }

    // 质量统计：用来验证"搭档是否真的没重复"
    let repeatPartnerPairs = 0;
    let maxPartnerTimes = 0;
    partnerCount.forEach((times) => {
        if (times > 1) repeatPartnerPairs += 1;
        if (times > maxPartnerTimes) maxPartnerTimes = times;
    });
    const playedList = ids.map((id) => playedCount.get(id) || 0);
    const restList = ids.map((id) => restTimes.get(id) || 0);
    const playedMin = Math.min.apply(null, playedList);
    const playedMax = Math.max.apply(null, playedList);
    const restMin = Math.min.apply(null, restList);
    const restMax = Math.max.apply(null, restList);

    return {
        schedule,
        repeatPartnerPairs,
        // 出场次数极差 + 轮空次数极差，越小越公平
        spread: (playedMax - playedMin) + (restMax - restMin),
        stats: {
            players: ids.length,
            totalMatches: rounds * courts,
            distinctPartnerPairs: partnerCount.size,
            possiblePartnerPairs: (ids.length * (ids.length - 1)) / 2,
            repeatPartnerPairs,
            maxPartnerTimes,
            playedMin,
            playedMax,
            restMin,
            restMax,
        },
    };
}

/**
 * 生成完整轮转排期
 *
 * @param {string[]} players 参赛者 openId 列表
 * @param {object} options { rounds?: number, seed?: number }
 * @returns {{
 *   courts: number,
 *   rounds: number,
 *   restPerRound: number,
 *   schedule: Array<{ no: number, courts: Array<{ courtNo: number, team1: string[], team2: string[] }>, resting: string[] }>,
 *   stats: object
 * }}
 */
function generateRotation(players, options) {
    const opts = options || {};
    const ids = [];
    const seen = new Set();
    (players || []).forEach((raw) => {
        const id = raw != null ? String(raw).trim() : '';
        if (!id || seen.has(id)) return;
        seen.add(id);
        ids.push(id);
    });

    const n = ids.length;
    if (n < 4) {
        throw new Error('至少需要 4 人才能生成双打排期');
    }

    const courts = Math.floor(n / 4);
    const perRound = courts * 4;
    const restPerRound = n - perRound;

    // 默认轮数：让每个人大致打满 n-1 场
    const idealTotalMatches = (n * (n - 1)) / 4;
    const defaultRounds = Math.max(1, Math.round(idealTotalMatches / courts));
    const rawRounds = Number(opts.rounds);
    const rounds = Math.min(
        40,
        Math.max(1, Number.isFinite(rawRounds) && rawRounds > 0 ? Math.floor(rawRounds) : defaultRounds)
    );

    const indexOf = new Map(ids.map((id, i) => [id, i]));

    // 单次搜索是"逐轮贪心"的，前几轮选得不好后面会补救不回来。
    // 所以整体多跑几遍（不同随机种子），取重复搭档最少的那份。
    const restarts = n <= 8 ? 12 : 5;
    let best = null;

    for (let attempt = 0; attempt < restarts; attempt++) {
        const seed = (opts.seed != null ? Number(opts.seed) : n * 7919 + rounds) + attempt * 104729;
        const candidate = buildSchedule(ids, {
            rounds,
            courts,
            restPerRound,
            indexOf,
            seed,
        });
        if (
            !best ||
            candidate.repeatPartnerPairs < best.repeatPartnerPairs ||
            (candidate.repeatPartnerPairs === best.repeatPartnerPairs &&
                candidate.spread < best.spread)
        ) {
            best = candidate;
        }
        if (best.repeatPartnerPairs === 0 && best.spread <= 1) break;
    }

    return {
        courts,
        rounds,
        restPerRound,
        schedule: best.schedule,
        stats: best.stats,
    };
}

module.exports = {
    generateRotation,
    pairKey,
};
