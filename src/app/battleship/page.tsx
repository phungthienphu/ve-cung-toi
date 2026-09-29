"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { makeRoomId } from "@/lib/player";
import { playClick } from "@/lib/sound";
import { MODE_LABELS, type BattleshipRoomListing } from "@shared/battleshipTypes";
import { btnGhost, btnPrimary, card } from "@/components/battleship/ui";

const ROOM_LIST_POLL_MS = 4000;

export default function BattleshipHomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState<BattleshipRoomListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function loadRooms() {
    try {
      const res = await fetch("/api/battleship-rooms", { cache: "no-store" });
      if (res.ok) setRooms((await res.json()) as BattleshipRoomListing[]);
    } catch {
      // Keep the current list; the next poll retries.
    }
  }
  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, ROOM_LIST_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const join = () => {
    const value = code.trim().toUpperCase();
    if (value) router.push(`/battleship/${value}`);
  };

  return (
    <main className="bg-sea min-h-app px-4 py-10 text-sky-50 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <header className="text-center">
          <div className="text-6xl">🚢</div>
          <h1 className="mt-2 text-5xl font-extrabold tracking-tight">Hải Chiến</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-sky-100/70">
            Giấu hạm đội, đoán tọa độ, nã pháo. Chơi Solo 1 vs 1, Hỗn chiến tới 8 người, hoặc chia 2 đội.
          </p>
        </header>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className={`${card} p-5`}>
            <button onClick={() => { playClick(); router.push(`/battleship/${makeRoomId()}`); }} className={`${btnPrimary} w-full py-3.5 text-base`}>
              ⚓ Tạo phòng mới
            </button>
            <div className="my-4 flex items-center gap-3 text-xs text-sky-100/50">
              <span className="h-px flex-1 bg-white/10" />hoặc nhập mã phòng<span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="flex gap-2">
              <input
                value={code}
                maxLength={8}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && join()}
                placeholder="MÃ PHÒNG"
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-4 py-3 text-center font-mono uppercase tracking-[0.3em] outline-none placeholder:tracking-normal placeholder:text-sky-100/40 focus:border-amber-300"
              />
              <button onClick={join} className={btnGhost}>Vào</button>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-sky-100/80">
              <li>🧭 <b className="text-sky-50">Xếp tàu:</b> 60 giây giấu hạm đội trên lưới.</li>
              <li>🎯 <b className="text-sky-50">Nã pháo:</b> chọn tọa độ, trúng thì lửa bốc, trượt thì tõm nước.</li>
              <li>🏆 <b className="text-sky-50">Chiến thắng:</b> đánh chìm toàn bộ hạm đội đối thủ.</li>
            </ul>
          </section>

          <section className={`${card} p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Danh sách phòng</h2>
              <button
                onClick={async () => { playClick(); setRefreshing(true); await loadRooms(); setRefreshing(false); }}
                className={btnGhost}
              >
                <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>🔄</span> Làm mới
              </button>
            </div>
            {rooms.length === 0 ? (
              <p className="mt-4 rounded-md border border-dashed border-white/10 px-4 py-8 text-center text-sm text-sky-100/50">Chưa có phòng nào — tạo phòng đầu tiên nhé!</p>
            ) : (
              <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {rooms.map((room) => (
                  <li key={room.roomId} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold tracking-widest">{room.roomId}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${room.status === "playing" ? "bg-amber-400/20 text-amber-200" : "bg-emerald-400/20 text-emerald-200"}`}>
                          {room.status === "playing" ? "Đang chơi" : "Đang chờ"}
                        </span>
                      </div>
                      <div className="truncate text-xs text-sky-100/60">👑 {room.hostName || "—"} · {MODE_LABELS[room.mode] ?? ""} · {room.playerCount}/{room.maxPlayers}</div>
                    </div>
                    <button onClick={() => router.push(`/battleship/${room.roomId}`)} className={btnPrimary}>Vào</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="mt-8 flex justify-center gap-5 text-sm">
          <Link href="/leaderboard?game=battleship" className="text-amber-200 hover:underline">🏆 Lịch sử trận</Link>
          <Link href="/" className="text-sky-100/70 hover:text-sky-50">← Trang chủ</Link>
        </div>
      </div>
    </main>
  );
}
