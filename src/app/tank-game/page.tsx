"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { makeRoomId } from "@/lib/player";
import { playClick } from "@/lib/sound";
import { KILL_TARGET } from "@shared/tankTypes";

export default function TankGameHomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  function handleCreate() {
    playClick();
    router.push(`/tank-game/${makeRoomId()}`);
  }

  function handleJoin() {
    playClick();
    const code = joinCode.trim().toUpperCase();
    if (!code) return alert("Nhập mã phòng!");
    router.push(`/tank-game/${code}`);
  }

  return (
    <main className="flex min-h-app items-center justify-center bg-tank-scene px-4">
      <div className="w-full max-w-xl rounded-xl border border-cream-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-lg text-white">🎯</div>
          <span className="text-base font-semibold tracking-tight text-ink">Đại Chiến Xe Tăng</span>
        </div>

        <h1 className="mb-1 text-2xl font-bold text-ink">Bắn nhau cùng hội bạn</h1>
        <p className="mb-6 text-sm text-ink/60">Tối đa 4 người, ai đủ {KILL_TARGET} điểm tiêu diệt trước thì thắng.</p>

        <button
          onClick={handleCreate}
          className="mb-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
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
            className="min-w-0 flex-1 rounded-lg border border-cream-200 px-3.5 py-2.5 font-mono text-sm uppercase tracking-wider text-ink outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            placeholder="MÃ PHÒNG"
            maxLength={8}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
          <button
            onClick={handleJoin}
            className="shrink-0 rounded-lg border border-cream-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink/70 transition hover:border-slate-500 hover:text-slate-700"
          >
            Vào
          </button>
        </div>

        <Link href="/" className="mt-8 block text-center text-xs font-medium text-ink/40 hover:text-ink/70">
          ← Về game vẽ đoán chữ
        </Link>
      </div>
    </main>
  );
}
