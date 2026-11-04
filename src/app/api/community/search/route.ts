import { dbConnect } from '@/server/db/mongodb';
import { AccountUser } from '@/server/models/AccountUser';
import { requestIp, takeLimit } from '@/features/account/server/rate-limit';
import { failure } from '@/features/community/server';

export const dynamic = 'force-dynamic';
/** Guest discovery exposes public display fields only, never account email or history. */
export async function GET(req: Request) {
  try {
    const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 60);
    let search: unknown[] = [];
    if (q.length >= 2) {
      await dbConnect();
      if (!await takeLimit('public-player-search', requestIp(req.headers), 90, 60000)) throw new Error('429');
      const escaped = q.replace(/^@/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      search = await AccountUser.find({ disabledAt: null, $or: [
        { name: { $regex: escaped, $options: 'i' } }, { username: { $regex: escaped, $options: 'i' } },
      ] }).select('playerId name username -_id').limit(20).lean();
    }
    return Response.json({ me: '', users: [], edges: [], blocked: [], online: [], messages: [], unread: [], search }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
