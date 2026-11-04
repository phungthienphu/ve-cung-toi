import { auth, googleLoginEnabled } from '@/auth';
import { AccountUser } from '@/server/models/AccountUser';
import { HillWallet } from '@/server/models/Hill';

export class PlayerAccessError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
/** Caller connects Mongo first. Guest IDs retain the existing bearer-code rules. */
export async function requirePlayerAccess(playerId: string) {
  const [owner, wallet] = await Promise.all([
    AccountUser.findOne({ playerId }).select('playerId').lean(),
    HillWallet.findOne({ playerId }).select('mergedTo').lean(),
  ]);
  if (wallet?.mergedTo) throw new PlayerAccessError('Tiến độ mã khách này đã chuyển vào tài khoản. Hãy tải lại trang.', 409);
  if (owner) {
    if (!googleLoginEnabled) throw new PlayerAccessError('Đăng nhập hiện chưa được cấu hình.', 403);
    const session = await auth();
    if (session?.user?.playerId !== playerId) throw new PlayerAccessError('Bạn cần đăng nhập đúng tài khoản để dùng tiến độ này.', 403);
  }
}
