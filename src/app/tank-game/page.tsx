"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { makeRoomId } from "@/lib/player";
import { playClick } from "@/lib/sound";
import { KILL_TARGET, MAX_TANK_PLAYERS, TANK_ROOM_MODE_LABELS, type TankRoomListing } from "@shared/tankTypes";

// Room list is a nice-to-have, not core gameplay — poll instead of a
// websocket, and just show whatever's in `rooms` (starting empty) if a
// fetch ever fails, rather than surfacing an error for something this minor.
const ROOM_LIST_POLL_MS = 4000;

export default function TankGameHomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [rooms, setRooms] = useState<TankRoomListing[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadRooms() {
      try {
        const res = await fetch("/api/tank-rooms", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as TankRoomListing[];
        if (!cancelled) setRooms(data);
      } catch {
        // Keep showing whatever we already had rather than clearing the list.
      }
    }
    loadRooms();
    const interval = setInterval(loadRooms, ROOM_LIST_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function handleCreate() {
    playClick();
    router.push(`/tank-game/${makeRoomId()}`);
  }

  function handleJoin(code?: string) {
    playClick();
    const target = (code ?? joinCode).trim().toUpperCase();
    if (!target) return alert("Nhập mã phòng!");
    router.push(`/tank-game/${target}`);
  }

  return (
    <main className="flex min-h-app items-center justify-center bg-tank-scene px-4">
      <div className="w-full max-w-xl rounded-xl border border-cream-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-lg text-white">🎯</div>
          <span className="text-base font-semibold tracking-tight text-ink">Đại Chiến Xe Tăng</span>
        </div>

        <h1 className="mb-1 text-2xl font-bold text-ink">Bắn nhau cùng hội bạn</h1>
        <p className="mb-6 text-sm text-ink/60">Tối đa 8 người, ai đủ {KILL_TARGET} điểm tiêu diệt trước thì thắng.</p>

        <button
          onClick={handleCreate}
          className="mb-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
        >
          Tạo phòng mới
          <span aria-hidden>→</span>
        </button>

        <div className="mb-4 flex items-center gap-3 text-xs text-ink/40">
          <div className="h-px flex-1 bg-cream-200" />
          hoặc vào phòng có sẵn
          <div className="h-px flex-1 bg-cream-200" />
        </div>

        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-cream-200 px-3.5 py-2.5 font-mono text-sm uppercase tracking-wider text-ink outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            placeholder="MÃ PHÒNG"
            maxLength={8}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
          <button
            onClick={() => handleJoin()}
            className="shrink-0 rounded-lg border border-cream-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink/70 transition hover:border-slate-500 hover:text-slate-700"
          >
            Vào
          </button>
        </div>

        {rooms.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-3 text-xs text-ink/40">
              <div className="h-px flex-1 bg-cream-200" />
              phòng đang chờ ({rooms.length})
              <div className="h-px flex-1 bg-cream-200" />
            </div>
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {rooms.map((r) => (
                <button
                  key={r.roomId}
                  onClick={() => handleJoin(r.roomId)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-3.5 py-2 text-left text-sm transition hover:border-slate-500"
                >
                  <span className="min-w-0 flex-1 truncate font-mono font-semibold tracking-wider text-ink">{r.roomId}</span>
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {TANK_ROOM_MODE_LABELS[r.mode]}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-ink/50">
                    {r.playerCount}/{MAX_TANK_PLAYERS}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Link href="/" className="mt-8 block text-center text-xs font-medium text-ink/40 hover:text-ink/70">
          ← Về trang chủ
        </Link>
      </div>
    </main>
  );
}
