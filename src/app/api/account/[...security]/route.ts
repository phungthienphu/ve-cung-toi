import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { emailLoginEnabled, googleLoginEnabled } from '@/features/account/server/config';
import { dbConnect } from '@/server/db/mongodb';
import { AccountUser } from '@/server/models/AccountUser';
import { AccountRegistration, AccountToken, AuthRateLimit } from '@/server/models/AccountSecurity';
import { AccountError, GENERIC_EMAIL_MESSAGE, registerAccount, resendVerification, confirmRegistration, forgotPassword, resetPassword, changePassword, addPassword, newToken } from '@/features/account/server/credentials';
import { normalizeEmail, validEmail, checkPassword } from '@/features/account/server/password';
import { digest, takeLimit, requestIp } from '@/features/account/server/rate-limit';
import { EmailDeliveryError } from '@/features/account/server/email';
import { INTENT_COOKIE } from '@/features/account/server/google';
export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request, context: { params: Promise<{ security: string[] }> }) {
  const requestedAction = (await context.params).security.join('/');
  if (['password/forgot', 'password/reset'].includes(requestedAction)) return json({ error: 'Quên mật khẩu — Sắp ra mắt.' }, 503);
  if (!emailLoginEnabled) return json({ error: 'Chức năng email chưa được cấu hình. Bạn vẫn có thể chơi khách hoặc dùng Google nếu có.' }, 503);
  try {
    const origin = req.headers.get('origin');
    if (!origin || new URL(origin).host !== req.headers.get('host') || !req.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
    const raw = await req.text();
    if (raw.length > 8192) return json({ error: 'Dữ liệu quá dài.' }, 400);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Dữ liệu không hợp lệ.' }, 400); }
    if (!body || Array.isArray(body) || typeof body !== 'object') return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
    const action = (await context.params).security.join('/');
    await dbConnect();
    await Promise.all([AccountRegistration.init(), AccountToken.init(), AuthRateLimit.init()]);
    const ip = requestIp(req.headers);
    const sending = ['register', 'verification/resend', 'password/forgot'].includes(action);
    if (!await takeLimit(`account-${sending ? 'mail' : 'action'}-ip`, ip, sending ? 20 : 30, sending ? 3600000 : 900000)) return json({ error: 'Bạn đã thử quá nhiều lần. Hãy thử lại sau.' }, 429);
    if (sending) {
      const email = normalizeEmail(body.email);
      if (!validEmail(email)) throw new AccountError('Email chưa hợp lệ.');
      if (!await takeLimit('mail-email-hour', email, 3, 3600000) || !await takeLimit('mail-email-minute', email, 1, 60000)) return json({ message: GENERIC_EMAIL_MESSAGE });
      if (action === 'register') {
        if (!await takeLimit('register-ip', ip, 10, 3600000)) return json({ error: 'Bạn đã thử quá nhiều lần. Hãy thử lại sau.' }, 429);
        await registerAccount(body);
      } else if (action === 'verification/resend') await resendVerification(email);
      else await forgotPassword(email);
      return json({ message: GENERIC_EMAIL_MESSAGE });
    }
    if (action === 'verification/confirm' || action === 'password/reset') {
      const token = typeof body.token === 'string' ? body.token.slice(0, 256) : '';
      if (!await takeLimit('token-attempt', digest(token), 10, 900000)) throw new AccountError('Hãy thử lại sau.', 429);
      if (action === 'verification/confirm') await confirmRegistration(body.token, body.username);
      else await resetPassword(body);
      return json({ message: action === 'verification/confirm' ? 'Email đã được xác minh. Bạn có thể đăng nhập.' : 'Mật khẩu đã được đặt lại. Hãy đăng nhập bằng mật khẩu mới.' });
    }
    if (!['password/change', 'password/add', 'google/link', 'google/reauth'].includes(action)) return json({ error: 'Không tìm thấy chức năng.' }, 404);
    const session = await auth();
    if (!session?.user?.playerId) throw new AccountError('Hãy đăng nhập lại.', 401);
    const { playerId, sessionVersion } = session.user;
    if (!await takeLimit('security-user', playerId, 10, 900000)) throw new AccountError('Hãy thử lại sau.', 429);
    if (action === 'password/change') await changePassword(playerId, sessionVersion, body);
    if (action === 'password/add') {
      const jar = await cookies();
      await addPassword(playerId, sessionVersion, jar.get(INTENT_COOKIE)?.value ?? '', body);
      jar.delete(INTENT_COOKIE);
    }
    if (action.startsWith('google/')) {
      if (!googleLoginEnabled) throw new AccountError('Google chưa được cấu hình.', 503);
      const user = await AccountUser.findOne({ playerId }).select('+passwordHash').lean();
      if (!user) throw new AccountError('Hãy đăng nhập lại.', 401);
      const linking = action === 'google/link';
      if (linking) {
        const password = typeof body.currentPassword === 'string' && body.currentPassword.length <= 128 ? body.currentPassword : '';
        if (user.googleSubject || !await checkPassword(user.passwordHash, password)) throw new AccountError('Không thể liên kết. Kiểm tra mật khẩu hiện tại và phương thức đang có.');
      } else if (!user.googleSubject || user.passwordHash) throw new AccountError('Không thể thêm mật khẩu bằng luồng này.');
      const token = newToken();
      await AccountToken.create({ tokenHash: digest(token), playerId, sessionVersion, purpose: linking ? 'link-google' : 'add-password', expiresAt: new Date(Date.now() + 300000) });
      (await cookies()).set(INTENT_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 300, path: '/' });
      return json({ oauth: true });
    }
    return json({ message: 'Mật khẩu đã cập nhật. Hãy đăng nhập lại.' });
  } catch (error) {
    if (error instanceof EmailDeliveryError) return json({ message: GENERIC_EMAIL_MESSAGE });
    if (error instanceof AccountError) return json({ error: error.message }, error.status);
    if ((error as { code?: number }).code === 11000) return json({ error: 'Thông tin vừa được sử dụng. Hãy chọn tên khác hoặc đăng nhập bằng phương thức đang có.' }, 409);
    // Never serialize provider errors, payloads, tokens or passwords to logs/client.
    return json({ error: 'Chưa xử lý được yêu cầu. Hãy thử lại sau.' }, 503);
  }
}
