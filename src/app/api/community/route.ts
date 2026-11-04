import { publishCommunity } from '@/features/community/realtime-server';
import { actor, failure, sameOrigin } from '@/features/community/server';
import { Friendship, ChatMessage, RoomInvite, PlayerBlock, PlayerReport, GameSetting } from '@/server/models/Community';
import { AccountUser } from '@/server/models/AccountUser';
import { takeLimit } from '@/features/account/server/rate-limit';
import { roomGame } from '@/features/community/room-path';
export const dynamic = 'force-dynamic';
const key = (a: string, b: string) => [a,b].sort().join(':');
const publicFields = 'playerId name username image';
export async function GET(req: Request) {
  try {
    const user = await actor(); const me = user.playerId;
    if (!await takeLimit('social-read', me, 360, 60000)) throw new Error('429');
    const url = new URL(req.url); const q = (url.searchParams.get('q') ?? '').trim().slice(0,60); const peer = url.searchParams.get('peer');
    const blocked = await PlayerBlock.find({ $or: [{ from: me }, { to: me }] }).lean();
    const excluded = blocked.map(b => b.from === me ? b.to : b.from);
    const edges = await Friendship.find({ $or: [{ from: me }, { to: me }] }).lean();
    const ids = edges.map(e => e.from === me ? e.to : e.from).filter(id => !excluded.includes(id));
    const users = await AccountUser.find({ playerId: { $in: ids }, disabledAt: null }).select(publicFields).lean();

    const search = q.length >= 2 ? await AccountUser.find({ disabledAt: null, playerId: { $nin: [me,...excluded] }, $or: [{ name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { username: { $regex: q.replace(/^@/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }] }).select(publicFields).limit(20).lean() : [];
    let messages: unknown[] = [];
    if (peer && !excluded.includes(peer) && edges.some(e => e.status === 'accepted' && (e.from === peer || e.to === peer))) {
      const before = url.searchParams.get('before');
      messages = await ChatMessage.find({ $or: [{ from: me, to: peer }, { from: peer, to: me }], ...(before && !isNaN(Date.parse(before)) ? { createdAt: { $lt: new Date(before) } } : {}) }).sort({ createdAt: -1, _id: -1 }).limit(50).lean();
      messages.reverse();
    }
    const invitations = await RoomInvite.find({ to: me, readAt: null, expiresAt: { $gt: new Date() }, from: { $in: edges.filter(e => e.status === 'accepted').map(e => e.from === me ? e.to : e.from).filter(id => !excluded.includes(id)) } }).lean();
    const unread = await ChatMessage.aggregate([{ $match: { to: me, readAt: null, from: { $nin: excluded } } }, { $group: { _id: '$from', count: { $sum: 1 } } }]);
    return Response.json({ me, users, edges, online: [], search, messages, invitations: invitations.map(i => ({ ...i, fromName: users.find(u => u.playerId === i.from)?.name ?? 'Bạn bè' })), unread, blocked: blocked.filter(b => b.from === me).map(b => b.to) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch(e) { return failure(e); }
}
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new Error('403');
    const user = await actor(); const me = user.playerId;
    const raw = await req.text(); if (raw.length > 4096) throw new Error('400');
    const body = JSON.parse(raw); const to = typeof body.to === 'string' ? body.to.slice(0,100) : '';
    if (!await takeLimit('social', me, 90, 60000)) throw new Error('429');

    if (!to || to === me || !await AccountUser.exists({ playerId: to, disabledAt: null })) throw new Error('400');
    const pair = key(me,to);
    if (body.action === 'block') {
      await PlayerBlock.updateOne({ from: me, to }, { from: me, to }, { upsert: true });
      await Friendship.deleteOne({ key: pair }); await publishCommunity([me,to], 'friends'); return Response.json({ ok: true });
    }
    if (body.action === 'unblock') { await PlayerBlock.deleteOne({ from: me, to }); await publishCommunity([me,to], 'friends'); return Response.json({ ok: true }); }
    if (await PlayerBlock.exists({ $or: [{ from: me, to }, { from: to, to: me }] })) throw new Error('403');
    if (body.action === 'report') { await PlayerReport.create({ from: me, to, reason: String(body.text ?? '').slice(0,500) }); return Response.json({ ok: true }); }
    if (body.action === 'request') await Friendship.updateOne({ key: pair }, { $setOnInsert: { key: pair, from: me, to, status: 'pending' } }, { upsert: true });
    else if (body.action === 'accept') await Friendship.updateOne({ key: pair, to: me, status: 'pending' }, { status: 'accepted' });
    else if (body.action === 'remove') await Friendship.deleteOne({ key: pair });
    else {
      if (!await Friendship.exists({ key: pair, status: 'accepted' })) throw new Error('403');
      if (body.action === 'message') {
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        if (!text || text.length > 1000 || !await takeLimit('chat',me,30,60000)) throw new Error('400');
        await ChatMessage.create({ from: me, to, text });
      } else if (body.action === 'read') { const updated=await ChatMessage.updateMany({ from: to, to: me, readAt: null }, { readAt: new Date() }); if(updated.modifiedCount)await publishCommunity([me,to]); return Response.json({ok:true}); }
      else if (body.action === 'invite') {
        const path = typeof body.path === 'string' ? body.path : '';
        const game = roomGame(path);
        if (!game || await GameSetting.exists({ gameId: game.id, enabled: false }) || !await takeLimit('invite',me,10,60000)) throw new Error('400');
        await RoomInvite.create({ from: me, to, path, expiresAt: new Date(Date.now()+120000) });
      } else if (body.action === 'dismiss') await RoomInvite.updateMany({ from: to, to: me, readAt: null }, { readAt: new Date() });
      else throw new Error('400');
    }
    const realtime = await publishCommunity([me,to], ['accept','remove'].includes(body.action) ? 'friends' : 'community');
    return Response.json({ ok: true, realtime });
  } catch(e) { return failure(e); }
}
