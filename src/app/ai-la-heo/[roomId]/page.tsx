"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import OldMaidRoom from "@/components/oldmaid/OldMaidRoom";
import { btnPrimary } from "@/components/oldmaid/panels";
import { drawFontClass } from "@/lib/drawFonts";
import { getOrCreatePlayerId, getStoredName, setStoredName } from "@/lib/player";

export default function OldMaidRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId: rawRoomId } = use(params);
  const roomId = decodeURIComponent(rawRoomId).toUpperCase();
  const [playerId, setPlayerId] = useState("");
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [quickBots, setQuickBots] = useState(0);

  useEffect(() => {
    setPlayerId(getOrCreatePlayerId());
    setName(getStoredName());
    setConfirmed(sessionStorage.getItem(`vct_oldmaid:${roomId}`) === "1");
    // "Chơi với bot ngay" arrives with ?bots=N.
    const bots = Number(new URLSearchParams(window.location.search).get("bots"));
    if (bots > 0) setQuickBots(Math.min(5, Math.round(bots)));
  }, [roomId]);
  if (!playerId) return null;

  const enter = () => {
    const clean = name.trim();
    if (!clean) return;
    setStoredName(clean);
    sessionStorage.setItem(`vct_oldmaid:${roomId}`, "1");
    setName(clean);
    setConfirmed(true);
  };

  if (!confirmed) {
    return (
      <main className={`${drawFontClass} bg-heo-room flex min-h-app items-center justify-center px-4 text-white`}>
        <section className="om-pop w-full max-w-sm rounded-3xl bg-white/[0.06] p-6 text-center shadow-2xl ring-1 ring-white/10 backdrop-blur">
          <div className="text-6xl">🐷</div>
          <h1 className="mt-2 font-draw-display text-3xl font-extrabold">Vào bàn Ai Là Heo</h1>
          <div className="mx-auto mt-4 w-fit rounded-2xl border border-dashed border-amber-300/50 bg-amber-300/10 px-5 py-2">
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">Mã phòng</div>
            <div className="font-mono text-2xl font-black tracking-[0.3em] text-amber-200">{roomId}</div>
          </div>
          <label htmlFor="oldmaid-name" className="mt-6 block text-left text-xs font-bold uppercase tracking-wider text-white/55">
            Tên của bạn
          </label>
          <input
            id="oldmaid-name"
            autoFocus
            value={name}
            maxLength={20}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && enter()}
            placeholder="Ví dụ: Phú"
            className="mt-1.5 w-full rounded-2xl bg-white/10 px-4 py-3 text-lg font-semibold outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-amber-300"
          />
          <button type="button" onClick={enter} disabled={!name.trim()} className={`${btnPrimary} mt-4 w-full`}>
            {quickBots ? "🤖 Chơi với bot ngay" : "🃏 Vào bàn"}
          </button>
          <Link href="/ai-la-heo" className="mt-4 block text-sm text-white/55 hover:text-white">
            ← Về sảnh Ai Là Heo
          </Link>
        </section>
      </main>
    );
  }
  return <OldMaidRoom roomId={roomId} playerId={playerId} name={name} quickBots={quickBots} />;
}
