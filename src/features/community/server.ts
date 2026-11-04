import { auth } from '@/auth';
import { dbConnect } from '@/server/db/mongodb';
import { AccountUser } from '@/server/models/AccountUser';
import { isAdminEmail } from './admin-access';
export { isAdminEmail } from './admin-access';
export async function actor(admin = false) {
  const session = await auth();
  if (!session?.user?.playerId) throw new Error('401');
  await dbConnect();
  const user = await AccountUser.findOne({ playerId: session.user.playerId }).lean();
  if (!user || user.disabledAt || (admin && !isAdminEmail(user.email))) throw new Error('403');
  return user;
}
export function sameOrigin(req: Request) {
  try { return new URL(req.headers.get('origin') ?? '').host === req.headers.get('host'); } catch { return false; }
}
export function failure(error: unknown) {
  const code = error instanceof Error ? Number(error.message) : 0;
  return Response.json({ error: code === 401 ? 'Hãy đăng nhập.' : code === 403 ? 'Không có quyền thực hiện.' : 'Chưa xử lý được yêu cầu.' }, { status: [401,403,400,429].includes(code) ? code : 503 });
}
