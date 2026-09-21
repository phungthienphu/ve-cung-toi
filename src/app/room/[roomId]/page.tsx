"use client";

import { use, useEffect, useState } from "react";
import { getOrCreatePlayerId, getStoredName, setStoredName } from "@/lib/player";
import { playClick } from "@/lib/sound";
import { drawFontClass } from "@/lib/drawFonts";
import GameRoom from "@/components/GameRoom";

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    setPlayerId(getOrCreatePlayerId());
    const stored = getStoredName();
    setNameInput(stored);
    // Skip re-asking on a refresh/reconnect within the same tab+room, but a
    // fresh visit (e.g. opening someone else's invite link) always confirms
    // the name first — a leftover name from a previous room shouldn't stick.
    if (stored && sessionStorage.getItem(`vct_confirmed:${roomId}`) === "1") {
      setName(stored);
    }
  }, [roomId]);

  if (!playerId) return null;

  function confirmName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    playClick();
    setStoredName(trimmed);
    sessionStorage.setItem(`vct_confirmed:${roomId}`, "1");
    setName(trimmed);
  }

  if (!name) {
    const initial = nameInput.trim().charAt(0).toUpperCase() || "?";
    return (
      <main className={`${drawFontClass} bg-game-scene flex min-h-app items-center justify-center px-4`}>
        <div className="w-full max-w-sm rounded-xl border border-cream-200 bg-white p-8 shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-clay-500 font-draw-display text-2xl font-bold text-white ring-2 ring-clay-500">
            {initial}
          </div>
          <h1 className="text-center font-draw-display text-xl font-bold text-ink">Vào phòng</h1>
          <p className="mb-5 text-center font-draw-display text-sm tracking-wider text-clay-600">{roomId}</p>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink/50">Tên hiển thị</label>
          <input
            autoFocus
            className="mb-4 w-full rounded-lg border border-cream-200 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-clay-500 focus:ring-1 focus:ring-clay-500"
            placeholder="Ví dụ: Phú"
            maxLength={20}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmName()}
          />
          <button
            onClick={confirmName}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-clay-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-clay-500/30 transition hover:bg-clay-600 active:bg-clay-700"
          >
            Vào phòng
            <span aria-hidden>→</span>
          </button>
        </div>
      </main>
    );
  }

  return <GameRoom roomId={roomId} playerId={playerId} name={name} />;
}
