'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useAccount } from './AccountProvider';
import './account.css';

export function AccountMenu() {
  const { data:session } = useSession();
  const { enabled, login, logout, busy, error } = useAccount();
  if (!enabled) return null;
  return <div className="account-menu">
    {session?.user ? <details><summary>
      {/* Google profile images are external and may be absent. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {session.user.image && <img src={session.user.image} alt="" referrerPolicy="no-referrer" width={28} height={28} />}
      <span>{session.user.name || 'Tài khoản'}</span>
    </summary><div className="account-dropdown"><strong>{session.user.name}</strong><small>{session.user.email}</small><Link href="/profile">Hồ sơ & thành tích</Link><Link href="/account/security">Bảo mật tài khoản</Link><Link href="/privacy">Quyền riêng tư</Link><button disabled={busy} onClick={() => void logout()}>Đăng xuất</button></div></details>
      : <button className="account-login" disabled={busy} onClick={() => void login()}>{busy ? 'Đang kết nối…' : 'Đăng nhập'}</button>}
    {error && !session && <div className="account-error" role="alert">{error}</div>}
  </div>;
}
export function SaveProgressPrompt() {
  const { data:session } = useSession();
  const { enabled, login, busy, error } = useAccount();
  if (!enabled || session?.user) return null;
  return <div className="account-save-prompt"><button disabled={busy} onClick={() => void login()}>Đăng nhập để giữ xu và kỷ lục</button><small>Giữ tiến độ giữa các máy · Vẫn có thể chơi khách</small>{error && <span role="alert">{error}</span>}</div>;
}
