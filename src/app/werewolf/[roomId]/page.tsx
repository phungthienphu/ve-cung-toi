"use client";

import { use, useEffect, useState } from "react";
import { getOrCreatePlayerId, getStoredName, setStoredName } from "@/lib/player";
import WerewolfGameRoom from "@/components/werewolf/WerewolfGameRoom";

export default function WerewolfRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [playerId, setPlayerId] = useState("");
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { setPlayerId(getOrCreatePlayerId()); setName(getStoredName()); setConfirmed(sessionStorage.getItem(`vct_werewolf:${roomId}`) === "1"); }, [roomId]);
  if (!playerId) return null;
  const enter = () => { const clean = name.trim(); if (!clean) return; setStoredName(clean); sessionStorage.setItem(`vct_werewolf:${roomId}`, "1"); setName(clean); setConfirmed(true); };
  if (!confirmed) return (
    <main className="flex min-h-app items-center justify-center bg-slate-950 px-4 text-white">
      <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-7 shadow-xl">
        <div className="text-4xl">🌕</div><h1 className="mt-4 text-2xl font-bold">Gia nhập ngôi làng</h1><p className="mt-1 font-mono text-sm text-violet-300">{roomId}</p>
        <label className="mt-6 block text-xs uppercase tracking-wider text-slate-400">Tên hiển thị</label>
        <input autoFocus value={name} maxLength={20} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && enter()} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-violet-400" placeholder="Ví dụ: Phú" />
        <button onClick={enter} className="mt-4 w-full rounded-xl bg-violet-500 py-3 font-semibold hover:bg-violet-400">Vào phòng</button>
      </section>
    </main>
  );
  return <WerewolfGameRoom roomId={roomId} playerId={playerId} name={name} />;
}

