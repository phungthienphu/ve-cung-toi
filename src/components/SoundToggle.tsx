'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isMuted, setMuted, toggleMusic } from '@/lib/sound';

/** General audio preferences; games with their own HUD keep their own controls. */
export default function SoundToggle() {
  const [muted, setMutedState] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const pathname = usePathname();
  const inWerewolf = pathname.startsWith('/werewolf');
  const hidden = pathname.startsWith('/math-quest') || pathname.startsWith('/admin') ||
    /^\/ai-la-heo\/[^/]+/.test(pathname) || pathname.startsWith('/con-duong-hoang-kim');

  useEffect(() => { setMutedState(isMuted()); }, []);

  function handleMuteToggle() {
    const next = !muted;
    setMuted(next); setMutedState(next);
    if (next) setMusicOn(false);
  }
  function handleMusicToggle() {
    if (!muted) setMusicOn(toggleMusic());
  }
  if (hidden) return null;
  return <details className="group fixed bottom-4 left-4 z-40" onToggle={e => { if (e.currentTarget.open) setMutedState(isMuted()); }} onKeyDown={e => { if (e.key === 'Escape') e.currentTarget.open = false; }}>
    <summary aria-label="Cài đặt âm thanh" title="Cài đặt" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-stone-300/50 bg-white/95 text-stone-600 shadow-md backdrop-blur transition hover:bg-amber-50 [&::-webkit-details-marker]:hidden">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9.4 3-.6 2-1.8 1-2-.5-2.5 4 1.5 1.5v2L2.5 15 5 19l2-.5 1.8 1 .6 2h5.2l.6-2 1.8-1 2 .5 2.5-4-1.5-2v-2l1.5-1.5-2.5-4-2 .5-1.8-1-.6-2H9.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
    </summary>
    <section aria-label="Cài đặt âm thanh" className="absolute bottom-14 left-0 w-64 max-w-[calc(100vw-32px)] rounded-2xl border border-amber-200 bg-[#fffaf0] p-4 text-stone-700 shadow-xl">
      <h2 className="mb-3 text-sm font-bold">Âm thanh</h2>
      <button type="button" role="switch" aria-checked={!muted} onClick={handleMuteToggle} className="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg px-2 text-sm hover:bg-amber-100/60"><span>Âm thanh trò chơi</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${muted ? 'bg-stone-200 text-stone-500' : 'bg-amber-300 text-amber-950'}`}>{muted ? 'Tắt' : 'Bật'}</span></button>
      {!inWerewolf && <button type="button" role="switch" aria-checked={musicOn} disabled={muted} onClick={handleMusicToggle} className="mt-1 flex min-h-11 w-full items-center justify-between gap-4 rounded-lg px-2 text-sm hover:bg-amber-100/60 disabled:opacity-40"><span>Nhạc nền</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${musicOn ? 'bg-amber-300 text-amber-950' : 'bg-stone-200 text-stone-500'}`}>{musicOn ? 'Bật' : 'Tắt'}</span></button>}
      <p className="mt-3 px-2 text-xs leading-5 text-stone-400">{inWerewolf ? 'Nhạc Ma Sói được điều chỉnh trong phòng chơi.' : muted ? 'Bật âm thanh để sử dụng nhạc nền.' : 'Một số game có cài đặt âm thanh riêng trong trận.'}</p>
    </section>
  </details>;
}
