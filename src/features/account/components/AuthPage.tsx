import { emailLoginEnabled, googleLoginEnabled } from '../server/config';
import { homeFonts } from '@/features/home/fonts';
import { AuthSurface } from './AuthSurface';
import { AuthForm, type AuthMode } from './AuthForm';
import './auth-pages.css';
export function safeNext(value: unknown) { return typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\\\x00-\x20]/.test(value) && !value.startsWith('/api/') ? value : '/'; }
export async function AuthPage({ mode, searchParams }: { mode: AuthMode; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const initialError = params?.error ? (params.error === 'AccountLink' ? 'Chưa liên kết được Google. Hãy đăng nhập bằng phương thức đang có, mở Bảo mật tài khoản và thử lại.' : 'Chưa đăng nhập được. Kiểm tra thông tin hoặc thử lại.') : undefined;
  const back = mode === 'login' ? { href: '/', label: 'Về trang chủ' } : mode === 'reset' ? { href: '/forgot-password', label: 'Về khôi phục mật khẩu' } : { href: '/login', label: 'Về đăng nhập' };
  return <AuthSurface fonts={homeFonts} backHref={back.href} backLabel={back.label}><AuthForm mode={mode} emailEnabled={emailLoginEnabled} googleEnabled={googleLoginEnabled} next={safeNext(params?.next)} initialError={initialError} /></AuthSurface>;
}
