'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { signIn, signOut } from 'next-auth/react';
import { flushGuestProgress } from '../client/guest-progress';
import { getOrCreateGuestId } from '@/lib/player';

export type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'reset' | 'security';
interface Props { mode: AuthMode; emailEnabled: boolean; googleEnabled: boolean; hasPassword?: boolean; hasGoogle?: boolean; email?: string; username?: string; proved?: boolean; next?: string; initialError?: string }
const titles = { login: 'Chào bạn trở lại', register: 'Tạo tài khoản', verify: 'Xác minh email', forgot: 'Quên mật khẩu?', reset: 'Đặt mật khẩu mới', security: 'Bảo mật tài khoản' };
export function AuthForm(props: Props) {
  const { mode, emailEnabled, googleEnabled } = props;
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(props.initialError || ''), [token, setToken] = useState(''), [showPassword, setShowPassword] = useState(false);
  const [mail, setMail] = useState('');
  const [registered, setRegistered] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (mode !== 'verify' && mode !== 'reset') return;
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (value) { setToken(value); window.history.replaceState(null, '', window.location.pathname); }
  }, [mode]);
  async function post(path: string, data: Record<string, unknown>) {
    const res = await fetch('/api/account/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(20000) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Chưa xử lý được yêu cầu.');
    return body;
  }
  async function google(reauth = false) {
    setBusy(true); setError('');
    try {
      if (!reauth) await flushGuestProgress(getOrCreateGuestId());
      await signIn('google', { redirectTo: reauth ? '/account/security' : props.next || '/' }, reauth ? { max_age: '0', prompt: 'select_account' } : undefined);
    } catch { setError('Chưa kết nối được. Hãy thử lại.'); setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(form.entries());
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.value || '';
    try {
      if (mode === 'login') {
        await flushGuestProgress(getOrCreateGuestId());
        const result = await signIn('credentials', { identifier: data.identifier, password: data.password, redirect: false });
        if (!result || result.error || !result.ok) throw new Error('Thông tin đăng nhập không đúng hoặc tài khoản chưa được xác minh.');
        window.location.assign(props.next || '/'); return;
      }
      const endpoint = mode === 'register' ? 'register' : mode === 'verify' ? 'verification/confirm' : mode === 'forgot' ? 'password/forgot' : mode === 'reset' ? 'password/reset' : action || (props.hasPassword ? 'password/change' : 'password/add');
      const result = await post(endpoint, { ...data, ...(token ? { token } : {}) });
      setMessage(result.message || 'Đã xử lý thành công.');
      if (result.oauth) { await google(true); return; }
      if (mode === 'register') { setMail(String(data.email)); setRegistered(true); }
      if (mode === 'security' && endpoint.startsWith('password/')) await signOut({ redirectTo: '/login?changed=1' });
      if (mode === 'reset' || mode === 'verify') setToken('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Chưa kết nối được. Hãy thử lại.'); }
    finally { setBusy(false); }
  }
  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { setMessage((await post('verification/resend', { email: mail })).message); }
    catch (err) { setError(err instanceof Error ? err.message : 'Chưa gửi được.'); }
    finally { setBusy(false); }
  }
  const needsNewPassword = mode === 'register' || mode === 'reset' || (mode === 'security' && (props.hasPassword || props.proved));
  const inputType = showPassword ? 'text' : 'password';
  if (['forgot', 'reset'].includes(mode)) return <section className="auth-card"><h1>Quên mật khẩu</h1><p>Sắp ra mắt. Tính năng khôi phục mật khẩu đang tạm ngừng.</p><Link href="/login">Về đăng nhập</Link></section>;
  return <section className="auth-card">
    <p className="auth-eyebrow">CHƠI CÙNG TÔI</p><h1>{titles[mode]}</h1>
    {mode === 'login' && <p>Giữ tiến độ và thành tích giữa các máy.</p>}
    {mode === 'register' && <p>Email dùng để xác minh tài khoản ; khôi phục mật khẩu sẽ được bổ sung sau. Tên hiển thị có thể xuất hiện cùng kết quả trận.</p>}
    {mode === 'forgot' && <p>Nhập email đã xác minh để nhận liên kết đặt lại mật khẩu.</p>}
    {mode === 'security' && <div className="auth-methods"><p>Email đã xác minh: <strong>{props.email}</strong></p><p>Google: {props.hasGoogle ? 'Đã liên kết' : 'Chưa liên kết'} · Mật khẩu: {props.hasPassword ? 'Đã thiết lập' : 'Chưa thiết lập'}</p>{props.username && <p>Tên đăng nhập: {props.username}</p>}</div>}
    {error && <p role="alert" className="auth-error" tabIndex={-1} ref={errorRef}>{error}</p>}
    {message && <p role="status" className="auth-message">{message}</p>}
    {((mode === 'login' && emailEnabled) || (emailEnabled && mode !== 'login' && !(mode === 'register' && registered))) && <form onSubmit={submit} className="auth-form">
      {mode === 'login' && <label>Tên đăng nhập hoặc email<input name="identifier" autoComplete="username" maxLength={254} required /></label>}
      {(mode === 'register' || (mode === 'security' && !props.hasPassword && props.proved)) && <><label>Tên đăng nhập<input name="username" autoComplete="username" pattern="[a-zA-Z0-9_]{3,24}" minLength={3} maxLength={24} required /></label>{mode === 'register' && <label>Tên hiển thị<input name="name" autoComplete="nickname" maxLength={24} required /></label>}</>}
      {(mode === 'register' || mode === 'forgot') && <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
      {mode === 'verify' && token && <label>Tên đăng nhập khác (nếu tên cũ đã được sử dụng)<input name="username" autoComplete="username" pattern="[a-zA-Z0-9_]{3,24}" maxLength={24} /></label>}
      {mode === 'security' && props.hasPassword && <label>Mật khẩu hiện tại<input name="currentPassword" type={inputType} autoComplete="current-password" maxLength={128} required /></label>}
      {(mode === 'login' || needsNewPassword) && <label>{mode === 'login' ? 'Mật khẩu' : 'Mật khẩu mới'}<input name="password" type={inputType} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 12} maxLength={128} required /></label>}
      {needsNewPassword && <label>Xác nhận mật khẩu<input name="confirmation" type={inputType} autoComplete="new-password" minLength={12} maxLength={128} required /></label>}
      {(mode === 'login' || needsNewPassword) && <label className="auth-checkbox"><input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />Hiện mật khẩu</label>}
      {(mode !== 'verify' && mode !== 'reset' && mode !== 'security' || (mode === 'verify' || mode === 'reset') && !!token || mode === 'security' && (!!props.hasPassword || !!props.proved)) && <button className="auth-primary" disabled={busy} type="submit">{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Đăng ký' : mode === 'forgot' ? 'Gửi liên kết khôi phục' : mode === 'verify' ? 'Xác minh email' : 'Lưu mật khẩu'}</button>}
      {mode === 'security' && !props.hasGoogle && googleEnabled && <button disabled={busy} formNoValidate value="google/link" type="submit">Liên kết Google (xác nhận bằng mật khẩu hiện tại)</button>}
      {mode === 'security' && props.hasGoogle && !props.hasPassword && !props.proved && <button disabled={busy} value="google/reauth" type="submit">Xác thực lại Google để thêm mật khẩu</button>}
    </form>}
    {!emailEnabled && mode !== 'login' && <p>{mode === 'security' ? 'Chức năng thêm và khôi phục mật khẩu bằng email chưa được bật. Bạn vẫn có thể đăng nhập bằng Google.' : 'Chức năng email chưa được bật. Bạn vẫn có thể chơi khách hoặc đăng nhập Google.'}</p>}
    {(mode === 'verify' || mode === 'reset') && !token && !message && <p>Liên kết thiếu mã xác nhận. Hãy mở liên kết đầy đủ từ email hoặc yêu cầu lại.</p>}
    {(mode === 'register' && registered || mode === 'verify') && emailEnabled && <form onSubmit={resend} className="auth-form"><label>Email nhận xác minh<input type="email" autoComplete="email" value={mail} onChange={e => setMail(e.target.value)} required maxLength={254} /></label><button disabled={busy}>Gửi lại email xác minh</button></form>}
    {mode === 'login' && googleEnabled && <button className="auth-google" disabled={busy} onClick={() => void google()}>Tiếp tục với Google</button>}
    {mode === 'login' && !emailEnabled && !googleEnabled && <p>Đăng nhập chưa được cấu hình. Bạn vẫn có thể chơi khách.</p>}
    <nav className="auth-links">{mode === 'login' && <button type="button" disabled>Quên mật khẩu · Sắp ra mắt</button>}{mode === 'security' ? <Link href="/profile">Hồ sơ & thành tích</Link> : mode !== 'login' && <Link href="/login">Đăng nhập</Link>}{mode === 'login' && emailEnabled && <><Link href="/register">Tạo tài khoản</Link><Link href="/verify-email">Gửi lại xác minh</Link></>}{mode === 'reset' && <Link href="/forgot-password">Yêu cầu liên kết mới</Link>}<Link href="/">{mode === 'security' ? 'Trang chủ' : 'Chơi khách / Trang chủ'}</Link><Link href="/privacy">Quyền riêng tư</Link></nav>
  </section>;
}
