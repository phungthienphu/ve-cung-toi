/** Isolated Mongo replica-set integration. Never points models at the app DB. */
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
config({ path:'.env.local', quiet:true });
process.env.MONGODB_DB_NAME = 'vct_account_review_20261104';

async function main() {
  const { AccountUser } = await import('../src/server/models/AccountUser');
  const { HillWallet, HillRun } = await import('../src/server/models/Hill');
  const { mergeGuestProgress } = await import('../src/features/account/server/merge');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for the isolated test database');
  await mongoose.connect(process.env.MONGODB_URI, { dbName:process.env.MONGODB_DB_NAME });
  const ids = Array.from({ length:5 }, () => randomBytes(5).toString('hex'));
  const [account, other, guestA, guestB, guestC] = ids;
  const runId = randomUUID();
  try {
    await Promise.all([AccountUser.init(), HillWallet.init(), HillRun.init()]);
    await AccountUser.create([{ googleSubject:randomUUID(), playerId:account, email:'review@example.invalid' }, { googleSubject:randomUUID(), playerId:other, email:'other@example.invalid' }]);
    await HillWallet.create([
      { playerId:guestA, coins:150, unlocked:['jeep','beetle'], creditedRuns:[runId] },
      { playerId:guestB, coins:70, unlocked:['jeep','monster','bus'] },
      { playerId:guestC, coins:25, unlocked:['jeep'] },
    ]);
    await HillRun.create([
      { runId, playerId:guestA, name:'Guest A', map:'tea', vehicle:'jeep', seed:20261102, day:null, distance:300, coins:150, duration:30 },
      { runId:randomUUID(), playerId:guestB, name:'Guest B', map:'tea', vehicle:'jeep', seed:20261102, day:null, distance:500, coins:70, duration:40 },
    ]);
    // Both devices create the destination wallet concurrently on first login.
    await Promise.all([mergeGuestProgress(guestA, account), mergeGuestProgress(guestB, account)]);
    await mergeGuestProgress(guestA, account);
    const wallet = await HillWallet.findOne({ playerId:account }).select('+creditedRuns').orFail().lean();
    assert.equal(wallet.coins,220);
    assert.deepEqual(new Set(wallet.unlocked),new Set(['jeep','bus','beetle','monster']));
    assert.ok(wallet.creditedRuns.includes(runId));
    const best = await HillRun.findOne({ playerId:account }).sort({ distance:-1 }).orFail().lean();
    assert.equal(best.distance,500);
    assert.equal(await HillRun.countDocuments({ playerId:{ $in:[guestA,guestB] } }),0);
    assert.equal((await HillWallet.findOne({ playerId:guestA }).orFail()).coins,0);
    await assert.rejects(mergeGuestProgress(guestA, other), /tài khoản khác/);
    await assert.rejects(mergeGuestProgress(other, account), /tài khoản khác/);
    const competing = await Promise.allSettled([mergeGuestProgress(guestC,account), mergeGuestProgress(guestC,other)]);
    assert.equal(competing.filter(r => r.status === 'fulfilled').length,1,'a guest can transfer to only one account');
    const total = (await HillWallet.find({ playerId:{ $in:[account,other] } }).lean()).reduce((n,w) => n+w.coins,0);
    assert.equal(total,245,'competing claims never duplicate or lose coins');
    const moved = await HillWallet.updateOne({ playerId:guestA, mergedTo:null },{ $inc:{ coins:100 } });
    assert.equal(moved.matchedCount,0,'retired guest cannot receive a second credit');
    console.log('Account merge integration passed: two devices, retries, coin conservation, vehicles, best record, run dedup and competing owners.');
  } finally {
    await HillRun.deleteMany({ playerId:{ $in:ids } });
    await HillWallet.deleteMany({ playerId:{ $in:ids } });
    await AccountUser.deleteMany({ playerId:{ $in:ids } });
    await mongoose.disconnect();
  }
}
main().catch((error) => { console.error('Account merge integration failed:', { name:error?.name, code:error?.code, actual:error?.actual, expected:error?.expected, location:error?.stack?.split('\n').find((line:string) => line.includes('/src/') || line.includes('/scripts/')) }); process.exitCode=1; });
