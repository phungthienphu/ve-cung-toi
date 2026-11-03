"use client";

import { useEffect, useState } from "react";
import { MathText } from "./MathText";

export type BossMood = "idle" | "hit" | "taunt" | "defeated" | "rage";

const KEYS = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "=", "+"];

/**
 * Quái Máy Tính: a grumpy calculator drawn in plain HTML/CSS. Its LCD shows
 * whatever it is "typing" — during a question that typing is the countdown.
 */
export function Boss({ mood, screen, speech, small = false }: { mood: BossMood; screen: React.ReactNode; speech?: string | null; small?: boolean }) {
  const moodClass = mood === "hit" ? "mb-hit" : mood === "taunt" ? "mb-taunt" : mood === "defeated" ? "mb-defeat" : "mb-float";
  const body = mood === "rage"
    ? "from-rose-500 to-rose-800 shadow-[0_20px_70px_-10px_rgba(244,63,94,0.75)]"
    : "from-violet-500 to-violet-800 shadow-[0_20px_70px_-10px_rgba(168,85,247,0.65)]";

  return (
    <div className={`relative mx-auto ${small ? "w-40" : "w-56 sm:w-64"}`}>
      {speech && (
        <div className="animate-bounce-in absolute -top-14 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-2xl border-2 border-violet-950 bg-white px-4 py-2 font-draw-display text-lg font-bold text-violet-950 shadow-lg">
          {speech}
          <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-violet-950 bg-white" />
        </div>
      )}
      <div className={`relative ${moodClass}`}>
        {/* horns */}
        <span className="absolute -top-5 left-7 h-0 w-0 border-x-[13px] border-b-[26px] border-x-transparent border-b-fuchsia-400" />
        <span className="absolute -top-5 right-7 h-0 w-0 border-x-[13px] border-b-[26px] border-x-transparent border-b-fuchsia-400" />
        <div className={`relative rounded-[28px] border-4 border-violet-950 bg-gradient-to-b p-3.5 ${body}`}>
          <div className="flex justify-center gap-9 pb-2.5 pt-1">
            <Eye mood={mood} side="left" />
            <Eye mood={mood} side="right" />
          </div>
          <div
            className={`flex items-center justify-end overflow-hidden whitespace-nowrap rounded-lg border-4 border-violet-950 bg-[#b6f09c] px-3 font-mono font-bold text-[#173b12] shadow-inner ${
              small ? "h-11 text-lg" : "h-14 text-2xl sm:text-3xl"
            }`}
          >
            {screen}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {KEYS.map((key) => (
              <span
                key={key}
                className={`flex items-center justify-center rounded-md border-2 border-violet-950 font-mono font-bold ${
                  small ? "h-5 text-[10px]" : "h-7 text-xs"
                } ${"÷×−+=".includes(key) ? "bg-amber-300 text-violet-950" : "bg-violet-200 text-violet-900"}`}
              >
                {key}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Eye({ mood, side }: { mood: BossMood; side: "left" | "right" }) {
  if (mood === "defeated") {
    return <span className="flex h-9 w-9 items-center justify-center font-draw-display text-3xl font-black text-violet-950">✕</span>;
  }
  const angry = mood === "rage" || mood === "taunt";
  return (
    <span className="relative flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-violet-950 bg-white">
      <span className={`mb-blink block h-4 w-4 rounded-full bg-violet-950 ${mood === "hit" ? "scale-50" : ""}`} />
      <span
        className={`absolute -top-2.5 h-1.5 w-10 rounded-full bg-violet-950 ${
          angry ? (side === "left" ? "rotate-[20deg]" : "-rotate-[20deg]") : side === "left" ? "rotate-[8deg]" : "-rotate-[8deg]"
        }`}
      />
    </span>
  );
}

/**
 * Types `text` out over `durationMs` (from `startedAt`), then shows a
 * blinking "…" while it "computes". Shows `result` instead once given.
 */
export function TypingScreen({ text, startedAt, durationMs, result }: { text: string; startedAt: number; durationMs: number; result?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (result) return;
    const timer = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(timer);
  }, [result]);

  if (result) return <span>{result}</span>;
  const full = `${text}=`;
  // Typing fills ~85% of the window; the rest is the anxious "computing" bit.
  const progress = Math.min(1, Math.max(0, (now - startedAt) / (durationMs * 0.85)));
  const shown = full.slice(0, Math.ceil(progress * full.length));
  return (
    <span>
      <MathText text={shown} />
      {progress >= 1 ? <span className="mb-cursor">…</span> : <span className="mb-cursor">▌</span>}
    </span>
  );
}

/** The boss's LCD during a round: seconds left, ticking down. */
export function CountdownScreen({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  return <span>{Math.max(0, Math.ceil((endsAt - now) / 1000))}</span>;
}

export function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between text-xs font-bold uppercase tracking-wider text-violet-200/80">
        <span>🧮 Quái Máy Tính</span>
        <span className="font-mono">{hp}/{maxHp}</span>
      </div>
      <div className="mt-1 h-4 overflow-hidden rounded-full border-2 border-violet-950 bg-violet-950/60">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${pct > 50 ? "bg-gradient-to-r from-rose-500 to-fuchsia-500" : pct > 20 ? "bg-gradient-to-r from-orange-500 to-rose-500" : "bg-gradient-to-r from-amber-400 to-orange-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** A thin bar that empties over the question's window (client clock). */
export function TimeBar({ startedAt, endsAt }: { startedAt: number; endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  const pct = Math.max(0, Math.min(100, ((endsAt - now) / (endsAt - startedAt)) * 100));
  const seconds = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${seconds <= 5 ? "bg-amber-400" : "bg-cyan-400"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-10 text-right font-mono text-sm font-bold ${seconds <= 5 ? "text-amber-300" : "text-cyan-200"}`}>{seconds}s</span>
    </div>
  );
}
