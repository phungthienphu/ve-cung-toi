export class EmailDeliveryError extends Error {}
export function publicOrigin() {
  const url = new URL(process.env.AUTH_PUBLIC_ORIGIN || '');
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost','127.0.0.1'].includes(url.hostname) && url.protocol === 'http:'))) throw new Error('Invalid AUTH_PUBLIC_ORIGIN');
  return url.origin;
}
export async function sendAccountEmail(email: string, kind: 'verify' | 'reset' | 'google-only' | 'existing' | 'changed' | 'added', token?: string) {
  const origin = publicOrigin();
  const link = token ? `${origin}/${kind === 'verify' ? 'verify-email' : 'reset-password'}#token=${encodeURIComponent(token)}` : `${origin}/login`;
  const messages = {
    verify: ['Xác minh email Chơi Cùng Tôi', `Xác minh email bằng liên kết sau (hiệu lực 24 giờ):\n${link}`],
    reset: ['Đặt lại mật khẩu Chơi Cùng Tôi', `Đặt lại mật khẩu bằng liên kết sau (hiệu lực 30 phút):\n${link}`],
    'google-only': ['Cách đăng nhập Chơi Cùng Tôi', `Tài khoản của bạn dùng Google. Hãy đăng nhập Google, vào Bảo mật tài khoản để thêm mật khẩu nếu muốn.\n${link}`],
    existing: ['Tài khoản Chơi Cùng Tôi', `Email này đã có tài khoản. Bạn có thể đăng nhập bằng phương thức đang có hoặc chọn Quên mật khẩu.\n${link}`],
    changed: ['Mật khẩu đã thay đổi', `Mật khẩu Chơi Cùng Tôi vừa được thay đổi và các phiên cũ đã bị thu hồi. Nếu không phải bạn, hãy khôi phục mật khẩu ngay.\n${link}`],
    added: ['Đã thêm mật khẩu', `Tài khoản Chơi Cùng Tôi vừa được thêm mật khẩu. Nếu không phải bạn, hãy khôi phục mật khẩu ngay.\n${link}`],
  } as const;
  const [subject, text] = messages[kind];
  let response: Response;
  try { response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM, to: [email], subject, text: `${text}\n\nNếu bạn không yêu cầu, có thể bỏ qua email này. Không chia sẻ liên kết với người khác.` }), signal: AbortSignal.timeout(10000) }); } catch { throw new EmailDeliveryError('Email service unavailable'); }
  if (!response.ok) throw new EmailDeliveryError('Email service unavailable');
}
