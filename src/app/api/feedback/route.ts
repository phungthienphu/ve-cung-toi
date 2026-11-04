import { publishCommunity } from '@/features/community/realtime-server';
import { actor, failure, sameOrigin } from '@/features/community/server';
import { SupportMessage } from '@/server/models/Community';
import { AccountUser } from '@/server/models/AccountUser';
import { takeLimit } from '@/features/account/server/rate-limit';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const url = new URL(req.url); const admin = url.searchParams.get('admin') === '1'; const user = await actor(admin);
    const owner = admin ? url.searchParams.get('owner') : user.playerId;
    if (!await takeLimit('support-read', user.playerId, 60, 60000)) throw new Error('429');
    if (admin && !owner) {
      const threads = await SupportMessage.aggregate([{ $sort: { createdAt: -1 } }, { $group: { _id: '$owner', guest: { $first: '$guest' }, guestName: { $first: '$guestName' }, text: { $first: '$text' }, createdAt: { $first: '$createdAt' }, unread: { $sum: { $cond: [{ $and: [{ $eq: ['$fromAdmin', false] }, { $eq: [{ $ifNull: ['$readAt', null] }, null] }] }, 1, 0] } } } }, { $sort: { createdAt: -1 } }, { $limit: 100 }]);
      const users = await AccountUser.find({ playerId: { $in: threads.map(t => t._id) } }).select('playerId name username').lean();
      return Response.json({ threads: threads.map(t => ({ ...t, name: t.guest ? t.guestName || 'Khách' : users.find(u => u.playerId === t._id)?.name || 'Người chơi' })) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (!owner || owner.length > 100) throw new Error('400');
    const before = url.searchParams.get('before');
    const messages = await SupportMessage.find({ owner, ...(before && !isNaN(Date.parse(before)) ? { createdAt: { $lt: new Date(before) } } : {}) }).sort({ createdAt: -1 }).limit(50).select('text fromAdmin createdAt').lean();
    return Response.json({ messages: messages.reverse() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch(e) { return failure(e); }
}
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new Error('403');
    const raw = await req.text(); if (raw.length > 4096) throw new Error('400'); const body = JSON.parse(raw);
    const admin = body.admin === true; const user = await actor(admin); const owner = admin ? body.owner : user.playerId;
    if (typeof owner !== 'string' || owner.length > 100) throw new Error('400');
    if (owner.startsWith('guest:') && body.action !== 'read') throw new Error('400');
    if (body.action === 'read') { const updated=await SupportMessage.updateMany({ owner, fromAdmin: !admin, readAt: null }, { readAt: new Date() }); if(updated.modifiedCount)await publishCommunity([owner], 'support', true); return Response.json({ ok: true }); }
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 1000) throw new Error('400');
    if (!await takeLimit('support-send', user.playerId, 10, 60000)) throw new Error('429');
    // Admin can only reply to conversations initiated by a player.
    if (admin && !await SupportMessage.exists({ owner, fromAdmin: false })) throw new Error('403');
    await SupportMessage.create({ owner, fromAdmin: admin, text });
    const realtime=await publishCommunity([owner], 'support', true);
    return Response.json({ ok: true, realtime });
  } catch(e) { return failure(e); }
}
