"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { btnGhost, btnPrimary } from "@/components/oldmaid/panels";
import { drawFontClass } from "@/lib/drawFonts";
import { makeRoomId } from "@/lib/player";
import { playClick } from "@/lib/sound";
import type { OldMaidRoomListing } from "@shared/oldMaidTypes";

const ROOM_LIST_POLL_MS = 4000;

const STEPS = [
  { icon: "🃏", title: "Chia bài", text: "52 lá + 1 Joker là con heo. Đôi cùng số tự bay ra giữa bàn." },
  { icon: "👉", title: "Rút bài", text: "Tới lượt, rút úp 1 lá của người bên phải. Cả bàn thấy bạn đang nhắm lá nào!" },
  { icon: "☝️", title: "Nhử & xào", text: "Bị rút thì nhử 1 lá hoặc xào bài để dụ người ta bốc trúng heo." },
  { icon: "🐷", title: "Ai là heo?", text: "Hết bài là thoát. Ai ôm Joker cuối cùng là HEO — đội mũ heo tới ván sau." },
];

export default function OldMaidHomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [bots, setBots] = useState(3);
  const [rooms, setRooms] = useState<OldMaidRoomListing[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/oldmaid-rooms", { cache: "no-store" });
        if (res.ok && alive) setRooms((await res.json()) as OldMaidRoomListing[]);
      } catch {
        // Keep the current list; the next poll retries.
      } finally {
        if (alive) setLoaded(true);
      }
    };
    load();
    const timer = setInterval(load, ROOM_LIST_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const join = () => {
    const value = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value) router.push(`/ai-la-heo/${value}`);
  };

  return (
    <main className={`${drawFontClass} bg-heo-room min-h-app px-4 pb-24 pt-8 text-white sm:pt-12`}>
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm text-white/55 hover:text-white">
          ‹ Trang chủ
        </Link>
        <header className="mt-4 text-center">
          <div className="text-7xl drop-shadow-[0_10px_30px_rgba(255,120,170,0.35)]">🐷</div>
          <h1 className="mt-2 font-draw-display text-5xl font-extrabold tracking-tight sm:text-6xl">
            Ai Là{" "}
            <span className="bg-gradient-to-r from-[#ffb3cb] via-[#ff7aa0] to-[#ffd36e] bg-clip-text text-transparent">Heo</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-white/70">Rút bài 3D cùng hội bạn: nhử nhau, đọc nhau, ai giữ lá Joker cuối cùng là HEO!</p>
        </header>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="space-y-4 rounded-3xl bg-white/[0.05] p-5 ring-1 ring-white/10">
            <button type="button" onClick={() => { playClick(); router.push(`/ai-la-heo/${makeRoomId()}`); }} className={`${btnPrimary} w-full py-3.5`}>
              🃏 Tạo bàn mới
            </button>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-sm font-bold">🤖 Chơi với bot ngay</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  {[1, 2, 3, 4, 5].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setBots(count)}
                      className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${bots === count ? "bg-amber-300 text-amber-950" : "bg-white/10 text-white/80 hover:bg-white/15"}`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => { playClick(); router.push(`/ai-la-heo/${makeRoomId()}?bots=${bots}`); }} className={btnGhost}>
                  Chơi ▶
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/45">
              <span className="h-px flex-1 bg-white/10" />
              hoặc nhập mã bàn
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="flex gap-2">
              <input
                value={code}
                maxLength={10}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && join()}
                placeholder="MÃ BÀN"
                aria-label="Mã bàn"
                className="min-w-0 flex-1 rounded-2xl bg-white/10 px-4 py-3 text-center font-mono uppercase tracking-[0.3em] outline-none ring-1 ring-white/10 placeholder:tracking-normal placeholder:text-white/35 focus:ring-amber-300"
              />
              <button type="button" onClick={join} disabled={!code.trim()} className={btnGhost}>
                Vào
              </button>
            </div>
          </section>

          <section className="rounded-3xl bg-white/[0.05] p-5 ring-1 ring-white/10">
            <h2 className="font-bold">🌐 Bàn đang mở</h2>
            {!loaded ? (
              <p className="mt-4 animate-pulse text-sm text-white/45">Đang tìm bàn…</p>
            ) : rooms.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/50">Chưa có bàn công khai nào — tạo bàn đầu tiên nhé!</p>
            ) : (
              <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {rooms.map((room) => {
                  const full = room.playerCount >= room.maxPlayers;
                  return (
                    <li key={room.roomId} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black tracking-widest">{room.roomId}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${room.status === "playing" ? "bg-amber-400/20 text-amber-200" : "bg-emerald-400/20 text-emerald-200"}`}>
                            {room.status === "playing" ? "Đang chơi" : "Đang chờ"}
                          </span>
                        </div>
                        <div className="truncate text-xs text-white/55">
                          👑 {room.hostName || "—"} · {room.playerCount}/{room.maxPlayers} người
                        </div>
                      </div>
                      <button type="button" onClick={() => router.push(`/ai-la-heo/${room.roomId}`)} className={btnGhost}>
                        {room.status === "playing" || full ? "Xem" : "Vào"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section className="mt-10">
          <h2 className="font-draw-display text-2xl font-extrabold">Chơi thế nào?</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-3xl bg-white/[0.05] p-5 ring-1 ring-white/10">
                <span className="text-3xl">{step.icon}</span>
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-white/40">Bước {index + 1}</p>
                <h3 className="font-draw-display text-lg font-extrabold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/65">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-8 flex justify-center gap-5 text-sm">
          <Link href="/leaderboard?game=oldmaid" className="text-amber-200 hover:underline">
            🏆 Lịch sử ván
          </Link>
        </div>
      </div>
    </main>
  );
}
