"use client";

import { use, useEffect, useState } from "react";
import { getOrCreatePlayerId, getStoredName, setStoredName } from "@/lib/player";
import { playClick } from "@/lib/sound";
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
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-pink-50 px-4">
        <div className="animate-pop-in w-full max-w-sm rounded-3xl border-4 border-white bg-white/90 p-6 text-center shadow-xl shadow-brand-100">
          <div className="mb-1 text-4xl">🎨</div>
          <h1 className="mb-4 text-2xl font-bold text-slate-800">Vào phòng {roomId}</h1>
          <input
            autoFocus
            className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="Nhập tên hiển thị của bạn"
            maxLength={20}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmName()}
          />
          <button
            onClick={confirmName}
            className="w-full rounded-xl bg-brand-500 px-4 py-3 font-semibold text-white shadow-md shadow-brand-200 transition hover:scale-[1.02] hover:bg-brand-600 active:scale-[0.98]"
          >
            Vào phòng 🚀
          </button>
        </div>
      </main>
    );
  }

  return <GameRoom roomId={roomId} playerId={playerId} name={name} />;
}
