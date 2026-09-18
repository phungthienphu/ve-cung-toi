"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { makeRoomId } from "@/lib/player";
import { playClick } from "@/lib/sound";
import type { SoccerRoomListing } from "@shared/soccerTypes";

const ROOM_LIST_POLL_MS = 4000;

export default function SoccerHomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [rooms, setRooms] = useState<SoccerRoomListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadRooms() {
      try {
        const res = await fetch("/api/soccer-rooms", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as SoccerRoomListing[];
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

  async function handleRefresh() {
    playClick();
    setRefreshing(true);
    try {
      const res = await fetch("/api/soccer-rooms", { cache: "no-store" });
      if (res.ok) setRooms((await res.json()) as SoccerRoomListing[]);
    } catch {
      // Ignore — the auto-poll will retry shortly anyway.
    } finally {
      setRefreshing(false);
    }
  }

  function handleCreate() {
    playClick();
    router.push(`/soccer/${makeRoomId()}`);
  }

  function handleJoin(code?: string) {
    playClick();
    const target = (code ?? joinCode).trim().toUpperCase();
    if (!target) return alert("Nhập mã phòng!");
    router.push(`/soccer/${target}`);
  }

  return (
    <main className="flex min-h-app items-center justify-center bg-soccer-scene px-4">
      <div className="w-full max-w-xl rounded-xl border border-cream-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 text-lg text-white">⚽</div>
          <span className="text-base font-semibold tracking-tight text-ink">Đại Chiến Bóng Đá</span>
        </div>

        <h1 className="mb-1 text-2xl font-bold text-ink">Đá bóng cùng hội bạn</h1>
        <p className="mb-6 text-sm text-ink/60">Chọn thể thức 1vs1 đến 4vs4, ghi nhiều bàn hơn trước khi hết giờ thì thắng.</p>

        <button
          onClick={handleCreate}
          className="mb-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
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
            className="min-w-0 flex-1 rounded-lg border border-cream-200 px-3.5 py-2.5 font-mono text-sm uppercase tracking-wider text-ink outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="MÃ PHÒNG"
            maxLength={8}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
          <button
            onClick={() => handleJoin()}
            className="shrink-0 rounded-lg border border-cream-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink/70 transition hover:border-emerald-500 hover:text-emerald-700"
          >
            Vào
          </button>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-ink/40">
            <span className="whitespace-nowrap">phòng đang chờ {rooms.length > 0 && `(${rooms.length})`}</span>
            <div className="h-px flex-1 bg-cream-200" />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Tìm phòng đang mở ngay bây giờ"
              className="flex shrink-0 items-center gap-1 rounded border border-cream-200 px-2 py-1 font-medium text-ink/60 transition hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-50"
            >
              <span className={refreshing ? "animate-spin" : ""}>🔄</span> Làm mới
            </button>
          </div>
          {rooms.length > 0 ? (
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {rooms.map((r) => (
                <button
                  key={r.roomId}
                  onClick={() => handleJoin(r.roomId)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-3.5 py-2 text-left text-sm transition hover:border-emerald-500"
                >
                  <span className="min-w-0 flex-1 truncate font-mono font-semibold tracking-wider text-ink">{r.roomId}</span>
                  <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {r.teamSize}v{r.teamSize}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-ink/50">{r.playerCount}/{r.teamSize * 2}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink/40">Chưa có phòng nào đang chờ — tạo phòng mới nhé!</p>
          )}
        </div>

        <Link href="/" className="mt-8 block text-center text-xs font-medium text-ink/40 hover:text-ink/70">
          ← Về trang chủ
        </Link>
      </div>
    </main>
  );
}
