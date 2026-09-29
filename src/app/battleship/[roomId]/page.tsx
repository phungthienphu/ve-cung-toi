"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreatePlayerId, getStoredName, setStoredName } from "@/lib/player";
import BattleshipRoom from "@/components/battleship/BattleshipRoom";
import { btnPrimary, card } from "@/components/battleship/ui";

export default function BattleshipRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [playerId, setPlayerId] = useState("");
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    setPlayerId(getOrCreatePlayerId());
    setName(getStoredName());
    setConfirmed(sessionStorage.getItem(`vct_battleship:${roomId}`) === "1");
  }, [roomId]);
  if (!playerId) return null;

  const enter = () => {
    const clean = name.trim();
    if (!clean) return;
    setStoredName(clean);
    sessionStorage.setItem(`vct_battleship:${roomId}`, "1");
    setName(clean);
    setConfirmed(true);
  };

  if (!confirmed) {
    return (
      <main className="bg-sea flex min-h-app items-center justify-center px-4 text-sky-50">
        <section className={`${card} w-full max-w-sm p-6 text-center`}>
          <div className="text-5xl">⚓</div>
          <h1 className="mt-2 text-2xl font-extrabold">Lên tàu</h1>
          <div className="mx-auto mt-3 w-fit rounded-md border border-dashed border-amber-300/50 bg-amber-300/10 px-5 py-2">
            <div className="text-[10px] uppercase tracking-[0.25em] text-sky-100/50">Mã phòng</div>
            <div className="font-mono text-xl font-bold tracking-[0.3em] text-amber-200">{roomId}</div>
          </div>
          <label className="mt-5 block text-left text-xs font-semibold uppercase tracking-wider text-sky-100/60">Tên thuyền trưởng</label>
          <input
            autoFocus
            value={name}
            maxLength={20}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && enter()}
            placeholder="Ví dụ: Phú"
            className="mt-1.5 w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-sky-100/40 focus:border-amber-300"
          />
          <button onClick={enter} disabled={!name.trim()} className={`${btnPrimary} mt-4 w-full py-3`}>Lên tàu 🚢</button>
          <Link href="/battleship" className="mt-4 block text-xs text-sky-100/60 hover:text-sky-50">← Về sảnh Hải Chiến</Link>
        </section>
      </main>
    );
  }
  return <BattleshipRoom roomId={roomId} playerId={playerId} name={name} />;
}
