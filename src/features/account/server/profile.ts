import { dbConnect } from '@/server/db/mongodb';
import GameHistory from '@/server/models/GameHistory';
import { HillRun, HillWallet } from '@/server/models/Hill';

export const PROFILE_GAMES = [
  { id: 'tank', name: 'Đại chiến xe tăng', href: '/tank-game' },
  { id: 'draw', name: 'Vẽ cùng tôi', href: '/draw-guess' },
  { id: 'soccer', name: 'Bóng đá', href: '/soccer' },
  { id: 'werewolf', name: 'Ma sói', href: '/werewolf' },
  { id: 'battleship', name: 'Hải chiến', href: '/battleship' },
  { id: 'oldmaid', name: 'Ai là heo', href: '/ai-la-heo' },
] as const;

/** Private view: never match names or expose another account's email/identity. */
export async function getAccountProfile(playerId: string) {
  await dbConnect();
  // The merge marker also links previous guest matches without rewriting history.
  const guests = await HillWallet.find({ mergedTo: playerId }).select('playerId').lean();
  const ids = [playerId, ...guests.map(guest => guest.playerId)];
  const [matches, hill, wallet] = await Promise.all([
    GameHistory.aggregate<{ _id: string; played: number; wins: number; score: number; lastPlayed: Date }>([
      { $match: { verifiedReport: true, 'players.playerId': { $in: ids } } },
      { $unwind: '$players' },
      { $match: { 'players.playerId': { $in: ids }, 'players.isBot': { $ne: true } } },
      // A guest and account can have played in the same room; count that match once.
      { $group: { _id: { match: '$_id', game: '$gameType' }, won: { $max: '$players.won' }, score: { $max: '$players.score' }, playedAt: { $max: '$playedAt' } } },
      { $group: { _id: '$_id.game', played: { $sum: 1 }, wins: { $sum: { $cond: ['$won', 1, 0] } }, score: { $sum: '$score' }, lastPlayed: { $max: '$playedAt' } } },
    ]),
    HillRun.aggregate<{ _id: null; played: number; best: number; lastPlayed: Date }>([
      { $match: { playerId } },
      { $group: { _id: null, played: { $sum: 1 }, best: { $max: '$distance' }, lastPlayed: { $max: '$createdAt' } } },
    ]),
    HillWallet.findOne({ playerId }).select('coins unlocked').lean(),
  ]);
  return { games: PROFILE_GAMES.map(game => ({ ...game, stats: matches.find(row => row._id === game.id) ?? null })), hill: hill[0] ?? null, coins: wallet?.coins ?? 0, vehicles: wallet?.unlocked.length ?? 1 };
}
