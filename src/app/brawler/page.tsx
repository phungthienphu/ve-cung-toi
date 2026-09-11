"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { makeRoomId } from "@/lib/player";
import { playClick } from "@/lib/sound";
import { MAX_BRAWLER_PLAYERS } from "@shared/brawlerTypes";

export default function BrawlerHomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  function handleCreate() {
    playClick();
    router.push(`/brawler/${makeRoomId()}`);
  }

  function handleJoin() {
    playClick();
    const target = joinCode.trim().toUpperCase();
    if (!target) return alert("Nhập mã phòng!");
    router.push(`/brawler/${target}`);
  }

  return (
    <main className="flex min-h-app items-center justify-center bg-brawler-scene px-4">
      <div className="w-full max-w-xl rounded-xl border border-cream-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-lg text-white">⚔️</div>
          <span className="text-base font-semibold tracking-tight text-ink">Đại Chiến Tí Hon</span>
        </div>

        <h1 className="mb-1 text-2xl font-bold text-ink">Đối kháng cùng hội bạn</h1>
        <p className="mb-6 text-sm text-ink/60">Tối đa {MAX_BRAWLER_PLAYERS} người, ai hết tim thì bị loại.</p>

        <button
          onClick={handleCreate}
          className="mb-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
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
            className="min-w-0 flex-1 rounded-lg border border-cream-200 px-3.5 py-2.5 font-mono text-sm uppercase tracking-wider text-ink outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            placeholder="MÃ PHÒNG"
            maxLength={8}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
          <button
            onClick={handleJoin}
            className="shrink-0 rounded-lg border border-cream-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink/70 transition hover:border-amber-500 hover:text-amber-700"
          >
            Vào
          </button>
        </div>

        <Link href="/" className="mt-8 block text-center text-xs font-medium text-ink/40 hover:text-ink/70">
          ← Về trang chủ
        </Link>
      </div>
    </main>
  );
}
