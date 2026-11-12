const MatchRoundModel = require('../modules/matchRounds');
const MatchModel = require('../modules/matches');
const MatchParticipantModel = require('../modules/matchParticipants');
const UserModel = require('../modules/users');
const R = require('../utils/responseBeautifier');

/** 统一的字符串取值 */
function str(v) {
    return v != null ? String(v).trim() : '';
}

function toInt(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

function currentOpenId(ctx) {
    return ctx && ctx.state && ctx.state.openId ? String(ctx.state.openId).trim() : '';
}

/** 参赛者 openId 列表 + 展示信息（昵称/头像以 users 表为准，回落到报名快照） */
async function loadPlayers(matchId) {
    const partRows = await MatchParticipantModel.listByMatchIds([matchId]);
    const plains = partRows.map((r) => r.get({ plain: true }));
    const openIds = plains.map((p) => str(p.userId)).filter(Boolean);
    const userMap = await UserModel.mapProfileByOpenIds(openIds);

    const playerMap = new Map();
    const players = plains.map((p) => {
        const openId = str(p.userId);
        const user = userMap.get(openId) || {};
        const item = {
            openId,
            name: str(user.nickName) || str(user.name) || str(p.userName) || '球友',
            avatar: str(user.avatar) || str(p.userAvatar) || '',
            number: p.number != null ? String(p.number) : '',
        };
        playerMap.set(openId, item);
        return item;
    });
    return { players, playerMap };
}

class MatchRoundController {
    /**
     * 生成排期
     * body: { matchId, rounds?, force? }
     */
    static async generate(ctx) {
        const req = ctx.request.body || {};
        const matchId = toInt(req.matchId);
        if (!matchId) {
            ctx.body = R.error(416, '缺少比赛 id');
            return;
        }
        const openId = currentOpenId(ctx);

        try {
            const matchRow = await MatchModel.detail(matchId);
            if (!matchRow) {
                ctx.body = R.error(412, '比赛不存在');
                return;
            }
            const match = matchRow.get({ plain: true });
            if (str(match.createdBy) !== openId) {
                ctx.body = R.error(403, '只有组织者可以生成排期');
                return;
            }
            if (Number(match.status) === 3 || Number(match.status) === 5) {
                ctx.body = R.error(412, '比赛已结束或已取消，无法生成排期');
                return;
            }

            const { players } = await loadPlayers(matchId);
            if (players.length < 4) {
                ctx.body = R.error(412, `当前只有 ${players.length} 人报名，至少 4 人才能排双打`);
                return;
            }

            const scored = await MatchRoundModel.countScored(matchId);
            if (scored > 0 && !req.force) {
                ctx.body = R.error(412, '已有场次录入比分，重新生成会清空比分，请确认后重试');
                return;
            }

            // 轮数：优先用请求参数；否则由"计划场次 ÷ 计划场地数"推出。
            // 这里必须用计划人数算场地数，不能用实际报名人数——
            // 比如计划 8 人 14 场（2 片场 7 轮），实际只来了 6 人，
            // 用实际人数（1 片场）去除会得到 14 轮，明显不合理。
            const courts = Math.floor(players.length / 4);
            let roundCount = toInt(req.rounds);
            if (!roundCount) {
                const sessions = toInt(match.sessionCount);
                const plannedCount = toInt(match.playerCount) || players.length;
                const plannedCourts = Math.max(1, Math.floor(plannedCount / 4));
                roundCount = sessions ? Math.ceil(sessions / plannedCourts) : null;
            }

            const result = await MatchRoundModel.generate(
                matchId,
                players.map((p) => p.openId),
                roundCount || undefined
            );

            // 生成排期即视为开赛，把"报名中"推进到"进行中"
            if (Number(match.status) === 1) {
                await MatchModel.updateStatus(matchId, 2);
            }

            ctx.body = R.set(
                {
                    matchId,
                    courts: result.courts,
                    totalRounds: result.rounds,
                    totalMatches: result.matches,
                    quality: result.stats,
                },
                200,
                '排期已生成'
            );
        } catch (err) {
            const tip = err && err.message ? err.message : String(err);
            ctx.body = R.error(412, tip);
        }
    }

    /**
     * 查询排期 + 排名
     * body: { matchId }
     */
    static async list(ctx) {
        const req = ctx.request.body || {};
        const matchId = toInt(req.matchId);
        if (!matchId) {
            ctx.body = R.error(416, '缺少比赛 id');
            return;
        }
        const openId = currentOpenId(ctx);

        try {
            const matchRow = await MatchModel.detail(matchId);
            if (!matchRow) {
                ctx.body = R.error(412, '比赛不存在');
                return;
            }
            const match = matchRow.get({ plain: true });
            const { players, playerMap } = await loadPlayers(matchId);
            const roundRows = await MatchRoundModel.listByMatchId(matchId);

            const fallbackPlayer = (id) => {
                const key = str(id);
                return playerMap.get(key) || { openId: key, name: '球友', avatar: '', number: '' };
            };

            const roundsMap = new Map();
            let finished = 0;
            let courtCount = 0;

            roundRows.forEach((row) => {
                const p = row.get({ plain: true });
                const no = Number(p.roundNo);
                if (!roundsMap.has(no)) {
                    roundsMap.set(no, { no, label: `第${no}轮`, courts: [], resting: [] });
                }
                const group = roundsMap.get(no);
                if (Number(p.courtNo) > courtCount) courtCount = Number(p.courtNo);

                const quad = [p.team1P1, p.team1P2, p.team2P1, p.team2P2].map(str);
                const s1 = p.team1Score == null ? null : Number(p.team1Score);
                const s2 = p.team2Score == null ? null : Number(p.team2Score);
                const done = Number(p.status) === 1 && s1 != null && s2 != null;
                if (done) finished += 1;

                group.courts.push({
                    id: p.id,
                    courtNo: Number(p.courtNo),
                    team1: [fallbackPlayer(quad[0]), fallbackPlayer(quad[1])],
                    team2: [fallbackPlayer(quad[2]), fallbackPlayer(quad[3])],
                    score1: s1,
                    score2: s2,
                    status: Number(p.status) || 0,
                    done,
                    winner: done ? (s1 > s2 ? 'team1' : s2 > s1 ? 'team2' : null) : null,
                    canEdit: openId
                        ? str(match.createdBy) === openId || quad.indexOf(openId) !== -1
                        : false,
                });
            });

            const rounds = Array.from(roundsMap.values()).sort((a, b) => a.no - b.no);

            // 每轮轮空的人 = 全部参赛者 - 本轮上场的人，前端要显示出来
            rounds.forEach((group) => {
                const playing = new Set();
                group.courts.forEach((c) => {
                    c.team1.concat(c.team2).forEach((p) => playing.add(p.openId));
                });
                group.resting = players.filter((p) => !playing.has(p.openId));
            });

            const rankings = MatchRoundModel.computeRankings(
                roundRows,
                new Map(players.map((p) => [p.openId, p]))
            );

            ctx.body = R.set(
                {
                    matchId,
                    generated: rounds.length > 0,
                    courts: courtCount || Math.floor(players.length / 4),
                    totalRounds: rounds.length,
                    totalMatches: roundRows.length,
                    finishedMatches: finished,
                    canManage: str(match.createdBy) === openId,
                    status: Number(match.status),
                    targetScore: match.targetScore != null ? Number(match.targetScore) : null,
                    rounds,
                    players,
                    rankings,
                },
                200
            );
        } catch (err) {
            const tip = err && err.message ? err.message : String(err);
            ctx.body = R.error(412, tip);
        }
    }

    /**
     * 录入比分
     * body: { roundId, team1Score, team2Score }
     */
    static async submitScore(ctx) {
        const req = ctx.request.body || {};
        const roundId = toInt(req.roundId);
        const s1 = toInt(req.team1Score);
        const s2 = toInt(req.team2Score);
        const openId = currentOpenId(ctx);

        if (!roundId || s1 === null || s2 === null) {
            ctx.body = R.error(416, '缺少场次或比分');
            return;
        }
        if (s1 < 0 || s2 < 0 || s1 > 99 || s2 > 99) {
            ctx.body = R.error(412, '比分需在 0-99 之间');
            return;
        }
        if (s1 === s2) {
            ctx.body = R.error(412, '羽毛球没有平局，请核对比分');
            return;
        }

        try {
            const roundRow = await MatchRoundModel.detail(roundId);
            if (!roundRow) {
                ctx.body = R.error(412, '场次不存在');
                return;
            }
            const thisRound = roundRow.get({ plain: true });
            const matchRow = await MatchModel.detail(thisRound.matchId);
            if (!matchRow) {
                ctx.body = R.error(412, '比赛不存在');
                return;
            }
            const match = matchRow.get({ plain: true });

            const quad = [thisRound.team1P1, thisRound.team1P2, thisRound.team2P1, thisRound.team2P2].map(str);
            const allowed = str(match.createdBy) === openId || quad.indexOf(openId) !== -1;
            if (!allowed) {
                ctx.body = R.error(403, '只有组织者或本场参赛者可以录入比分');
                return;
            }

            const updated = await MatchRoundModel.updateScore(roundId, s1, s2);
            // 开赛后如果还是"报名中"，顺手推进状态
            if (Number(match.status) === 1) {
                await MatchModel.updateStatus(match.id, 2);
            }
            ctx.body = R.set(updated, 200, '比分已保存');
        } catch (err) {
            const tip = err && err.message ? err.message : String(err);
            ctx.body = R.error(412, tip);
        }
    }

    /** 撤销比分 body: { roundId } */
    static async clearScore(ctx) {
        const req = ctx.request.body || {};
        const roundId = toInt(req.roundId);
        const openId = currentOpenId(ctx);
        if (!roundId) {
            ctx.body = R.error(416, '缺少场次 id');
            return;
        }

        try {
            const roundRow = await MatchRoundModel.detail(roundId);
            if (!roundRow) {
                ctx.body = R.error(412, '场次不存在');
                return;
            }
            const thisRound = roundRow.get({ plain: true });
            const matchRow = await MatchModel.detail(thisRound.matchId);
            if (!matchRow) {
                ctx.body = R.error(412, '比赛不存在');
                return;
            }
            const match = matchRow.get({ plain: true });
            if (str(match.createdBy) !== openId) {
                ctx.body = R.error(403, '只有组织者可以撤销比分');
                return;
            }
            const updated = await MatchRoundModel.clearScore(roundId);
            ctx.body = R.set(updated, 200, '比分已撤销');
        } catch (err) {
            const tip = err && err.message ? err.message : String(err);
            ctx.body = R.error(412, tip);
        }
    }

    /** 清空整场排期 body: { matchId } */
    static async reset(ctx) {
        const req = ctx.request.body || {};
        const matchId = toInt(req.matchId);
        const openId = currentOpenId(ctx);
        if (!matchId) {
            ctx.body = R.error(416, '缺少比赛 id');
            return;
        }

        try {
            const matchRow = await MatchModel.detail(matchId);
            if (!matchRow) {
                ctx.body = R.error(412, '比赛不存在');
                return;
            }
            const match = matchRow.get({ plain: true });
            if (str(match.createdBy) !== openId) {
                ctx.body = R.error(403, '只有组织者可以清空排期');
                return;
            }
            const deleted = await MatchRoundModel.deleteByMatchId(matchId);
            ctx.body = R.set({ deleted }, 200, '排期已清空');
        } catch (err) {
            const tip = err && err.message ? err.message : String(err);
            ctx.body = R.error(412, tip);
        }
    }
}

module.exports = MatchRoundController;
