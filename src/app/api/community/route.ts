import { playerSearchPattern } from '@/features/community/player-search';
import { actor, failure } from '@/features/community/server';
import { Friendship, ChatMessage, RoomInvite, PlayerBlock } from '@/server/models/Community';
import { AccountUser } from '@/server/models/AccountUser';
import { takeLimit } from '@/features/account/server/rate-limit';
export const dynamic = 'force-dynamic';
const publicFields = 'playerId name username image';
export async function GET(req: Request) {
  try {
    const user = await actor(); const me = user.playerId;
    if (!await takeLimit('social-read', me, 360, 60000)) throw new Error('429');
    const url = new URL(req.url); const q = (url.searchParams.get('q') ?? '').trim().slice(0,60); const peer = url.searchParams.get('peer');
    const [blocked, edges] = await Promise.all([
      PlayerBlock.find({ $or: [{ from: me }, { to: me }] }).lean(),
      Friendship.find({ $or: [{ from: me }, { to: me }] }).lean(),
    ]);
    const excluded = blocked.map(b => b.from === me ? b.to : b.from);
    const ids = edges.map(e => e.from === me ? e.to : e.from).filter(id => !excluded.includes(id));
    const usersPromise = AccountUser.find({ playerId: { $in: ids }, disabledAt: null }).select(publicFields).lean();

    const pattern = playerSearchPattern(q);
    const searchPromise = q.length >= 2 ? await AccountUser.find({ disabledAt: null, playerId: { $nin: [me,...excluded] }, $or: [{ name: { $regex: pattern, $options: 'i' } }, { username: { $regex: pattern, $options: 'i' } }] }).select(publicFields).limit(20).lean() : [];
    const canChat = peer && !excluded.includes(peer) && edges.some(e => e.status === 'accepted' && (e.from === peer || e.to === peer));
    const before = url.searchParams.get('before');
    const [users, search, messageRows, invitations, unread] = await Promise.all([
      usersPromise, searchPromise,
      canChat ? ChatMessage.find({ $or: [{ from: me, to: peer }, { from: peer, to: me }], ...(before && !isNaN(Date.parse(before)) ? { createdAt: { $lt: new Date(before) } } : {}) }).sort({ createdAt: -1, _id: -1 }).limit(50).lean() : [],
      RoomInvite.find({ to: me, readAt: null, expiresAt: { $gt: new Date() }, from: { $in: edges.filter(e => e.status === 'accepted').map(e => e.from === me ? e.to : e.from).filter(id => !excluded.includes(id)) } }).lean(),
      ChatMessage.aggregate([{ $match: { to: me, readAt: null, from: { $nin: excluded } } }, { $group: { _id: '$from', count: { $sum: 1 } } }]),
    ]);
    const messages = messageRows.reverse();
    const friendRequests = edges.filter(e => e.status === 'pending' && e.to === me && users.some(u => u.playerId === e.from)).length;
    return Response.json({ friendRequests, me, users, edges, online: [], search, messages, invitations: invitations.map(i => ({ ...i, fromName: users.find(u => u.playerId === i.from)?.name ?? 'Bạn bè' })), unread, blocked: blocked.filter(b => b.from === me).map(b => b.to) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch(e) { return failure(e); }
}
export { legacyCommunityWrite as POST } from '@/features/community/write-api';
