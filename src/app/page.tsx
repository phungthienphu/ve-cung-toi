"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStoredName, makeRoomId, setStoredName } from "@/lib/player";
import { playClick } from "@/lib/sound";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    setName(getStoredName());
  }, []);

  function persistName() {
    const trimmed = name.trim().slice(0, 20);
    if (trimmed) setStoredName(trimmed);
    return trimmed;
  }

  function handleCreate() {
    playClick();
    const trimmed = persistName();
    if (!trimmed) return alert("Nhập tên của bạn trước đã!");
    router.push(`/room/${makeRoomId()}`);
  }

  function handleJoin() {
    playClick();
    const trimmed = persistName();
    if (!trimmed) return alert("Nhập tên của bạn trước đã!");
    const code = joinCode.trim().toUpperCase();
    if (!code) return alert("Nhập mã phòng!");
    router.push(`/room/${code}`);
  }

  return (
    <main className="bg-home-scene flex min-h-dvh justify-center items-center p-6 sm:p-10 lg:p-32">
      <div className="w-full max-w-xl rounded-lg bg-white/95 p-8 shadow-2xl">
        <div className="w-full">
          <div className="mb-10 flex items-center gap-2.5">
            
            <span className="text-xl font-bold tracking-tight text-ink">Vẽ Cùng Tôi</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-ink">Vẽ &amp; đoán chữ cùng bạn bè</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink/60">
            Không cần tài khoản. Tạo phòng, gửi link cho bạn bè, chơi ngay trên trình duyệt.
          </p>

          <div className="mt-8">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink/50">Tên hiển thị</label>
            <input
              className="mb-4 w-full rounded-lg border border-cream-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-clay-500 focus:ring-1 focus:ring-clay-500"
              placeholder="Ví dụ: Phú"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <button
              onClick={handleCreate}
              className="mb-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-clay-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-clay-500/30 transition hover:bg-clay-600 active:bg-clay-700"
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
                className="flex-1 rounded-lg border border-cream-200 bg-white px-3.5 py-2.5 font-mono text-sm uppercase tracking-wider text-ink outline-none transition focus:border-clay-500 focus:ring-1 focus:ring-clay-500"
                placeholder="MÃ PHÒNG"
                maxLength={8}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              <button
                onClick={handleJoin}
                className="shrink-0 rounded-lg border border-cream-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink/70 transition hover:border-clay-500 hover:text-clay-600"
              >
                Vào
              </button>
            </div>
          </div>

          <div className="mt-10 flex items-center gap-4 text-xs text-ink/40">
            <span>Tối đa 8 người / phòng</span>
            <span className="text-ink/20">•</span>
            <Link href="/leaderboard" className="font-medium text-clay-600 transition hover:text-clay-700">
              Bảng xếp hạng →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
