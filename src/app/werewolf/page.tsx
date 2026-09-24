"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { makeRoomId } from "@/lib/player";
import type { WerewolfRoomListing } from "@shared/werewolfTypes";

const ROOM_LIST_POLL_MS = 4000;

export default function WerewolfHomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState<WerewolfRoomListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function loadRooms() {
    try {
      const res = await fetch("/api/werewolf-rooms", { cache: "no-store" });
      if (res.ok) setRooms((await res.json()) as WerewolfRoomListing[]);
    } catch {
      // Keep whatever list is already showing; the next poll retries.
    }
  }
  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, ROOM_LIST_POLL_MS);
    return () => clearInterval(interval);
  }, []);
  async function refresh() {
    setRefreshing(true);
    await loadRooms();
    setRefreshing(false);
  }

  const join = () => { const value = code.trim().toUpperCase(); if (value) router.push(`/werewolf/${value}`); };
  return (
    <main className="flex min-h-app items-center justify-center bg-gradient-to-b from-slate-950 via-violet-950 to-slate-900 px-4 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/70 p-7 shadow-2xl backdrop-blur sm:p-10">
        <div className="mb-6 text-5xl">🐺</div>
        <h1 className="text-3xl font-bold">Ma Sói Cùng Phòng</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">Mọi vai đều hành động trong đêm. Không còn bị lộ chỉ vì tiếng chuột hay bàn phím.</p>
        <button onClick={() => router.push(`/werewolf/${makeRoomId()}`)} className="mt-7 w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400">Tạo phòng mới</button>
        <div className="my-5 flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-white/10" />hoặc nhập mã phòng<span className="h-px flex-1 bg-white/10" /></div>
        <div className="flex gap-2">
          <input value={code} maxLength={8} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && join()} placeholder="MÃ PHÒNG" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono uppercase outline-none focus:border-violet-400" />
          <button onClick={join} className="rounded-xl border border-white/15 px-5 font-semibold hover:bg-white/10">Vào</button>
        </div>
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Danh sách phòng</h2>
            <button onClick={refresh} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/10">
              <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>🔄</span> Làm mới
            </button>
          </div>
          {rooms.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-slate-500">Chưa có phòng nào — tạo phòng mới nhé!</p>
          ) : (
            <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {rooms.map((room) => (
                <li key={room.roomId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold tracking-wider">{room.roomId}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${room.status === "playing" ? "bg-amber-400/20 text-amber-300" : "bg-emerald-400/20 text-emerald-300"}`}>
                        {room.status === "playing" ? "Đang chơi" : "Đang chờ"}
                      </span>
                    </div>
                    <div className="truncate text-xs text-slate-400">Chủ phòng: {room.hostName || "—"} · {room.playerCount}/{room.maxPlayers} người</div>
                  </div>
                  <button onClick={() => router.push(`/werewolf/${room.roomId}`)} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold hover:bg-violet-400">Vào</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-6 text-xs leading-5 text-slate-500">Avatar tạo bởi <a className="underline" href="https://www.dicebear.com/styles/adventurer/" target="_blank" rel="noreferrer">DiceBear Adventurer</a> · artwork của Lisa Wischofsky · CC BY 4.0.</p>
        <Link href="/werewolf/preview" className="mt-5 block text-center text-xs font-medium text-violet-300 hover:text-violet-200">View as</Link>
        <Link href="/" className="mt-6 block text-center text-sm text-slate-400 hover:text-white">← Về trang chủ</Link>
      </section>
    </main>
  );
}
