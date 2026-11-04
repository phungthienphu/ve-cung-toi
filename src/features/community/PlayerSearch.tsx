'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import './player-search.css';

const HISTORY_KEY = 'vct_player_search_history';
function readHistory(): string[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(data) ? data.filter((v): v is string => typeof v === 'string' && v.length >= 2 && v.length <= 60).slice(0, 8) : [];
  } catch { return []; }
}
function saveHistory(items: string[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); } catch { /* Search works without storage. */ }
}
function SearchIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>;
}
type Player = { playerId: string; name: string; username?: string };
export function PlayerSearch({ value, onChange, navigation = false, suggest = true }: { value?: string; onChange?: (value: string) => void; navigation?: boolean; suggest?: boolean }) {
  const router = useRouter();
  const { status } = useSession();
  const [localValue, setLocalValue] = useState('');
  const query = value ?? localValue;
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [results, setResults] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  function change(text: string) { setLocalValue(text); onChange?.(text); }
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  useEffect(() => {
    setResults([]); setError('');
    if (!suggest || !open || query.trim().length < 2) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      const endpoint = status === 'authenticated' ? '/api/community' : '/api/community/search';
      void fetch(`${endpoint}?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal }).then(async response => {
        if (!response.ok) throw new Error('Không tải được gợi ý. Bạn có thể nhấn Enter để tìm lại.');
        const data = await response.json();
        if (!controller.signal.aborted) setResults(data.search);
      }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, query, status, suggest]);
  function choose(text: string) {
    const term = text.trim();
    if (term.length < 2) return;
    const next = [term, ...readHistory().filter(item => item.toLowerCase() !== term.toLowerCase())].slice(0, 8);
    saveHistory(next); setHistory(next); change(term); setOpen(false);
    if (navigation) router.push(`/community?q=${encodeURIComponent(term)}`);
  }
  return <form ref={root} className={`player-search${navigation ? ' player-search-nav' : ''}`} role="search" aria-label="Tìm người chơi" onSubmit={e => { e.preventDefault(); choose(query); }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }} onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); input.current?.focus(); }
    if (e.key === 'ArrowDown' && e.target === input.current) { e.preventDefault(); root.current?.querySelector<HTMLButtonElement>('.player-search-menu button')?.focus(); }
  }}>
    <div className="player-search-field"><input ref={input} aria-label="Tìm người chơi" aria-controls={navigation ? 'nav-player-suggestions' : 'chat-player-suggestions'} value={query} onFocus={() => { setHistory(readHistory()); setOpen(true); }} onChange={e => { change(e.target.value); setOpen(true); }} placeholder="Tìm tên hoặc username…" minLength={2} maxLength={60} autoComplete="off"/>{query && <button type="button" className="player-search-clear" aria-label="Xóa từ khóa" onClick={() => { change(''); setHistory(readHistory()); setOpen(true); input.current?.focus(); }}>×</button>}<button className="player-search-submit" aria-label="Tìm kiếm người chơi" type="submit"><SearchIcon/></button></div>
    {open && (suggest || query.trim().length < 2) && <div className="player-search-menu" id={navigation ? 'nav-player-suggestions' : 'chat-player-suggestions'}>
      {query.trim().length < 2 ? <><header><strong>Tìm kiếm gần đây</strong>{history.length > 0 && <button type="button" onClick={() => { saveHistory([]); setHistory([]); }}>Xóa tất cả</button>}</header>{history.length ? history.map(term => <div className="player-search-history" key={term}><button type="button" onClick={() => choose(term)}><span aria-hidden="true">↺</span>{term}</button><button type="button" aria-label={`Xóa lịch sử ${term}`} onClick={() => { const next = history.filter(item => item !== term); saveHistory(next); setHistory(next); }}>×</button></div>) : <p>Chưa có lịch sử. Nhập ít nhất 2 ký tự để tìm bạn.</p>}</> : <><header><strong>Người chơi</strong><span>{loading ? 'Đang tìm…' : `${results.length} gợi ý`}</span></header>{error ? <p role="status">{error}</p> : results.map(player => <button type="button" className="player-search-result" key={player.playerId} onClick={() => choose(player.username ?? player.name)}><span className="player-search-avatar">{player.name.slice(0, 1).toUpperCase()}</span><span><strong>{player.name}</strong><small>{player.username ? `@${player.username}` : 'Người chơi'}</small></span><span aria-hidden="true">↗</span></button>)}{!loading && !error && !results.length && <p>Không tìm thấy người chơi phù hợp.</p>}<button type="button" className="player-search-all" onClick={() => choose(query)}>Xem kết quả cho “{query.trim()}” →</button></>}
    </div>}
  </form>;
}
