"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreatePlayerId, getStoredName, setStoredName } from "@/lib/player";
import { drawFontClass } from "@/lib/drawFonts";
import MathBossRoom from "@/components/mathboss/MathBossRoom";
import { GRADES, type Grade } from "@shared/mathBossTypes";

const GRADE_KEY = "vct_mathboss_grade";

export default function MathBossRoomPage({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams: Promise<{ host?: string }> }) {
  const { roomId } = use(params);
  const isHost = use(searchParams).host === "1";
  const [playerId, setPlayerId] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<Grade>(8);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    setPlayerId(getOrCreatePlayerId());
    setName(getStoredName());
    if (localStorage.getItem(GRADE_KEY) === "9") setGrade(9);
    setConfirmed(sessionStorage.getItem(`vct_mathboss:${roomId}`) === "1");
  }, [roomId]);
  if (!playerId) return null;

  // The projector screen gets its own id, so the tutor can also open a
  // student view in another tab of the same browser to try things out.
  if (isHost) return <MathBossRoom roomId={roomId} playerId={`${playerId}-host`} name="" grade={8} role="host" />;

  const enter = () => {
    const clean = name.trim();
    if (!clean) return;
    setStoredName(clean);
    localStorage.setItem(GRADE_KEY, String(grade));
    sessionStorage.setItem(`vct_mathboss:${roomId}`, "1");
    setName(clean);
    setConfirmed(true);
  };

  if (!confirmed) {
    return (
      <main className={`${drawFontClass} bg-mathboss flex min-h-app items-center justify-center px-4 text-white`}>
        <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur">
          <div className="text-5xl">⚔️</div>
          <h1 className="mt-2 font-draw-display text-3xl font-extrabold">Vào trận</h1>
          <p className="mt-1 font-mono text-lg tracking-[0.3em] text-amber-300">Phòng {roomId}</p>
          <label className="mt-5 block text-left text-xs font-semibold uppercase tracking-wider text-violet-200">Tên của bạn</label>
          <input
            autoFocus
            value={name}
            maxLength={20}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && enter()}
            placeholder="Ví dụ: Minh"
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-lg outline-none placeholder:text-violet-300/60 focus:border-amber-300"
          />
          <p className="mt-4 text-left text-xs font-semibold uppercase tracking-wider text-violet-200">Bạn học lớp</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {GRADES.map((option) => (
              <button
                key={option}
                onClick={() => setGrade(option)}
                className={`rounded-xl border-2 py-3 font-draw-display text-2xl font-extrabold transition ${
                  grade === option ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-white/10 bg-white/5 text-violet-200"
                }`}
              >
                Lớp {option}
              </button>
            ))}
          </div>
          <button onClick={enter} disabled={!name.trim()} className="mt-4 w-full rounded-xl bg-amber-400 py-3 font-draw-display text-xl font-extrabold text-violet-950 disabled:opacity-40">
            Vào trận ⚔️
          </button>
          <Link href="/math-boss" className="mt-4 block text-xs text-violet-300 hover:text-white">← Nhập mã khác</Link>
        </section>
      </main>
    );
  }
  return <MathBossRoom roomId={roomId} playerId={playerId} name={name} grade={grade} role="player" />;
}
