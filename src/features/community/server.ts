import { auth } from '@/auth';
import { dbConnect } from '@/server/db/mongodb';
import { isAdminEmail } from './admin-access';
export { isAdminEmail } from './admin-access';
export async function actor(admin = false) {
  const session = await auth();
  if (!session?.user?.playerId) throw new Error('401');
  await dbConnect();
  // auth() validates account existence, disabledAt and sessionVersion in its JWT callback.
  // Use those freshly validated fields instead of reading the same account again.
  if (admin && !isAdminEmail(session.user.email)) throw new Error('403');
  return session.user;
}
export function sameOrigin(req: Request) {
  try { return new URL(req.headers.get('origin') ?? '').host === req.headers.get('host'); } catch { return false; }
}
export function failure(error: unknown) {
  const code = error instanceof Error ? Number(error.message) : 0;
  return Response.json({ error: code === 401 ? 'Hãy đăng nhập.' : code === 403 ? 'Không có quyền thực hiện.' : 'Chưa xử lý được yêu cầu.' }, { status: [401,403,400,429].includes(code) ? code : 503 });
}
