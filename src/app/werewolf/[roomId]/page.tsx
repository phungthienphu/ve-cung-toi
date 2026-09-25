"use client";

/* eslint-disable @next/next/no-img-element -- DiceBear returns generated SVG avatars. */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreatePlayerId, getStoredName, setStoredName } from "@/lib/player";
import { werewolfAvatarUrl } from "@/lib/werewolfAvatar";
import { werewolfFontClass } from "@/lib/werewolfFonts";
import WerewolfGameRoom from "@/components/werewolf/WerewolfGameRoom";

export default function WerewolfRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [playerId, setPlayerId] = useState("");
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    setPlayerId(getOrCreatePlayerId());
    setName(getStoredName());
    setConfirmed(sessionStorage.getItem(`vct_werewolf:${roomId}`) === "1");
  }, [roomId]);
  if (!playerId) return null;

  const enter = () => {
    const clean = name.trim();
    if (!clean) return;
    setStoredName(clean);
    sessionStorage.setItem(`vct_werewolf:${roomId}`, "1");
    setName(clean);
    setConfirmed(true);
  };

  if (!confirmed) {
    return (
      <main data-time="night" className={`${werewolfFontClass} werewolf-root bg-werewolf-scene flex min-h-app items-center justify-center px-4 text-[var(--ww-text)]`}>
        <section className="w-full max-w-sm rounded-xl border border-[var(--ww-border)] bg-[var(--ww-surface)] p-7 text-center shadow-2xl backdrop-blur-md">
          <div className="text-5xl drop-shadow-[0_0_20px_rgba(167,139,250,0.7)]">🌕</div>
          <h1 className="mt-3 font-ww-display text-2xl font-bold">Gia nhập ngôi làng</h1>

          <div className="mx-auto mt-4 w-fit rounded-md border border-dashed border-[var(--ww-border-strong)] bg-[var(--ww-accent-soft)] px-5 py-2">
            <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--ww-text-faint)]">Mã phòng</div>
            <div className="font-mono text-xl font-bold tracking-[0.3em] text-[var(--ww-accent)]">{roomId}</div>
          </div>

          <img
            src={werewolfAvatarUrl(playerId)}
            alt=""
            className="mx-auto mt-5 h-20 w-20 rounded-full border-2 border-[var(--ww-border-strong)] bg-[var(--ww-surface-soft)] shadow-lg"
          />
          <p className="mt-1 text-[11px] text-[var(--ww-text-faint)]">Đây là gương mặt của bạn trong làng</p>

          <label className="mt-5 block text-left text-xs font-semibold uppercase tracking-wider text-[var(--ww-text-faint)]">Tên hiển thị</label>
          <input
            autoFocus
            value={name}
            maxLength={20}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && enter()}
            placeholder="Ví dụ: Phú"
            className="mt-1.5 w-full rounded-md border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] px-4 py-3 outline-none placeholder:text-[var(--ww-text-faint)] focus:border-[var(--ww-accent)]"
          />
          <button
            onClick={enter}
            disabled={!name.trim()}
            className="mt-4 w-full rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 py-3 font-ww-display font-bold shadow-lg transition hover:brightness-110 disabled:opacity-50"
          >
            Vào làng 🐺
          </button>
          <Link href="/werewolf" className="mt-4 block text-xs text-[var(--ww-text-muted)] hover:text-[var(--ww-text)]">← Về sảnh Ma Sói</Link>
        </section>
      </main>
    );
  }
  return <WerewolfGameRoom roomId={roomId} playerId={playerId} name={name} />;
}
