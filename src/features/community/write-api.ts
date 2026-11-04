import { publishCommunity } from '@/features/community/realtime-server';
import { actor, failure, sameOrigin } from '@/features/community/server';
import { Friendship, ChatMessage, RoomInvite, PlayerBlock, PlayerReport, GameSetting } from '@/server/models/Community';
import { AccountUser } from '@/server/models/AccountUser';
import { takeLimit } from '@/features/account/server/rate-limit';
import { roomGame } from '@/features/community/room-path';
const key = (a: string, b: string) => [a,b].sort().join(':');
export async function communityWrite(req: Request, allowed?: readonly string[]) {
  try {
    if (!sameOrigin(req)) throw new Error('403');
    const user = await actor(); const me = user.playerId;
    const raw = await req.text(); if (raw.length > 4096) throw new Error('400');
    const body = JSON.parse(raw); const to = typeof body.to === 'string' ? body.to.slice(0,100) : '';
    if (allowed && !allowed.includes(body.action)) throw new Error('400');
    if (!await takeLimit('social', me, 90, 60000)) throw new Error('429');

    if (!to || to === me || !await AccountUser.exists({ playerId: to, disabledAt: null })) throw new Error('400');
    const pair = key(me,to);
    if (body.action === 'block') {
      await PlayerBlock.updateOne({ from: me, to }, { from: me, to }, { upsert: true });
      await Friendship.deleteOne({ key: pair }); await publishCommunity([me,to], 'friends', false, { kind: 'friends', actor: me, peer: to }); return Response.json({ ok: true, me });
    }
    if (body.action === 'unblock') { await PlayerBlock.deleteOne({ from: me, to }); await publishCommunity([me,to], 'friends', false, { kind: 'friends', actor: me, peer: to }); return Response.json({ ok: true, me }); }
    if (await PlayerBlock.exists({ $or: [{ from: me, to }, { from: to, to: me }] })) throw new Error('403');
    if (body.action === 'report') { await PlayerReport.create({ from: me, to, reason: String(body.text ?? '').slice(0,500) }); return Response.json({ ok: true, me }); }
    let message;
    if (body.action === 'request') await Friendship.updateOne({ key: pair }, { $setOnInsert: { key: pair, from: me, to, status: 'pending' } }, { upsert: true });
    else if (body.action === 'accept') await Friendship.updateOne({ key: pair, to: me, status: 'pending' }, { status: 'accepted' });
    else if (body.action === 'remove') await Friendship.deleteOne({ key: pair });
    else {
      if (!await Friendship.exists({ key: pair, status: 'accepted' })) throw new Error('403');
      if (body.action === 'message') {
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        if (!text || text.length > 1000 || !await takeLimit('chat',me,30,60000)) throw new Error('400');
        message = await ChatMessage.create({ from: me, to, text });
      } else if (body.action === 'read') { const updated=await ChatMessage.updateMany({ from: to, to: me, readAt: null }, { readAt: new Date() }); if(updated.modifiedCount)await publishCommunity([me], 'community', false, {kind:'read',actor:me,peer:to}); return Response.json({ok:true, me}); }
      else if (body.action === 'invite') {
        const path = typeof body.path === 'string' ? body.path : '';
        const game = roomGame(path);
        if (!game || await GameSetting.exists({ gameId: game.id, enabled: false }) || !await takeLimit('invite',me,10,60000)) throw new Error('400');
        await RoomInvite.create({ from: me, to, path, expiresAt: new Date(Date.now()+120000) });
      } else if (body.action === 'dismiss') await RoomInvite.updateMany({ from: to, to: me, readAt: null }, { readAt: new Date() });
      else throw new Error('400');
    }
    const realtime = await publishCommunity([me,to], ['accept','remove'].includes(body.action) ? 'friends' : 'community', false, { kind: body.action === 'message' ? 'message' : ['invite','dismiss'].includes(body.action) ? 'invite' : 'friends', actor: me, peer: to });
    return Response.json({ ok: true, realtime, message, me });
  } catch(e) { return failure(e); }
}

export const legacyCommunityWrite = (req: Request) => communityWrite(req);
