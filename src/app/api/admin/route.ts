import { revalidateTag } from 'next/cache';
import { publishCommunity } from '@/features/community/realtime-server';
import { actor, failure, isAdminEmail, sameOrigin } from '@/features/community/server';
import { AccountUser } from '@/server/models/AccountUser';
import { GameSetting, Impression, AdminAudit, PlayerReport } from '@/server/models/Community';
import { HOME_GAMES } from '@/features/home/data/games';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    await actor(true); const url = new URL(req.url); const q = (url.searchParams.get('q') ?? '').slice(0,100); const page = Math.min(10000,Math.max(0,Number(url.searchParams.get('page')) || 0));
    const filter = q ? { $or: ['name','username','email','playerId'].map(field => ({ [field]: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), $options: 'i' } })) } : {};
    const [users,total,settings,impressions,reports,audit] = await Promise.all([
      AccountUser.find(filter).select('playerId name email username disabledAt createdAt').sort({ createdAt: -1 }).skip(page*25).limit(25).lean(), AccountUser.countDocuments(filter), GameSetting.find().lean(),
      Impression.aggregate([{ $match: { day: { $gte: new Date(Date.now()-30*86400000).toISOString().slice(0,10) } } }, { $group: { _id: { day: '$day', path: '$path' }, count: { $sum: 1 } } }, { $sort: { '_id.day': -1 } }]),
      PlayerReport.find().sort({ createdAt: -1 }).limit(50).lean(), AdminAudit.find().sort({ createdAt: -1 }).limit(30).lean(),
    ]);
    return Response.json({ users: users.map(u => ({ ...u, isAdmin: isAdminEmail(u.email) })),total,games: HOME_GAMES.map(g => ({ id:g.id,title:g.title,enabled: !settings.some(s => s.gameId === g.id && !s.enabled) })),impressions,reports,audit }, { headers: { 'Cache-Control': 'no-store' } });
  } catch(e) { return failure(e); }
}
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new Error('403'); const me = await actor(true);
    const raw = await req.text(); if (raw.length > 2048) throw new Error('400'); const body = JSON.parse(raw);
    if (typeof body.target !== 'string' || body.target.length > 100 || typeof body.enabled !== 'boolean') throw new Error('400');
    if (body.action === 'user') {
      const target = await AccountUser.findOne({ playerId: body.target }).lean();
      if (!target || isAdminEmail(target.email)) throw new Error('403');
      await AccountUser.updateOne({ playerId: target.playerId }, { $set: { disabledAt: body.enabled ? null : new Date() }, $inc: { sessionVersion: 1 } });
      if(!body.enabled)await publishCommunity([target.playerId], 'revoke');
    } else if (body.action === 'game' && HOME_GAMES.some(g => g.id === body.target)) {
      await GameSetting.updateOne({ gameId: body.target }, { enabled: body.enabled }, { upsert: true });
    } else throw new Error('400');
    revalidateTag('home-games');
    revalidateTag('public-rankings');
    await AdminAudit.create({ actor: me.playerId, action: `${body.action}:${body.enabled}`, target: body.target });
    return Response.json({ ok: true });
  } catch(e) { return failure(e); }
}
