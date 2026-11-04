'use client';
import { BackLink } from '@/components/navigation/BackLink';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { PigLogo } from '@/features/home/components/PigLogo';
import '@/features/home/theme.css';
export function AuthSurface({ children, fonts, backHref = '/', backLabel = 'Về trang chủ', wide = false }: { children: ReactNode; fonts: string; backHref?: string; backLabel?: string; wide?: boolean }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    try { if (localStorage.getItem('vct_home_theme') === 'dark') setTheme('dark'); } catch { /* Preferences are optional. */ }
  }, []);
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'; setTheme(next);
    try { localStorage.setItem('vct_home_theme', next); } catch { /* Optional. */ }
  }
  return <main className={`account-surface auth-page ${wide ? 'auth-page-wide' : ''} ${fonts}`} data-theme={theme}>
    <header className="auth-nav"><Link href="/" className="auth-brand"><PigLogo /><span>Chơi Cùng Tôi</span></Link><button className="auth-theme" type="button" onClick={toggleTheme} aria-label={theme === 'light' ? 'Chuyển sang ban đêm' : 'Chuyển sang ban ngày'}>{theme === 'light' ? '☾' : '☀'}</button></header>
    <div className="auth-content"><nav className="auth-back-nav" aria-label="Điều hướng quay lại"><BackLink href={backHref}>{backLabel}</BackLink></nav>{children}</div>
  </main>;
}
