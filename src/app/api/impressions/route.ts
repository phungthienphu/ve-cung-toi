import { dbConnect } from '@/server/db/mongodb';
import { Impression, GameSetting } from '@/server/models/Community';
import { HOME_GAMES } from '@/features/home/data/games';
import { sameOrigin } from '@/features/community/server';
import { requestIp, takeLimit } from '@/features/account/server/rate-limit';
export async function GET() {
  await dbConnect(); return Response.json(await GameSetting.find({ enabled: false }).select('gameId -_id').lean(), { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  try {
    const raw = await req.text(); if (raw.length > 512) return new Response(null,{status:400});
    const body = JSON.parse(raw);
    if (!['/',...HOME_GAMES.map(g=>g.href)].includes(body.path) || !/^[a-f0-9-]{36}$/.test(body.eventId)) return new Response(null,{status:400});
    await dbConnect(); if (!await takeLimit('impression',requestIp(req.headers),120,60000)) return new Response(null,{status:429});
    await Impression.updateOne({ eventId: body.eventId }, { $setOnInsert: { path:body.path, day:new Date().toISOString().slice(0,10), expiresAt:new Date(Date.now()+90*86400000) } }, { upsert:true });
    return new Response(null,{status:204});
  } catch { return new Response(null,{status:503}); }
}
