/** Only uses an isolated database; cleans up its own randomized fixtures. */
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
config({ path: '.env.local', quiet: true });
process.env.MONGODB_DB_NAME = 'vct_account_review_20261104';

async function main() {
  const { dbConnect } = await import('../src/server/db/mongodb');
  const { default: History } = await import('../src/server/models/GameHistory');
  const { HillWallet } = await import('../src/server/models/Hill');
  const { getAccountProfile } = await import('../src/features/account/server/profile');
  const { POST } = await import('../src/app/api/game-history/route');
  await dbConnect();
  const account = randomUUID(), guest = randomUUID(), other = randomUUID(), roomId = randomUUID();
  process.env.GAME_HISTORY_SECRET = randomUUID();
  try {
    await HillWallet.create([{ playerId: guest, mergedTo: account }, { playerId: account, coins: 42, unlocked: ['jeep', 'bus'] }]);
    const report = async (secret: string, players: unknown[]) => {
      const response = await POST(new Request('http://localhost/api/game-history', { method: 'POST', headers: { 'content-type': 'application/json', 'x-game-history-secret': secret }, body: JSON.stringify({ gameType: 'tank', roomId, playedAt: new Date().toISOString(), players }) }));
      assert.equal((await response.json()).ok, true);
    };
    await report(process.env.GAME_HISTORY_SECRET, [{ playerId: account, name: 'Same', score: 4, won: true }, { playerId: guest, name: 'Guest', score: 2, won: false }]);
    await report(process.env.GAME_HISTORY_SECRET, [{ playerId: guest, name: 'Guest', score: 1, won: false }]);
    await report('', [{ playerId: account, name: 'Fake', score: 1000, won: true }]);
    await report(process.env.GAME_HISTORY_SECRET, [{ playerId: other, name: 'Same', score: 99, won: true }]);
    await report(process.env.GAME_HISTORY_SECRET, [{ playerId: account, name: 'Bot', score: 100, won: true, isBot: true }]);
    const profile = await getAccountProfile(account);
    const tank = profile.games.find(game => game.id === 'tank')!.stats!;
    assert.equal(tank.played, 2);
    assert.equal(tank.wins, 1);
    assert.equal(tank.score, 5);
    assert.equal(profile.coins, 42);
    assert.equal(profile.vehicles, 2);
    const stranger = await getAccountProfile(randomUUID());
    assert.ok(stranger.games.every(game => !game.stats));
    const publicHistory = await History.find({ roomId }).lean();
    assert.ok(publicHistory.every(match => match.players.every((player: { playerId?: string }) => !player.playerId)), 'public queries omit player codes');
    console.log('Profile integration passed: signed reporting, forged report exclusion, guest linkage, same-name isolation, bots, per-match dedup and private player codes.');
  } finally {
    await History.deleteMany({ roomId });
    await HillWallet.deleteMany({ playerId: { $in: [account, guest] } });
    await mongoose.disconnect();
  }
}
main().catch(error => { console.error('Profile integration failed', { name: error?.name, code: error?.code, actual: error?.actual, expected: error?.expected }); process.exitCode = 1; });
