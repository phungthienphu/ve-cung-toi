"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { MathBossPhase, MathBossPlayer, Shot } from "@shared/mathBossTypes";
import { Arena } from "@/components/mathboss/Arena";
import { drawFontClass } from "@/lib/drawFonts";

// A sandbox for the battle scene: fake players, buttons that act out every
// situation (hits, misses, the monster's counter-attack, a combo, the rage
// wave, the final blow) — so the look can be judged without a room full of
// phones.

const PLAYERS: MathBossPlayer[] = [
  { id: "a", name: "Minh", grade: 8, connected: true, hero: { weapon: "bow", color: "red" } },
  { id: "b", name: "Hiếu", grade: 9, connected: true, hero: { weapon: "gun", color: "cyan" } },
];
const MAX_HP = 400;
const id = () => Math.random().toString(36).slice(2, 9);

export default function MathBossPreview() {
  const [phase, setPhase] = useState<MathBossPhase>("question");
  const [round, setRound] = useState(() => ({ startedAt: Date.now(), endsAt: Date.now() + 35_000 }));
  const [shots, setShots] = useState<Shot[]>([]);
  const [hp, setHp] = useState(MAX_HP);
  const [outcome, setOutcome] = useState<{ roundId: string; damage: number; combo: boolean } | null>(null);
  const [rage, setRage] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearPending = () => {
    pending.current.forEach(clearTimeout);
    pending.current = [];
  };
  const newRound = (durationMs = 35_000) => {
    clearPending();
    setPhase("question");
    setShots([]);
    setOutcome(null);
    setRound({ startedAt: Date.now(), endsAt: Date.now() + durationMs });
  };
  const fire = (playerId: string, hit: boolean) => {
    if (phase !== "question") newRound();
    setShots((list) => [...list, { id: id(), playerId, hit }]);
    if (hit) setHp((value) => Math.max(0, value - 10));
  };
  const endRound = () => {
    setOutcome({ roundId: id(), damage: shots.filter((shot) => shot.hit).length * 10, combo: false });
    setPhase("result");
  };
  const playCombo = () => {
    newRound();
    pending.current.push(setTimeout(() => setShots([{ id: id(), playerId: "a", hit: true }]), 300));
    pending.current.push(setTimeout(() => setShots((list) => [...list, { id: id(), playerId: "b", hit: true }]), 700));
    pending.current.push(
      setTimeout(() => {
        setHp((value) => Math.max(0, value - 30));
        setOutcome({ roundId: id(), damage: 30, combo: true });
        setPhase("result");
      }, 1900)
    );
  };

  const button = "rounded-xl border-2 border-white/15 bg-white/10 px-3 py-2 text-sm font-bold transition hover:bg-white/20";
  return (
    <main className={`${drawFontClass} bg-mathboss min-h-app px-5 py-5 text-white`}>
      <div className="mx-auto max-w-6xl">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-draw-display text-2xl font-extrabold">🧪 Xem trước cảnh đánh boss</h1>
          <Link href="/math-boss" className="text-sm text-violet-300 hover:text-white">← Quái Máy Tính</Link>
        </div>
        <p className="mt-1 text-sm text-violet-200">Dữ liệu giả, không cần phòng. Bấm các nút bên dưới để diễn từng tình huống.</p>

        <div className="mt-5">
          <Arena
            players={PLAYERS}
            phase={phase}
            shots={shots}
            startedAt={phase === "question" ? round.startedAt : null}
            endsAt={phase === "question" ? round.endsAt : null}
            rage={rage}
            bossHp={hp}
            bossMaxHp={MAX_HP}
            shotDamage={10}
            roundId={phase === "result" ? outcome?.roundId ?? null : null}
            roundDamage={phase === "result" ? outcome?.damage ?? 0 : 0}
            combo={phase === "result" && Boolean(outcome?.combo)}
            comboDamage={10}
            speech={phase === "question" ? "Đỡ chiêu này!" : phase === "result" ? ((outcome?.damage ?? 0) > 0 ? (outcome?.combo ? "Á á, COMBO!!" : "Úi da!") : "Hơ hơ, trượt rồi!") : null}
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <section>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Trong lượt</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={button} onClick={() => fire("a", true)}>🏹 Minh bắn trúng</button>
              <button className={button} onClick={() => fire("b", true)}>🔫 Hiếu bắn trúng</button>
              <button className={button} onClick={() => fire("a", false)}>💨 Minh trượt</button>
              <button className={button} onClick={() => fire("b", false)}>💨 Hiếu trượt</button>
              <button className={button} onClick={() => newRound(6_000)}>⏩ Lượt 6 giây (xem quái đi)</button>
            </div>
          </section>
          <section>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Kết thúc lượt</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={button} onClick={endRound}>✅ Kết thúc (theo số phát trúng)</button>
              <button className={button} onClick={() => { setShots([]); setOutcome({ roundId: id(), damage: 0, combo: false }); setPhase("result"); }}>😈 Không ai trúng — quái vồ</button>
              <button className={button} onClick={playCombo}>⚡ Cả hai trúng — COMBO</button>
            </div>
          </section>
          <section>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Cảnh khác</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={button} onClick={() => newRound()}>🔁 Lượt mới</button>
              <button className={button} onClick={() => setRage((value) => !value)}>{rage ? "😌 Tắt nổi giận" : "😡 Đợt nổi giận"}</button>
              <button className={button} onClick={() => { clearPending(); setPhase("pick"); }}>👥 Màn chọn nhân vật</button>
              <button className={button} onClick={() => { clearPending(); setHp(0); setPhase("victory"); }}>🏆 Hạ boss</button>
              <button className={button} onClick={() => { setHp(MAX_HP); newRound(); }}>❤️ Hồi máu boss</button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
