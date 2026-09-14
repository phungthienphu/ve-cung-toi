"use client";

import { use, useEffect, useState } from "react";
import { getOrCreatePlayerId, getStoredName, setStoredName } from "@/lib/player";
import { playClick } from "@/lib/sound";
import SoccerGameRoom from "@/components/soccer/SoccerGameRoom";

export default function SoccerRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setPlayerId(getOrCreatePlayerId());
    setName(getStoredName());
    if (sessionStorage.getItem(`vct_soccer_confirmed:${roomId}`) === "1") setReady(true);
  }, [roomId]);

  if (!playerId) return null;

  function confirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    playClick();
    setStoredName(trimmed);
    sessionStorage.setItem(`vct_soccer_confirmed:${roomId}`, "1");
    setName(trimmed);
    setReady(true);
  }

  if (!ready) {
    return (
      <main className="flex min-h-app items-center justify-center bg-soccer-scene px-4">
        <div className="w-full max-w-sm rounded-xl border border-cream-200 bg-white p-8 shadow-xl">
          <h1 className="mb-1 text-xl font-bold text-ink">Vào sân bóng</h1>
          <p className="mb-5 font-mono text-sm tracking-wider text-ink/40">{roomId}</p>

          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink/50">Tên hiển thị</label>
          <input
            autoFocus
            className="mb-6 w-full rounded-lg border border-cream-200 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            placeholder="Ví dụ: Phú"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
          />

          <button
            onClick={confirm}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
          >
            Vào phòng
            <span aria-hidden>→</span>
          </button>
        </div>
      </main>
    );
  }

  return <SoccerGameRoom roomId={roomId} playerId={playerId} name={name} />;
}
