"use client";

import { use, useEffect, useState } from "react";
import { getOrCreatePlayerId, getStoredName, setStoredName } from "@/lib/player";
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
    setStoredName(trimmed);
    sessionStorage.setItem(`vct_confirmed:${roomId}`, "1");
    setName(trimmed);
  }

  if (!name) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-2xl font-bold">Vào phòng {roomId}</h1>
        <input
          autoFocus
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand-400"
          placeholder="Nhập tên hiển thị của bạn"
          maxLength={20}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmName()}
        />
        <button
          onClick={confirmName}
          className="w-full rounded-xl bg-brand-500 px-4 py-3 font-semibold text-white hover:bg-brand-600"
        >
          Vào phòng
        </button>
      </main>
    );
  }

  return <GameRoom roomId={roomId} playerId={playerId} name={name} />;
}
