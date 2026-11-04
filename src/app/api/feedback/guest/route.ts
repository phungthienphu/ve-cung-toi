import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { dbConnect } from '@/server/db/mongodb';
import { SupportMessage } from '@/server/models/Community';
import { requestIp, takeLimit } from '@/features/account/server/rate-limit';
import { failure, sameOrigin } from '@/features/community/server';
import { publishCommunity } from '@/features/community/realtime-server';

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new Error('403');
    if ((await auth())?.user) throw new Error('400');
    const raw = await req.text();
    if (raw.length > 4096) throw new Error('400');
    const body = JSON.parse(raw);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!name || name.length > 60 || !text || text.length > 1000) throw new Error('400');
    await dbConnect();
    if (!await takeLimit('guest-feedback', requestIp(req.headers), 5, 600000)) throw new Error('429');
    await SupportMessage.create({ owner: `guest:${randomUUID()}`, guest: true, guestName: name, text, fromAdmin: false });
    await publishCommunity([], 'support', true);
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
