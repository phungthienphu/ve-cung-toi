import { Types, type PipelineStage } from 'mongoose';
import { actor, failure } from './server';
import { Friendship, ChatMessage, PlayerBlock, RoomInvite } from '@/server/models/Community';
import { AccountUser } from '@/server/models/AccountUser';
import { takeLimit } from '@/features/account/server/rate-limit';
import { playerSearchPattern } from './player-search';

const publicFields = 'playerId name username image -_id';
export type ReadKind = 'contacts' | 'conversations' | 'messages' | 'notifications';
const json = (data: unknown) => Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
export function communityRead(kind: ReadKind) {
  return async (req: Request) => {
    const started = performance.now();
    try {
      const { playerId: me } = await actor();
      if (!await takeLimit(`community-${kind}`, me, 360, 60000)) throw new Error('429');
      const params = new URL(req.url).searchParams;
      const peer = params.get('peer') ?? '';
      if (kind === 'messages') {
        if (!peer || peer.length > 100 || peer === me) throw new Error('400');
        const [friend, blocked, recipient] = await Promise.all([
          Friendship.exists({ key: [me, peer].sort().join(':'), status: 'accepted' }),
          PlayerBlock.exists({ $or: [{ from: me, to: peer }, { from: peer, to: me }] }),
          AccountUser.findOne({ playerId: peer, disabledAt: null }).select(publicFields).lean(),
        ]);
        if (!friend || blocked || !recipient) throw new Error('403');
        const cursor = params.get('cursor');
        let before: { at: string; id: string } | undefined;
        if (cursor) {
          try { before = JSON.parse(Buffer.from(cursor, 'base64url').toString()); } catch { throw new Error('400'); }
          if (!before || !Number.isFinite(Date.parse(before.at)) || !Types.ObjectId.isValid(before.id)) throw new Error('400');
        }
        const rows = await ChatMessage.find({
          $and: [
            { $or: [{ from: me, to: peer }, { from: peer, to: me }] },
            ...(before ? [{ $or: [{ createdAt: { $lt: new Date(before.at) } }, { createdAt: new Date(before.at), _id: { $lt: new Types.ObjectId(before.id) } }] }] : []),
          ],
        }).select('_id from to text createdAt').sort({ createdAt: -1, _id: -1 }).limit(51).lean();
        const page = rows.slice(0, 50);
        const last = page.at(-1);
        return timed(json({ me, peer: recipient, messages: page.reverse(), nextCursor: rows.length > 50 && last ? Buffer.from(JSON.stringify({ at: last.createdAt.toISOString(), id: String(last._id) })).toString('base64url') : null }), started);
      }
      const blocks = await PlayerBlock.find({ $or: [{ from: me }, { to: me }] }).select('from to').lean();
      const excluded = blocks.map(b => b.from === me ? b.to : b.from);
      if (kind === 'contacts') {
        const tab = params.get('tab') ?? 'friends';
        const q = (params.get('q') ?? '').trim().slice(0, 60);
        if (!['friends', 'requests', 'blocked', 'search', 'relation'].includes(tab)) throw new Error('400');
        if (tab === 'blocked') return timed(json({ me, blocked: blocks.filter(b => b.from === me).map(b => b.to), users: [], edges: [] }), started);
        if (tab === 'relation') {
          if (!peer || peer.length > 100) throw new Error('400');
          const edge = excluded.includes(peer) ? null : await Friendship.findOne({ key: [me, peer].sort().join(':') }).select('from to status -_id').lean();
          return timed(json({ me, edges: edge ? [edge] : [] }), started);
        }
        const edges = await Friendship.find({ $or: [{ from: me }, { to: me }], ...(tab === 'search' ? {} : { status: tab === 'requests' ? 'pending' : 'accepted' }) }).select('from to status -_id').lean();
        const ids = edges.map(e => e.from === me ? e.to : e.from).filter(id => !excluded.includes(id));
        const pattern = playerSearchPattern(q);
        const users = tab === 'search'
          ? q.length >= 2 ? await AccountUser.find({ disabledAt: null, playerId: { $nin: [me, ...excluded] }, $or: [{ name: { $regex: pattern, $options: 'i' } }, { username: { $regex: pattern, $options: 'i' } }] }).select(publicFields).limit(20).lean() : []
          : await AccountUser.find({ playerId: { $in: ids }, disabledAt: null }).select(publicFields).lean();
        return timed(json({ me, users: tab === 'search' ? [] : users, search: tab === 'search' ? users : [], edges: edges.filter(e => !excluded.includes(e.from === me ? e.to : e.from)), blocked: [] }), started);
      }
      const edges = await Friendship.find({ $or: [{ from: me }, { to: me }], status: kind === 'conversations' ? 'accepted' : { $in: ['pending', 'accepted'] } }).select('from to status').lean();
      const ids = edges.map(e => e.from === me ? e.to : e.from).filter(id => !excluded.includes(id));
      if (kind === 'conversations') {
        // Two bounded index seeks per friend; never scan/group their full history.
        const latestLookup = (outgoing: boolean): PipelineStage.Lookup => ({ $lookup: {
          from: ChatMessage.collection.name, let: { peer: '$playerId' }, as: outgoing ? 'sent' : 'received',
          pipeline: [
            { $match: { [outgoing ? 'from' : 'to']: me, $expr: { $eq: [outgoing ? '$to' : '$from', '$$peer'] } } },
            { $sort: { createdAt: -1, _id: -1 } }, { $limit: 1 }, { $project: { text: 1, createdAt: 1 } },
          ],
        } });
        type LastMessage = { _id: Types.ObjectId; text: string; createdAt: Date };
        const [rows, counts] = await Promise.all([
          AccountUser.aggregate<{playerId:string;name:string;username?:string;image?:string;sent:LastMessage[];received:LastMessage[]}>([
            { $match: { playerId: { $in: ids }, disabledAt: null } },
            { $project: { _id: 0, playerId: 1, name: 1, username: 1, image: 1 } },
            latestLookup(true), latestLookup(false),
          ]),
          ChatMessage.aggregate([{ $match: { to: me, from: { $in: ids }, readAt: null } }, { $group: { _id: '$from', count: { $sum: 1 } } }]),
        ]);
        const visible = new Set(rows.map(row => row.playerId));
        const unread = counts.filter(row => visible.has(row._id));
        const conversations = rows.map(({sent,received,...user}) => ({ ...user,
          lastMessage: [...sent,...received].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime() || String(b._id).localeCompare(String(a._id)))[0] ?? null,
          unread: unread.find(row => row._id === user.playerId)?.count ?? 0,
        })).sort((a,b)=>(b.lastMessage?.createdAt.getTime()??0)-(a.lastMessage?.createdAt.getTime()??0));
        return timed(json({ me, conversations, users:conversations, edges:edges.filter(e=>visible.has(e.from===me?e.to:e.from)), unread }), started);
      }
      const users = await AccountUser.find({ playerId: { $in: ids }, disabledAt: null }).select(publicFields).lean();
      const accepted = users.filter(u => edges.some(e => e.status === 'accepted' && (e.from === u.playerId || e.to === u.playerId))).map(u => u.playerId);
      const unreadPromise = ChatMessage.aggregate([{ $match: { to: me, from: { $in: accepted }, readAt: null } }, { $group: { _id: '$from', count: { $sum: 1 } } }]);
      if (kind === 'notifications') {
        const [unread, invitations] = await Promise.all([
          unreadPromise,
          RoomInvite.find({ to: me, from: { $in: accepted }, readAt: null, expiresAt: { $gt: new Date() } }).select('_id from path').sort({ createdAt: -1 }).limit(10).lean(),
        ]);
        return timed(json({ unread, friendCount: accepted.length, friendRequests: edges.filter(e => e.to === me && e.status === 'pending' && users.some(u => u.playerId === e.from)).length, invitations: invitations.map(i => ({ ...i, fromName: users.find(u => u.playerId === i.from)?.name ?? 'Bạn bè' })) }), started);
      }
      throw new Error('400');
    } catch (error) { return timed(failure(error), started); }
  };
}
function timed(response: Response, start: number) {
  response.headers.set('Server-Timing', `community;dur=${(performance.now() - start).toFixed(1)}`);
  return response;
}
