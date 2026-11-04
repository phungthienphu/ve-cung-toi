'use client';

import { AccountMenu } from '@/features/account/components/AccountMenu';
import { PigLogo } from './PigLogo';
import { HomeIcon } from './HomeIcon';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GAME_FILTERS, filterGames, type GameFilter } from '../data/games';
import type { NewsPage } from '../data/news';
import { GameCard } from './GameCard';
import { NewsPreview, NewsSheet } from './News';

const THEME_KEY = 'vct_home_theme';
const NEWS_READ_KEY = 'vct_home_news_read';
function readPreference(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function savePreference(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* The UI also works when storage is unavailable. */ } }

const STEPS = [
  { title: 'Chọn một game', text: 'Không cần đăng ký, không cài đặt gì.' },
  { title: 'Tạo phòng, gửi link', text: 'Mỗi phòng một mã riêng. Dán vào Zalo hay Messenger là xong.' },
  { title: 'Cả hội vào chơi', text: 'Trên điện thoại hay máy tính đều được.' },
];
export default function HomePage({ initialNews, disabledGames = [] }: { initialNews: NewsPage; disabledGames?: string[] }) {
  const [filter, setFilter] = useState<GameFilter>('all');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [skyTransition, setSkyTransition] = useState(0);
  const [readThrough, setReadThrough] = useState('');
  const [sheet, setSheet] = useState<{ open: boolean; expanded: boolean }>({ open: false, expanded: false });
  const games = filterGames(filter).filter(game => !disabledGames.includes(game.id));
  const newest = initialNews.items[0];
  const unread = !!newest && (Date.parse(newest.publishedAt) > (Date.parse(readThrough) || 0));
  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => { const saved = readPreference(THEME_KEY); setTheme(saved === 'dark' || (saved !== 'light' && system.matches) ? 'dark' : 'light'); };
    sync(); setReadThrough(readPreference(NEWS_READ_KEY) ?? '');
    system.addEventListener('change', sync);
    const storage = (event: StorageEvent) => { if (event.key === THEME_KEY) sync(); if (event.key === NEWS_READ_KEY) setReadThrough(event.newValue ?? ''); };
    window.addEventListener('storage', storage);
    return () => { system.removeEventListener('change', sync); window.removeEventListener('storage', storage); };
  }, []);
  function openNews(expanded = false) {
    setSheet({ open: true, expanded });
    if (newest) { setReadThrough(newest.publishedAt); savePreference(NEWS_READ_KEY, newest.publishedAt); }
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    savePreference(THEME_KEY, next);
    setSkyTransition(current => current + 1);
  }

  return <div className="home-page" data-theme={theme}>
    <a href="#home-games" className="home-skip-link">Đến danh sách trò chơi</a>
    <header className="home-hero"><nav className="home-nav home-container" aria-label="Điều hướng chính">
      <Link href="/" className="home-logo"><PigLogo /><span>Chơi Cùng Tôi</span></Link><form className="home-player-search" action="/community" role="search" aria-label="Tìm người chơi"><input name="q" aria-label="Tìm người chơi" placeholder="Tìm tên hoặc username…" minLength={2} maxLength={60} required autoComplete="off"/><button type="submit" aria-label="Tìm kiếm người chơi"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button></form><div className="home-nav-actions"><AccountMenu /><a className="home-nav-games" href="#home-games"><HomeIcon name="game" /><span>Trò chơi</span></a><button className="home-icon-button home-bell" aria-label={unread ? 'Mở bảng tin, có tin mới' : 'Mở bảng tin'} onClick={() => openNews()}><HomeIcon name="bell" />{unread && <span className="home-unread-dot" />}</button><Link href="/leaderboard" className="home-icon-button" aria-label="Lịch sử trận đấu"><HomeIcon name="history" /></Link><button className="home-icon-button home-theme-toggle" onClick={toggleTheme} aria-label={theme === 'light' ? 'Chuyển sang ban đêm' : 'Chuyển sang ban ngày'} aria-pressed={theme === 'dark'}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>{theme === 'light' ? <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" /> : <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>}</svg></button></div>
    </nav><div className="home-hero-copy home-container"><h1>Hôm nay chơi gì?</h1><p>Rủ cả hội vào chơi bằng một đường link.<br className="home-mobile-break" /> Không cần tài khoản, không cài đặt gì.</p></div>
      <div key={skyTransition} className={`home-sky-scene${skyTransition ? ' home-sky-changing' : ''}`} aria-hidden>
        <div className="home-sky-glow" />
        <svg className="home-celestial" width="88" height="88" viewBox="0 0 100 100">
          {theme === 'dark' ? <><path d="M68 8A40 40 0 1 0 92 68 36 36 0 0 1 68 8Z" fill="#fff3cc" stroke="#2e1c0f" strokeWidth="2.5" /><circle cx="29" cy="51" r="5" fill="#e4d8aa"/><circle cx="46" cy="73" r="3" fill="#e4d8aa"/></> : <><g stroke="#ffe28a" strokeWidth="4" strokeLinecap="round"><path d="M50 3v10m0 74v10M3 50h10m74 0h10M17 17l7 7m52 52 7 7M17 83l7-7m52-52 7-7"/></g><circle cx="50" cy="50" r="30" fill="#ffc23a" stroke="#2e1c0f" strokeWidth="2.5"/></>}
        </svg>
        <svg className="home-cloud home-cloud-one" width="98" height="42" viewBox="0 0 98 42"><path d="M16 37C0 37 0 16 17 16 17-1 43-3 48 13 58 4 76 10 77 23 98 18 104 40 82 40Z" fill="#fffaf0" stroke="#2e1c0f" strokeWidth="2.5"/></svg>
        <svg className="home-cloud home-cloud-two" width="66" height="33" viewBox="0 0 98 42"><path d="M16 37C0 37 0 16 17 16 17-1 43-3 48 13 58 4 76 10 77 23 98 18 104 40 82 40Z" fill="#fffaf0" stroke="#2e1c0f" strokeWidth="2.5"/></svg>
      </div>
      <svg className="home-hills" viewBox="0 0 1440 88" preserveAspectRatio="none" aria-hidden><path d="M-10 67Q160-8 350 47T770 43T1100 35T1450 57V90H-10Z" fill="var(--home-grass)" stroke="var(--home-ink)" strokeWidth="3"/><path d="M-10 87Q170 27 355 68T770 66T1115 60T1450 77V91H-10Z" fill="var(--home-ground)" stroke="var(--home-ink)" strokeWidth="3"/></svg>
    </header>
    <main className="home-container home-main" id="home-games"><div className="home-filters" role="group" aria-label="Lọc trò chơi">{GAME_FILTERS.map(item => <button key={item.id} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id}>{item.label}</button>)}</div>
      {newest && <button className="home-news-ticker" onClick={() => openNews()}><span className="home-ticker-badge">{unread ? 'MỚI' : 'TIN'}</span><span>{newest.game}: {newest.title}</span><span aria-hidden>›</span></button>}
      <div className="home-layout"><section aria-label="Danh sách trò chơi"><p className="home-sr-only" aria-live="polite">{games.length} trò chơi phù hợp</p><div className="home-game-grid">{games.map(game => <GameCard key={game.id} game={game} featured={game.id === 'hill'} />)}</div>{games.length === 0 && <div className="home-empty"><h2>Chưa có game phù hợp</h2><button className="home-button" onClick={() => setFilter('all')}>Xem tất cả trò chơi</button></div>}</section><NewsPreview initial={initialNews} readThrough={readThrough} onExpand={() => openNews(true)} /></div>
      <section className="home-how" aria-labelledby="home-how-heading"><h2 id="home-how-heading">Chơi thế nào?</h2><ol>{STEPS.map((step, index) => <li key={step.title}><span className="home-step-number">{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol></section>
      <footer className="home-footer"><div className="home-author"><span className="home-avatar">TP</span><div><span>Làm bởi</span><strong>Thiên Phú</strong><p>Có góp ý gì cứ nhắn mình nhé!</p></div></div><div className="home-social"><a href="https://www.facebook.com/phu.tuila.50" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://github.com/phungthienphu" target="_blank" rel="noopener noreferrer">GitHub ↗</a></div><div className="home-footer-bottom"><span>© {new Date().getFullYear()} Chơi Cùng Tôi</span><Link href="/privacy">Quyền riêng tư</Link><Link href="/leaderboard">Lịch sử trận đấu →</Link></div></footer>
    </main>
    <NewsSheet initial={initialNews} open={sheet.open} expandedOnOpen={sheet.expanded} readThrough={readThrough} onClose={() => setSheet(current => ({ ...current, open: false }))} />
  </div>;
}
