import { NextResponse } from 'next/server';
import { newsPage } from '@/features/home/data/news';

export function GET(request: Request) {
  const cursor = new URL(request.url).searchParams.get('cursor');
  if (cursor && cursor.length > 100) return NextResponse.json({ error: 'Mốc tin không hợp lệ.' }, { status: 400 });
  const page = newsPage(cursor);
  return page ? NextResponse.json(page, { headers: { 'Cache-Control': 'public, max-age=60' } }) : NextResponse.json({ error: 'Mốc tin không còn tồn tại. Hãy mở lại bảng tin.' }, { status: 400 });
}
