import { NextResponse } from 'next/server';
import { auth, googleLoginEnabled } from '@/auth';
import { dbConnect } from '@/server/db/mongodb';
import { validHillPlayer } from '@/features/hill/server/runs';
import { mergeGuestProgress } from '@/features/account/server/merge';
import { PlayerAccessError } from '@/features/account/server/access';

export async function POST(req: Request) {
  if (!googleLoginEnabled) return NextResponse.json({ error:'Đăng nhập Google chưa được cấu hình.' }, { status:503 });
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.get('host')) return NextResponse.json({ error: 'Yêu cầu không hợp lệ' }, { status: 403 });
    } catch { return NextResponse.json({ error: 'Yêu cầu không hợp lệ' }, { status: 403 }); }
  }
  const session = await auth();
  if (!session?.user?.playerId) return NextResponse.json({ error: 'Bạn cần đăng nhập' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 }); }
  if (!validHillPlayer(body?.guestId)) return NextResponse.json({ error: 'Mã khách không hợp lệ' }, { status: 400 });
  try {
    await dbConnect();
    await mergeGuestProgress(body.guestId, session.user.playerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof PlayerAccessError ? error.message : 'Chưa gộp được tiến độ. Bạn có thể thử lại.' }, { status: error instanceof PlayerAccessError ? error.status : 503 });
  }
}
