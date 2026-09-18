"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStoredName, makeRoomId, setStoredName } from "@/lib/player";
import { playClick } from "@/lib/sound";
import { MAX_PLAYERS, type DrawRoomListing } from "@shared/types";

// Room list is a nice-to-have, not core gameplay — poll instead of a
// websocket, plus a manual refresh button (see handleRefresh) so a player
// isn't stuck waiting up to a full poll interval if they suspect the list
// is stale.
const ROOM_LIST_POLL_MS = 4000;

export default function DrawGuessHomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [rooms, setRooms] = useState<DrawRoomListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setName(getStoredName());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadRooms() {
      try {
        const res = await fetch("/api/draw-rooms", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as DrawRoomListing[];
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
      const res = await fetch("/api/draw-rooms", { cache: "no-store" });
      if (res.ok) setRooms((await res.json()) as DrawRoomListing[]);
    } catch {
      // Ignore — the auto-poll will retry shortly anyway.
    } finally {
      setRefreshing(false);
    }
  }

  function persistName() {
    const trimmed = name.trim().slice(0, 20);
    if (trimmed) setStoredName(trimmed);
    return trimmed;
  }

  function handleCreate() {
    playClick();
    const trimmed = persistName();
    if (!trimmed) return alert("Nhập tên của bạn trước đã!");
    router.push(`/room/${makeRoomId()}`);
  }

  function handleJoin(code?: string) {
    playClick();
    const trimmed = persistName();
    if (!trimmed) return alert("Nhập tên của bạn trước đã!");
    const target = (code ?? joinCode).trim().toUpperCase();
    if (!target) return alert("Nhập mã phòng!");
    router.push(`/room/${target}`);
  }

  return (
    <main className="bg-home-scene flex min-h-app justify-center items-center p-6 sm:p-10 lg:p-32">
      <div className="w-full min-w-0 max-w-xl rounded-lg bg-white/95 p-8 shadow-2xl">
        <div className="w-full">
          <div className="mb-10 flex items-center gap-2.5">
            
            <span className="text-xl font-bold tracking-tight text-ink">Vẽ Cùng Tôi</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-ink">Vẽ &amp; đoán chữ cùng bạn bè</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink/60">
            Không cần tài khoản. Tạo phòng, gửi link cho bạn bè, chơi ngay trên trình duyệt.
          </p>

          <div className="mt-8">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink/50">Tên hiển thị</label>
            <input
              className="mb-4 w-full rounded-lg border border-cream-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-clay-500 focus:ring-1 focus:ring-clay-500"
              placeholder="Ví dụ: Phú"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <button
              onClick={handleCreate}
              className="mb-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-clay-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-clay-500/30 transition hover:bg-clay-600 active:bg-clay-700"
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
                className="min-w-0 flex-1 rounded-lg border border-cream-200 bg-white px-3.5 py-2.5 font-mono text-sm uppercase tracking-wider text-ink outline-none transition focus:border-clay-500 focus:ring-1 focus:ring-clay-500"
                placeholder="MÃ PHÒNG"
                maxLength={8}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              <button
                onClick={() => handleJoin()}
                className="shrink-0 rounded-lg border border-cream-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink/70 transition hover:border-clay-500 hover:text-clay-600"
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
                  className="flex shrink-0 items-center gap-1 rounded border border-cream-200 px-2 py-1 font-medium text-ink/60 transition hover:border-clay-500 hover:text-clay-600 disabled:opacity-50"
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
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-3.5 py-2 text-left text-sm transition hover:border-clay-500"
                    >
                      <span className="min-w-0 flex-1 truncate font-mono font-semibold tracking-wider text-ink">{r.roomId}</span>
                      <span className="shrink-0 text-xs font-medium text-ink/50">
                        {r.playerCount}/{MAX_PLAYERS}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink/40">Chưa có phòng nào đang chờ — tạo phòng mới nhé!</p>
              )}
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4 text-xs text-ink/40">
            <span>Tối đa {MAX_PLAYERS} người / phòng</span>
          </div>

          <Link href="/" className="mt-8 block text-center text-xs font-medium text-ink/40 hover:text-ink/70">
            ← Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
