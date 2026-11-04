import { withTransactionRetry } from '@/server/db/transaction';
import { AccountUser } from '@/server/models/AccountUser';
import { HillRun, HillWallet } from '@/server/models/Hill';
import { PlayerAccessError } from './access';

/** One source transfers once, even across tabs/accounts/retries. Requires a replica set. */
export async function mergeGuestProgress(guestId: string, accountId: string) {
  if (guestId === accountId) return;
  await withTransactionRetry(async session => {
    if (await AccountUser.exists({ playerId: guestId }).session(session)) throw new PlayerAccessError('Không thể gộp mã của tài khoản khác.', 403);
    if (!await AccountUser.exists({ playerId: accountId }).session(session)) throw new PlayerAccessError('Không tìm thấy tài khoản.', 403);
    const source = await HillWallet.findOneAndUpdate({ playerId: guestId }, { $setOnInsert: { playerId: guestId } }, { upsert: true, new: true, session }).select('+creditedRuns').orFail();
    if (source.mergedTo) {
      if (source.mergedTo !== accountId) throw new PlayerAccessError('Mã khách đã được gộp vào tài khoản khác.', 409);
      return;
    }
    await HillWallet.findOneAndUpdate({ playerId: accountId }, {
      $setOnInsert: { playerId: accountId },
      $inc: { coins: source.coins },
      $addToSet: { unlocked: { $each: source.unlocked }, creditedRuns: { $each: source.creditedRuns } },
    }, { upsert: true, session, setDefaultsOnInsert: false });
    // Keeping original runs preserves each map/day's maximum and global run-ID dedup.
    await HillRun.updateMany({ playerId: guestId }, { $set: { playerId: accountId } }, { session });
    source.coins = 0;
    source.mergedTo = accountId;
    await source.save({ session });
  });
}
