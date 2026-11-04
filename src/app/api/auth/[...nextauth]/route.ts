import { NextResponse, type NextRequest } from 'next/server';
import { handlers, authEnabled } from '@/auth';

export async function GET(req: NextRequest) {
  if (!authEnabled) {
    // Auth.js needs a secret even for session reads. An unconfigured site is
    // intentionally guest-only, including client focus/session refreshes.
    if (req.nextUrl.pathname.endsWith('/session')) return NextResponse.json(null);
    if (req.nextUrl.pathname.endsWith('/providers')) return NextResponse.json({});
    return NextResponse.json({ error:'Đăng nhập chưa được cấu hình.' }, { status:503 });
  }
  return handlers.GET(req);
}
export async function POST(req: NextRequest) {
  if (!authEnabled) return NextResponse.json({ error:'Đăng nhập chưa được cấu hình.' }, { status:503 });
  return handlers.POST(req);
}
