"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { makeRoomId } from "@/lib/player";
import { werewolfFontClass } from "@/lib/werewolfFonts";
import { playClick } from "@/lib/sound";
import { RoleArtwork } from "@/components/werewolf/ui";
import { ROLE_LABELS, type WerewolfRole, type WerewolfRoomListing } from "@shared/werewolfTypes";

const ROOM_LIST_POLL_MS = 4000;
const SHOWCASE_ROLES: WerewolfRole[] = ["wolf", "seer", "guardian", "witch", "villager"];

const HOW_IT_WORKS = [
  { icon: "🌙", title: "Đêm xuống", text: "Ai cũng có nỗi bận tâm riêng của mình...." },
  { icon: "☀️", title: "Trời sáng", text: "Cả làng thảo luận, chất vấn, tìm ra kẻ đáng ngờ." },
  { icon: "🗳️", title: "Bỏ phiếu", text: "Phiếu và lý do được công khai. Ai sẽ bị xử bắn?" },
];

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
    playClick();
    setRefreshing(true);
    await loadRooms();
    setRefreshing(false);
  }

  const join = () => {
    const value = code.trim().toUpperCase();
    if (value) router.push(`/werewolf/${value}`);
  };

  return (
    <main data-time="night" className={`${werewolfFontClass} werewolf-root bg-werewolf-scene min-h-app px-4 py-10 text-[var(--ww-text)] sm:py-14`}>
      <div className="mx-auto max-w-5xl">
        <header className="text-center">
          <div className="text-6xl drop-shadow-[0_0_24px_rgba(167,139,250,0.7)]">🌕</div>
          <h1 className="mt-3 font-ww-display text-5xl font-extrabold tracking-tight sm:text-6xl">Ma Sói</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--ww-text-muted)] sm:text-base">
            Trò chơi suy luận cho cả nhóm. Mọi vai đều hành động trong đêm, nên không ai bị lộ chỉ vì tiếng chuột hay bàn phím.
          </p>
          <div className="mt-6 flex justify-center gap-2 sm:gap-3">
            {SHOWCASE_ROLES.map((role, index) => (
              <div key={role} title={ROLE_LABELS[role]} className="w-14 overflow-hidden rounded-md border border-[var(--ww-border-strong)] bg-[var(--ww-surface)] shadow-lg transition hover:-translate-y-1.5 sm:w-20" style={{ transform: `rotate(${(index - 2) * 3}deg)` }}>
                <RoleArtwork role={role} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </header>

        <div className="mt-9 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-xl border border-[var(--ww-border)] bg-[var(--ww-surface)] p-6 shadow-2xl backdrop-blur-md sm:p-7">
            <button
              onClick={() => {
                playClick();
                router.push(`/werewolf/${makeRoomId()}`);
              }}
              className="w-full rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 font-ww-display text-lg font-bold shadow-lg shadow-violet-900/40 transition hover:-translate-y-0.5 hover:brightness-110"
            >
              🐺 Tạo phòng mới
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-[var(--ww-text-faint)]">
              <span className="h-px flex-1 bg-[var(--ww-border)]" />
              hoặc nhập mã phòng
              <span className="h-px flex-1 bg-[var(--ww-border)]" />
            </div>
            <div className="flex gap-2">
              <input
                value={code}
                maxLength={8}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && join()}
                placeholder="MÃ PHÒNG"
                className="min-w-0 flex-1 rounded-md border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] px-4 py-3 text-center font-mono uppercase tracking-[0.3em] outline-none placeholder:tracking-normal placeholder:text-[var(--ww-text-faint)] focus:border-[var(--ww-accent)]"
              />
              <button onClick={join} className="rounded-md border border-[var(--ww-border-strong)] bg-[var(--ww-accent-soft)] px-6 font-semibold text-[var(--ww-accent)] transition hover:brightness-125">
                Vào
              </button>
            </div>

            <ul className="mt-6 space-y-3">
              {HOW_IT_WORKS.map((step) => (
                <li key={step.title} className="flex gap-3 rounded-md bg-[var(--ww-surface-soft)] px-3 py-2.5">
                  <span className="text-2xl">{step.icon}</span>
                  <div>
                    <div className="text-sm font-bold">{step.title}</div>
                    <div className="text-xs leading-5 text-[var(--ww-text-muted)]">{step.text}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-[var(--ww-border)] bg-[var(--ww-surface)] p-6 shadow-2xl backdrop-blur-md sm:p-7">
            <div className="flex items-center justify-between">
              <h2 className="font-ww-display text-lg font-bold">Ngôi làng đang mở</h2>
              <button onClick={refresh} className="rounded-md border border-[var(--ww-border)] px-3 py-1 text-xs text-[var(--ww-text-muted)] transition hover:text-[var(--ww-text)]">
                <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>🔄</span> Làm mới
              </button>
            </div>
            {rooms.length === 0 ? (
              <div className="mt-4 rounded-md border border-dashed border-[var(--ww-border)] px-4 py-10 text-center">
                <div className="text-4xl opacity-70">🏚️</div>
                <p className="mt-2 text-sm text-[var(--ww-text-muted)]">Chưa có ngôi làng nào. Hãy tạo phòng đầu tiên nhé!</p>
              </div>
            ) : (
              <ul className="mt-4 max-h-[26rem] space-y-2.5 overflow-y-auto pr-1">
                {rooms.map((room) => {
                  const playing = room.status === "playing";
                  return (
                    <li key={room.roomId} className="flex items-center gap-3 rounded-md border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] px-4 py-3 transition hover:border-[var(--ww-border-strong)]">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold tracking-widest">{room.roomId}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${playing ? "bg-amber-400/20 text-amber-300" : "bg-emerald-400/20 text-emerald-300"}`}>
                            {playing ? "Đang chơi" : "Đang chờ"}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[var(--ww-text-muted)]">
                          👑 {room.hostName || "—"} · {room.playerCount}/{room.maxPlayers} người
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/werewolf/${room.roomId}`)}
                        className="rounded-md bg-[var(--ww-accent-strong)] px-4 py-2 text-sm font-semibold text-[var(--ww-accent-ink)] transition hover:brightness-110"
                      >
                        Vào
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <footer className="mt-8 space-y-3 text-center text-xs text-[var(--ww-text-faint)]">
          <div className="flex justify-center gap-5 text-sm">
            <Link href="/leaderboard?game=werewolf" className="text-[var(--ww-accent)] hover:underline">🏆 Lịch sử trận</Link>
            <Link href="/werewolf/preview" className="text-[var(--ww-text-muted)] hover:text-[var(--ww-text)]">View as</Link>
            <Link href="/" className="text-[var(--ww-text-muted)] hover:text-[var(--ww-text)]">← Trang chủ</Link>
          </div>
          <p>
            Avatar tạo bởi <a className="underline" href="https://www.dicebear.com/styles/adventurer/" target="_blank" rel="noreferrer">DiceBear Adventurer</a> · artwork của Lisa Wischofsky · CC BY 4.0.
          </p>
        </footer>
      </div>
    </main>
  );
}
