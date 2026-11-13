/**
 * 双打轮转排期算法（八人转）
 *
 * 需求：N 个人、若干轮、若干片场地同时开打（每场 4 人 2v2），要求
 *   1. 搭档尽量不重复（社交羽毛球最在意的一点）
 *   2. 对手尽量不重复
 *   3. 轮空次数尽量平均（N 不是 4 的倍数时每轮必然有人轮空）
 *
 * 场地片数默认 1 片（绝大多数业余局只有一片场），调用方可通过 options.courts
 * 改成多片；上限是「人数能凑满的片数」floor(n/4)，再多也没人上场。
 *
 * 数学背景：8 人 7 轮 2 片场地时，总搭档对数 = 7×2×2 = 28 = C(8,2)，
 * 也就是说存在"每人 7 场、每对搭档恰好一次"的完美解；1 片场地则是
 * 14 轮 14 场，同样 28 组搭档，只是每轮有 4 人轮空。
 * 一般情况（尤其 4-13 人）不一定有完美解，所以这里用
 * "加权代价 + 随机多起点搜索"：每轮随机选上场的人 + 随机分队若干次，
 * 取代价最低的方案。代价里搭档重复权重远高于对手重复，保证优先满足第 1 条；
 * 再叠加"上场次数极差"惩罚，保证没人连歇好几轮。
 *
 * 全部为纯函数，不依赖数据库，便于单测。
 */

/** 搭档重复的代价权重（远高于对手，保证搭档优先不重复） */
const W_PARTNER = 1000;
/** 对手重复的代价权重 */
const W_OPPONENT = 100;
/** 上场次数不均的代价权重（介于搭档与对手之间：公平比对手重复更重要） */
const W_FAIR = 500;
/** 每轮尝试的随机分组次数（多起点搜索，越大越接近最优，代价是毫秒级耗时） */
const ATTEMPTS = 400;

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
 * 把本轮上场的人分成若干片场地，并决定每场 2v2 的搭档
 * @param {string[]} playing 本轮上场的人（长度 = 场地数 × 4，顺序随机）
 * @param {number} courtCount 场地数
 * @param {Map} partnerCount 搭档历史 { "a|b": 次数 }
 * @param {Map} opponentCount 对手历史
 * @returns {{ courts: Array, cost: number }}
 */
function pairUp(playing, courtCount, partnerCount, opponentCount) {
    const courts = [];
    let cost = 0;
    for (let c = 0; c < courtCount; c++) {
        const quad = playing.slice(c * 4, c * 4 + 4);
        const pick = bestPairingOfQuad(quad, partnerCount, opponentCount);
        cost += pick.cost;
        courts.push({ courtNo: c + 1, team1: pick.team1, team2: pick.team2 });
    }
    return { courts, cost };
}

/**
 * 本轮轮空安排是否公平：轮空过很多次的人不该再被轮空。
 * 用"历史轮空次数之和"当代价——累积值比"本轮即时极差"更有引导性，
 * 因为贪心排期看不到后面几轮，只能靠累积量把轮空摊平。
 */
function fairnessCost(ids, playingSet, restTimes) {
    let cost = 0;
    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (!playingSet.has(id)) cost += (restTimes.get(id) || 0) * W_FAIR;
    }
    return cost;
}

/**
 * 按给定种子生成一版完整排期
 * @returns {{ schedule: Array, stats: object, repeatPartnerPairs: number, spread: number }}
 */
function buildSchedule(ids, cfg) {
    const { rounds, courts, restPerRound, seed } = cfg;
    // 每轮上场人数 = 场地数 × 4；剩下的轮空
    const perRound = ids.length - restPerRound;
    const partnerCount = new Map();
    const opponentCount = new Map();
    const restTimes = new Map(ids.map((id) => [id, 0]));
    const playedCount = new Map(ids.map((id) => [id, 0]));
    const random = createRandom(seed);

    const schedule = [];
    for (let r = 1; r <= rounds; r++) {
        let best = null;
        for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
            // 关键：每轮"谁上场"也要参与搜索。
            // 早期版本按轮空次数排序取前 N 人轮空，结果是每轮阵容几乎固定，
            // 只有 1 片场地时搭档会在同 4 个人里反复出现（8 人 14 轮能重复 12 组）。
            const playing = shuffle(ids, random).slice(0, perRound);
            const playingSet = new Set(playing);
            const arranged = pairUp(playing, courts, partnerCount, opponentCount);
            const fair = fairnessCost(ids, playingSet, restTimes);
            const cost = arranged.cost + fair;
            if (!best || cost < best.cost) {
                best = { cost, courts: arranged.courts, playing };
            }
            if (arranged.cost === 0 && fair === 0) break;
        }

        const resting = ids.filter((id) => best.playing.indexOf(id) === -1);
        best.courts.forEach((court) => {
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
            courts: best.courts,
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
 * @param {object} options { rounds?: number, courts?: number, seed?: number }
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

    // 场地片数：默认 1 片，最多 floor(n/4) 片（超出人数就凑不出场了）
    const maxCourts = Math.max(1, Math.floor(n / 4));
    const rawCourts = Number(opts.courts);
    const courts = Math.min(
        maxCourts,
        Math.max(1, Number.isFinite(rawCourts) && rawCourts > 0 ? Math.floor(rawCourts) : 1)
    );
    const perRound = courts * 4;
    const restPerRound = n - perRound;

    // 默认轮数：让每个人大致打满 n-1 场（总场次 ÷ 场地片数）
    const idealTotalMatches = (n * (n - 1)) / 4;
    const defaultRounds = Math.max(1, Math.round(idealTotalMatches / courts));
    const rawRounds = Number(opts.rounds);
    const rounds = Math.min(
        40,
        Math.max(1, Number.isFinite(rawRounds) && rawRounds > 0 ? Math.floor(rawRounds) : defaultRounds)
    );

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
