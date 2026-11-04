import { NextResponse, type NextRequest } from 'next/server';
export function middleware(req: NextRequest) {
  const sensitive = ['/verify-email', '/reset-password'].includes(req.nextUrl.pathname);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-vct-sensitive-page', sensitive ? '1' : '0');
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (sensitive) {
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
}
export const config = { matcher: ['/verify-email', '/reset-password'] };
