'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { makeRoomId, setStoredName } from '@/lib/player';
import type { HillRoomListing } from '@shared/hill/roomListing';
import { GameButton } from './HillUi';

// Finding an online race: driver name, then create a room, type a code, or
// tap an open room. Used by the game's main menu and by /friends (the page
// shared links land on). A missing name points at the name box instead of
// silently disabling every button.

export function HillFriendsPanel({ name, onName }: { name: string; onName: (name: string) => void }) {
  const router = useRouter();
  const nameBox = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState<HillRoomListing[] | null>(null);
  const [needName, setNeedName] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch('/api/hill-rooms')
        .then((response) => response.json())
        .then(setRooms)
        .catch(() => setRooms((current) => current ?? []));
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const enter = (room: string) => {
    if (!name.trim()) {
      setNeedName(true);
      nameBox.current?.focus();
      return;
    }
    setStoredName(name.trim());
    router.push(`/con-duong-hoang-kim/${room}`);
  };

  return (
    <div className="hk-friends-form">
      <label className="block text-xs font-bold uppercase tracking-wider text-emerald-100/70">
        Tên tài xế
        <input
          ref={nameBox}
          aria-label="Tên tài xế"
          maxLength={24}
          value={name}
          placeholder="Bạn bè sẽ thấy tên này"
          onChange={(event) => {
            onName(event.target.value);
            setNeedName(false);
          }}
          className={`mt-1.5 block w-full rounded-xl border-2 bg-black/20 px-3 py-2.5 text-base font-semibold normal-case tracking-normal text-white outline-none placeholder:text-white/35 focus:border-amber-300 ${
            needName ? 'border-red-400' : 'border-white/15'
          }`}
        />
      </label>
      {needName && <p className="mt-1.5 text-sm font-semibold text-red-300">Nhập tên trước đã nhé.</p>}

      <GameButton onClick={() => enter(makeRoomId())} className="mt-3 w-full py-3 text-xl">
        🏁 Tạo phòng đua
      </GameButton>

      <form
        className="mt-2.5 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (code) enter(code);
        }}
      >
        <input
          aria-label="Mã phòng"
          placeholder="Nhập mã phòng"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
          className="min-w-0 flex-1 rounded-xl border-2 border-white/15 bg-black/20 px-3 font-mono text-lg font-bold uppercase tracking-[0.2em] text-white outline-none placeholder:font-sans placeholder:text-sm placeholder:font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:text-white/35 focus:border-amber-300"
        />
        <GameButton tone="glass" disabled={!code} className="px-5 py-2.5 text-base">
          Vào ›
        </GameButton>
      </form>

      <div className="mb-2 mt-5 flex items-center justify-between">
        <h3 className="font-draw-display text-lg font-extrabold">Phòng đang chờ</h3>
        <span className="text-[11px] text-emerald-100/50">tự cập nhật</span>
      </div>
      {rooms === null ? (
        <p className="rounded-2xl bg-white/5 p-4 text-center text-sm text-emerald-100/60">Đang tìm phòng…</p>
      ) : rooms.length ? (
        <ul className="space-y-2">
          {rooms.map((room) => (
            <li key={room.roomId}>
              <button
                onClick={() => enter(room.roomId)}
                disabled={room.playerCount >= room.maxPlayers}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition enabled:hover:border-amber-300/60 enabled:hover:bg-white/10 disabled:opacity-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/15 text-xl">🏁</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">Phòng của {room.hostName || 'ẩn danh'}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-emerald-100/60">
                    <span className="font-mono tracking-widest">{room.roomId}</span>
                    <span className="flex gap-0.5" aria-label={`${room.playerCount}/${room.maxPlayers} người`}>
                      {Array.from({ length: room.maxPlayers }, (_, i) => (
                        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < room.playerCount ? 'bg-amber-300' : 'bg-white/20'}`} />
                      ))}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 font-draw-display font-extrabold text-amber-300">{room.playerCount >= room.maxPlayers ? 'Đầy' : 'Vào ›'}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-white/15 p-5 text-center">
          <p className="text-3xl">🏜️</p>
          <p className="mt-1 font-bold">Chưa có phòng nào mở</p>
          <p className="mt-1 text-sm text-emerald-100/60">Tạo một phòng rồi gửi link qua Zalo cho cả hội nhé.</p>
        </div>
      )}
    </div>
  );
}
