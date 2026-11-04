import { unstable_cache } from 'next/cache';
import { dbConnect } from '@/server/db/mongodb';
import { GameSetting } from '@/server/models/Community';
const disabledGames = unstable_cache(async () => {
  await dbConnect();
  return (await GameSetting.find({ enabled: false }).select('gameId').lean()).map(game => game.gameId as string);
}, ['home-disabled-games'], { revalidate: 30, tags: ['home-games'] });
export async function GET() {
  try { return Response.json({ disabledGames: await disabledGames() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'Chưa tải được trạng thái game.' }, { status: 503 }); }
}
