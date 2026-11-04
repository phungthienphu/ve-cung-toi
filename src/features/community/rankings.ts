import { unstable_cache } from 'next/cache';
import type { PipelineStage } from 'mongoose';
import { dbConnect } from '@/server/db/mongodb';
import GameHistory from '@/server/models/GameHistory';
import { AccountUser } from '@/server/models/AccountUser';
import { HillRun, HillWallet } from '@/server/models/Hill';
import { RANKING_GAMES, type RankedPlayer, type RankingPage } from './ranking-config';
export type { RankingPage } from './ranking-config';

export async function loadRankingPage(gameId: string, offset = 0, limit = 20): Promise<RankingPage> {
  const game = RANKING_GAMES.find(game => game.id === gameId);
  if (!game) throw new Error('Unknown ranking game');
  await dbConnect();
  const identity: PipelineStage[] = [
    { $lookup: { from: HillWallet.collection.name, localField: 'sourcePlayerId', foreignField: 'playerId', as: 'wallet' } },
    { $set: { accountId: { $ifNull: [{ $arrayElemAt: ['$wallet.mergedTo', 0] }, '$sourcePlayerId'] } } },
  ];
  const source: PipelineStage[] = game.kind === 'distance' ? [
    { $match: { distance: { $gt: 0 } } },
    { $project: { sourcePlayerId: '$playerId', value: '$distance', updatedAt: '$createdAt' } },
    ...identity,
    { $group: { _id: '$accountId', score: { $max: '$value' }, updatedAt: { $max: '$updatedAt' } } },
  ] : [
    { $match: { verifiedReport: true, gameType: game.id } },
    { $unwind: '$players' },
    { $match: { 'players.isBot': { $ne: true }, 'players.playerId': { $type: 'string' }, ...(game.kind === 'wins' ? { 'players.won': true } : {}) } },
    { $project: { sourcePlayerId: '$players.playerId', updatedAt: '$playedAt', value: game.kind === 'wins' ? { $literal: 1 } : '$players.score' } },
    ...identity,
    // A merged guest and account in the same match contribute only once.
    { $group: { _id: { match: '$_id', account: '$accountId' }, value: { $max: '$value' }, updatedAt: { $max: '$updatedAt' } } },
    { $group: { _id: '$_id.account', score: { $sum: '$value' }, updatedAt: { $max: '$updatedAt' } } },
  ];
  const pipeline: PipelineStage[] = [...source,
    { $match: { score: { $gt: 0 } } },
    { $lookup: { from: AccountUser.collection.name, localField: '_id', foreignField: 'playerId', as: 'account' } },
    { $unwind: '$account' },
    { $match: { 'account.disabledAt': null } },
    { $facet: {
      rows: [
        { $sort: { score: -1, _id: 1 } },
        { $skip: offset }, { $limit: limit + 1 },
        { $project: { _id: 0, playerId: '$_id', name: '$account.name', username: '$account.username', score: 1 } },
      ],
      latest: [{ $group: { _id: null, updatedAt: { $max: '$updatedAt' } } }],
    } },
  ];
  type Result = { rows: RankedPlayer[]; latest: { updatedAt: Date | null }[] };
  const [result] = game.kind === 'distance' ? await HillRun.aggregate<Result>(pipeline) : await GameHistory.aggregate<Result>(pipeline);
  const rows = result?.rows ?? [];
  return { items: rows.slice(0, limit), nextOffset: rows.length > limit ? offset + limit : null, updatedAt: result?.latest[0]?.updatedAt?.toISOString() ?? null };
}

export const rankingPage = unstable_cache(loadRankingPage, ['public-game-rankings-v2'], { revalidate: 30, tags: ['public-rankings'] });
