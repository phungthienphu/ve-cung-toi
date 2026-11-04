import { RANKING_GAMES } from '@/features/community/ranking-config';
import { rankingPage } from '@/features/community/rankings';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const game = params.get('game') ?? '';
  if (game === 'all') {
    try {
      const games = await Promise.all(RANKING_GAMES.map(async item => ({ gameId: item.id, page: await rankingPage(item.id, 0, 3) })));
      return Response.json({ games }, { headers: { 'Cache-Control': 'public, max-age=30' } });
    } catch { return Response.json({ error: 'Chưa tải được bảng xếp hạng.' }, { status: 503 }); }
  }
  if (!RANKING_GAMES.some(item => item.id === game)) return Response.json({ error: 'Game không hợp lệ.' }, { status: 400 });
  const offset = Number(params.get('offset') ?? '0');
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return Response.json({ error: 'Trang không hợp lệ.' }, { status: 400 });
  try { return Response.json(await rankingPage(game, offset), { headers: { 'Cache-Control': 'public, max-age=30' } }); }
  catch { return Response.json({ error: 'Chưa tải được bảng xếp hạng.' }, { status: 503 }); }
}
