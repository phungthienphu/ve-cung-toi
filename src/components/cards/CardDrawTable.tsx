"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { drawFontClass } from "@/lib/drawFonts";
import { playNightFall, playPop, playTypeTick, playWhoosh } from "@/lib/sound";
import { DECK_SIZE, ORDERED_DECK, cardInfo, shuffled } from "./deck";
import { seanceFontClass } from "./fonts";
import { ACE_OF_SPADES, AI_READINGS_PER_HOUR, FORTUNE_RESET, LINES, TOPICS, offlineReading, reading, type Topic } from "./fortune";
import { Candle, Incense, Medium, MediumHand, Sigil, type MediumMood } from "./Medium";
import { CardBack, CardFace, StaticCard } from "./PlayingCard";

// A fortune teller's table with a 52-card deck: she asks the player's name
// and question, shows the whole deck face up, gathers it, lets the player
// shuffle as often as they like (the deck flies up and swirls), then fans it
// out so they can draw as many cards as they want — and finally reads the
// whole spread for them with Claude (/api/fortune), streamed onto a scroll.

type Phase = "askName" | "askTopic" | "ready" | "reveal" | "gather" | "deck" | "lift" | "swirl" | "riffle" | "fan";

const STEPS: { label: string; phases: Phase[] }[] = [
  { label: "Hỏi chuyện", phases: ["askName", "askTopic"] },
  { label: "Lật bài", phases: ["ready", "reveal"] },
  { label: "Xào bài", phases: ["gather", "deck", "lift", "swirl", "riffle"] },
  { label: "Rút bài", phases: ["fan"] },
];

const IN_AIR: Phase[] = ["lift", "swirl", "riffle"];

// Timings (ms). MOVE matches the .pc-card transition in globals.css.
const MOVE = 650;
const REVEAL_STAGGER = 15;
const REVEAL_HOLD = 3100; // from Start until the face-up deck gathers again
const GATHER_STAGGER = 8;
const LIFT_STAGGER = 4;
const SWIRL_STEP = 400;
const RIFFLE_STAGGER = 7;
const FAN_STAGGER = 12;

// ---------- Layout ----------

interface Geometry {
  w: number;
  h: number;
  narrow: boolean;
  /** Card size. */
  cw: number;
  ch: number;
  /** The medium: width, height, centre x. */
  mw: number;
  mh: number;
  mx: number;
  tableTop: number;
  deckX: number;
  deckY: number;
  trayTop: number;
}

function geometry(w: number, h: number): Geometry {
  const narrow = w < 640;
  const mw = Math.round(narrow ? Math.min(w * 0.56, 230) : Math.min(340, w * 0.36, h * 0.58));
  const mh = Math.round((mw * 260) / 320);
  // The table hides her below the chest.
  const tableTop = Math.round(mh * 0.86);
  const tableH = h - tableTop;
  const cw = Math.round(Math.min(88, Math.max(40, Math.min(narrow ? w / 7.2 : w / 12.5, tableH / 5.2))));
  const ch = Math.round(cw * 1.4);
  // On a phone she sits left of centre so her speech bubble fits beside her; the deck stays between her hands.
  const mx = narrow ? w * 0.3 : w / 2;
  return { w, h, narrow, cw, ch, mw, mh, mx, tableTop, deckX: mx, deckY: tableTop + tableH * 0.36, trayTop: h - ch - 46 };
}

interface Spot {
  /** Top-left of the unscaled card. */
  x: number;
  y: number;
  r: number;
  s: number;
  z: number;
  up: boolean;
  delay: number;
  flipDelay: number;
}

interface View {
  phase: Phase;
  order: number[];
  picked: number[];
  stagger: boolean;
  swirl: number;
}

const normalizeDeg = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
/** A small fixed tilt per card so the drawn row looks hand-placed. */
const tiltOf = (id: number) => (((id * 37) % 7) - 3) * 1.1;

/** Grid for showing the whole deck face up: 13 × 4 by suit when it fits, otherwise whatever column count gives the biggest cards. */
function revealGrid(g: Geometry) {
  const gap = g.narrow ? 4 : 8;
  const areaTop = g.tableTop + 8;
  const areaH = g.h - areaTop - 10;
  const areaW = g.w - 24;
  const fit = (cols: number) => {
    const rows = Math.ceil(DECK_SIZE / cols);
    return { cols, rows, s: Math.min(1, (areaW - (cols - 1) * gap) / (cols * g.cw), (areaH - (rows - 1) * gap) / (rows * g.ch)) };
  };
  const bySuit = fit(13);
  let best = bySuit;
  for (let cols = 4; cols < 13; cols++) {
    const option = fit(cols);
    if (option.s > best.s) best = option;
  }
  const chosen = bySuit.s >= best.s * 0.87 ? bySuit : best;
  const cardW = g.cw * chosen.s;
  const cardH = g.ch * chosen.s;
  const totalW = chosen.cols * cardW + (chosen.cols - 1) * gap;
  const totalH = chosen.rows * cardH + (chosen.rows - 1) * gap;
  return { cols: chosen.cols, s: chosen.s, cardW, cardH, stepX: cardW + gap, stepY: cardH + gap, left: (g.w - totalW) / 2, top: areaTop + Math.max(0, (areaH - totalH) / 2) };
}

function layout({ phase, order, picked, stagger, swirl }: View, g: Geometry): Map<number, Spot> {
  const spots = new Map<number, Spot>();
  const place = (id: number, cx: number, cy: number, spot: Partial<Spot>) =>
    spots.set(id, { x: cx - g.cw / 2, y: cy - g.ch / 2, r: 0, s: 1, z: 1, up: false, delay: 0, flipDelay: 0, ...spot });
  // A slightly skewed pile so the deck reads as thick.
  const stack = (id: number, index: number, delay = 0) =>
    place(id, g.deckX + (index - 25.5) * 0.2, g.deckY - (index - 25.5) * 0.35, { z: index + 1, delay, flipDelay: delay });

  switch (phase) {
    case "reveal": {
      const grid = revealGrid(g);
      ORDERED_DECK.forEach((id) => {
        const delay = stagger ? id * REVEAL_STAGGER : 0;
        place(id, grid.left + (id % grid.cols) * grid.stepX + grid.cardW / 2, grid.top + Math.floor(id / grid.cols) * grid.stepY + grid.cardH / 2, {
          s: grid.s,
          z: id + 1,
          up: true,
          delay,
          flipDelay: delay + 220,
        });
      });
      break;
    }
    case "gather":
      order.forEach((id, index) => stack(id, index, stagger ? index * GATHER_STAGGER : 0));
      break;
    case "lift":
    case "swirl": {
      // The deck flies up into a ring in front of her and spins a third of a turn per step.
      const scale = 0.8;
      const radius = Math.min(g.w * 0.34, g.cw * 3.4, (g.tableTop + (g.h - g.tableTop) * 0.3) * 0.48);
      const cy = Math.max(radius + (g.ch * scale) / 2 + 6, g.tableTop * 0.62);
      order.forEach((id, index) => {
        const base = (index / DECK_SIZE) * 2 * Math.PI - Math.PI / 2;
        const angle = base + (swirl * 2 * Math.PI) / 3;
        place(id, g.w / 2 + radius * Math.cos(angle), cy + radius * Math.sin(angle), {
          r: normalizeDeg((base * 180) / Math.PI + 90) + swirl * 120,
          s: scale,
          z: index + 1,
          delay: phase === "lift" && stagger ? index * LIFT_STAGGER : 0,
        });
      });
      break;
    }
    case "riffle":
      order.forEach((id, index) => stack(id, index, stagger ? index * RIFFLE_STAGGER : 0));
      break;
    case "fan": {
      const pickedSet = new Set(picked);
      const rest = order.filter((id) => !pickedSet.has(id));
      // One arc when each card can still show a ~14px strip, otherwise several stacked arcs (phones).
      const maxHalf = g.w * (g.narrow ? 0.4 : 0.42);
      const perRowCap = Math.max(1, Math.floor((2 * maxHalf) / 14) + 1);
      const rows = Math.max(1, Math.ceil(rest.length / perRowCap));
      const perRow = Math.ceil(rest.length / rows);
      const rowGap = g.ch * (g.narrow ? 0.6 : 0.66);
      const arcs = Array.from({ length: rows }, (_, row) => {
        const n = Math.max(0, Math.min(perRow, rest.length - row * perRow));
        const half = Math.min(maxHalf, Math.max(g.cw * 0.5, (n - 1) * g.cw * 0.3));
        const angle = n > 1 ? Math.min((70 * Math.PI) / 180, (n * 2.2 * Math.PI) / 180, 4 * Math.atan((g.ch * 0.7) / half)) : 0;
        const radius = angle > 0 ? half / Math.sin(angle / 2) : 0;
        return { n, angle, radius, sag: radius * (1 - Math.cos(angle / 2)) };
      });
      const blockH = g.ch + (rows - 1) * rowGap + Math.max(0, ...arcs.map((arc) => arc.sag));
      const zoneTop = g.tableTop + 10;
      const top = zoneTop + Math.max(0, (g.trayTop - 10 - zoneTop - blockH) * 0.35);
      let k = 0;
      arcs.forEach((arc, row) => {
        for (let j = 0; j < arc.n; j++, k++) {
          const theta = arc.n > 1 ? -arc.angle / 2 + (arc.angle * j) / (arc.n - 1) : 0;
          const delay = stagger ? k * FAN_STAGGER : 0;
          place(rest[k], g.w / 2 + arc.radius * Math.sin(theta), top + row * rowGap + g.ch / 2 + arc.radius * (1 - Math.cos(theta)), {
            r: (theta * 180) / Math.PI,
            z: 10 + row * 60 + j,
            delay,
            flipDelay: delay,
          });
        }
      });
      // Drawn cards: face up in a row along the bottom tray.
      const spacing = picked.length > 1 ? Math.min(g.cw * 1.12, (g.w - 32 - g.cw) / (picked.length - 1)) : 0;
      const startX = g.w / 2 - ((picked.length - 1) * spacing) / 2;
      picked.forEach((id, index) => place(id, startX + index * spacing, g.h - 16 - g.ch / 2, { r: tiltOf(id), z: 600 + index, up: true, flipDelay: 120 }));
      break;
    }
    default:
      order.forEach((id, index) => stack(id, index));
  }
  return spots;
}

const cardStyle = (spot: Spot, g: Geometry): CSSProperties => ({
  width: g.cw,
  height: g.ch,
  fontSize: g.cw / 5,
  zIndex: spot.z,
  transform: `translate3d(${spot.x}px, ${spot.y}px, 0) rotate(${spot.r}deg) scale(${spot.s})`,
  transitionDelay: `${spot.delay}ms`,
});

// ---------- Pieces ----------

const PRIMARY =
  "flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#ffd36e] to-[#e0951a] px-6 py-3 font-seance text-xl font-bold text-[#3b0a0f] shadow-[0_5px_0_#7a3b06,0_12px_26px_rgba(224,149,26,0.35)] transition hover:brightness-110 active:translate-y-[3px] active:shadow-[0_2px_0_#7a3b06] disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY =
  "flex items-center justify-center gap-2 rounded-2xl border border-[#e0b84a]/45 bg-white/[0.06] px-5 py-3 font-seance text-xl font-bold text-[#f3e6c4] transition hover:border-[#e0b84a] hover:bg-white/[0.12] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";

const INPUT =
  "min-w-0 flex-1 rounded-2xl border border-[#e0b84a]/45 bg-black/40 px-4 py-3 text-lg font-semibold text-[#f5e9cb] outline-none transition placeholder:text-[#f5e9cb]/35 focus:border-[#e0b84a] focus:shadow-[0_0_0_3px_rgba(224,184,74,0.25)]";

function Kbd({ children, dark = false }: { children: string; dark?: boolean }) {
  return (
    <kbd className={`hidden rounded border px-1.5 font-sans text-[10px] font-bold not-italic opacity-60 sm:inline ${dark ? "border-black/25" : "border-white/25"}`}>
      {children}
    </kbd>
  );
}

function Stepper({ phase }: { phase: Phase }) {
  const current = STEPS.findIndex((step) => step.phases.includes(phase));
  return (
    <ol className="flex items-center justify-center gap-1.5 sm:gap-2">
      {STEPS.map((step, index) => (
        <li key={step.label} className="flex items-center gap-1.5 sm:gap-2">
          {index > 0 && <span className={`h-px w-4 sm:w-8 ${index <= current ? "bg-[#e0b84a]" : "bg-white/15"}`} />}
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition sm:text-sm ${
              index === current ? "bg-[#e0b84a] text-[#2a070d] shadow-[0_0_18px_rgba(224,184,74,0.45)]" : index < current ? "text-[#e0b84a]" : "text-white/35"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                index === current ? "bg-[#2a070d] text-[#e0b84a]" : index < current ? "bg-[#e0b84a]/20" : "bg-white/10"
              }`}
            >
              {index < current ? "✓" : index + 1}
            </span>
            <span className={index === current ? "" : "hidden sm:inline"}>{step.label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Types `text` out letter by letter and reports while it is typing. The text
 * may keep growing (a streamed reading): typing carries on, speeding up when
 * it falls behind. Remount (via `key`) to start over.
 */
function useTypewriter(text: string, onTalking: (talking: boolean) => void) {
  const typed = useRef(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (typed.current >= text.length) return;
    onTalking(true);
    let ticks = 0;
    const timer = window.setInterval(() => {
      typed.current = Math.min(text.length, typed.current + Math.max(1, Math.ceil((text.length - typed.current) / 60)));
      setCount(typed.current);
      if (++ticks % 3 === 0) playTypeTick(0.012);
      if (typed.current >= text.length) {
        window.clearInterval(timer);
        onTalking(false);
      }
    }, 24);
    return () => {
      window.clearInterval(timer);
      onTalking(false);
    };
  }, [text, onTalking]);

  return { shown: text.slice(0, count), typing: count < text.length };
}

/** Her speech bubble (remounted per line via `key`). */
function SpeechBubble({ text, onTalking, style }: { text: string; onTalking: (talking: boolean) => void; style: CSSProperties }) {
  const { shown, typing } = useTypewriter(text, onTalking);

  return (
    <div aria-hidden className="md-bubble pc-pop pointer-events-none absolute z-[3000] px-3.5 py-2.5 sm:px-4 sm:py-3" style={style}>
      <p className="font-seance text-[15px] font-medium leading-snug sm:text-lg">
        {shown}
        {typing && <span className="md-caret">▍</span>}
      </p>
    </div>
  );
}

function PreviewModal({ id, picked, name, onClose, onMove }: { id: number; picked: number[]; name: string; onClose: () => void; onMove: (step: number) => void }) {
  const index = picked.indexOf(id);
  const info = cardInfo(id);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") onMove(-1);
      else if (event.key === "ArrowRight") onMove(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onMove]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={info.name} onClick={(event) => event.stopPropagation()} className="flex max-w-sm flex-col items-center text-center">
        <div key={id} className="pc-zoom drop-shadow-[0_0_40px_rgba(255,200,120,0.35)]">
          <StaticCard id={id} width={210} />
        </div>
        <p className="mt-5 font-seance text-3xl font-bold text-[#f5e9cb]">
          {info.name} <span className={info.suit.red ? "text-[#ff4d5e]" : ""}>{info.suit.symbol}</span>
        </p>
        <p className="mt-1 text-sm text-[#f5e9cb]/55">
          Lá thứ {index + 1} / {picked.length} con đã rút
        </p>
        <p className="mt-3 font-seance text-lg leading-snug text-[#f3d27a]">“{reading(id, name, null)}”</p>
        <div className="mt-5 flex gap-2">
          <button type="button" aria-label="Lá trước" disabled={index <= 0} onClick={() => onMove(-1)} className={`${SECONDARY} w-14 px-0`}>
            ‹
          </button>
          <button type="button" onClick={onClose} className={`${PRIMARY} min-w-32`}>
            Đóng
          </button>
          <button type="button" aria-label="Lá sau" disabled={index >= picked.length - 1} onClick={() => onMove(1)} className={`${SECONDARY} w-14 px-0`}>
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReadingState {
  /** Bumped whenever the text starts over, to restart the typewriter. */
  key: number;
  status: "loading" | "streaming" | "done" | "offline";
  /** The cards this reading is for (a snapshot of what was drawn). */
  cards: number[];
  text: string;
  /** Why this is the quick offline reading, or that the stream broke off. */
  notice: string;
  /** AI readings this visitor has left this hour, when the server said. */
  remaining: number | null;
}

const READING_NOTICES: Record<string, string> = {
  rate_limited: `Con đã dùng hết ${AI_READINGS_PER_HOUR} lượt luận quẻ AI của giờ này — đây là quẻ đọc nhanh.`,
  daily_limit: "Hôm nay bà đồng đã luận đủ quẻ AI rồi — đây là quẻ đọc nhanh, mai quay lại nhé.",
  unavailable: "Chưa gọi được AI lúc này — đây là quẻ đọc nhanh.",
};

class ReadingUnavailable extends Error {}

const sameCards = (a: number[], b: number[]) => a.length === b.length && a.every((id, index) => id === b[index]);

function ReadingText({ text, waiting, onTalking }: { text: string; waiting: boolean; onTalking: (talking: boolean) => void }) {
  const { shown, typing } = useTypewriter(text, onTalking);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = box.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [shown.length]);

  return (
    <div ref={box} className="min-h-0 flex-1 overflow-y-auto px-4 py-2 sm:px-6">
      {waiting ? (
        <p className="flex items-center gap-2 font-seance text-lg text-[#5a0a18]/75 sm:text-xl">
          <span className="animate-pulse">🕯️</span> Bà đồng đang nhập hồn…
        </p>
      ) : (
        <p className="whitespace-pre-line font-seance text-[17px] leading-relaxed text-[#2a070d] sm:text-xl">
          {shown}
          {typing && <span className="md-caret">▍</span>}
        </p>
      )}
    </div>
  );
}

/** The AI reading, written onto a parchment scroll laid over the table. */
function ReadingPanel({
  reading: state,
  name,
  question,
  topic,
  onTalking,
  onPreview,
  onClose,
  onNewRound,
  style,
}: {
  reading: ReadingState;
  name: string;
  question: string;
  topic: Topic;
  onTalking: (talking: boolean) => void;
  onPreview: (id: number) => void;
  onClose: () => void;
  onNewRound: () => void;
  style: CSSProperties;
}) {
  const [copied, setCopied] = useState(false);
  const topicInfo = topic !== "any" ? TOPICS.find((item) => item.id === topic) : undefined;
  const finished = state.status === "done" || state.status === "offline";

  async function copy() {
    const cards = state.cards.map((id) => `${cardInfo(id).name} ${cardInfo(id).suit.symbol}`).join(", ");
    try {
      await navigator.clipboard.writeText(`🔮 Quẻ của ${name || "con"}${question ? ` — “${question}”` : ""}\nBài: ${cards}\n\n${state.text}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: nothing to do.
    }
  }

  return (
    <div role="dialog" aria-label="Quẻ bói" className="md-scroll pc-pop absolute z-[3200] flex flex-col overflow-hidden" style={style}>
      <div className="flex items-start justify-between gap-3 border-b border-[#5a0a18]/20 px-4 pb-2 pt-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="font-seance text-xl font-bold leading-tight text-[#5a0a18] sm:text-2xl">
            Quẻ của {name || "con"}
            {topicInfo && (
              <span className="ml-2 font-draw-body text-sm font-bold text-[#5a0a18]/70">
                {topicInfo.emoji} {topicInfo.label}
              </span>
            )}
          </h2>
          {question && <p className="mt-0.5 truncate text-sm italic text-[#2a070d]/70">“{question}”</p>}
        </div>
        <button
          type="button"
          aria-label="Đóng quẻ"
          onClick={onClose}
          className="shrink-0 rounded-full px-2 py-1 text-lg leading-none text-[#5a0a18]/60 transition hover:bg-[#5a0a18]/10 hover:text-[#5a0a18]"
        >
          ✕
        </button>
      </div>
      <div className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {state.cards.map((id) => {
          const info = cardInfo(id);
          return (
            <button
              key={id}
              type="button"
              title={info.name}
              onClick={() => onPreview(id)}
              className={`shrink-0 rounded-md border border-[#5a0a18]/25 bg-white/70 px-1.5 py-0.5 text-sm font-extrabold transition hover:-translate-y-0.5 ${info.suit.red ? "text-[#c8192c]" : "text-[#1e1b2e]"}`}
            >
              {info.rank}
              {info.suit.symbol}
            </button>
          );
        })}
      </div>
      <ReadingText key={state.key} text={state.text} waiting={state.status === "loading" || (state.status === "streaming" && !state.text)} onTalking={onTalking} />
      {state.notice && <p className="px-4 pb-1 text-xs italic text-[#5a0a18]/75 sm:px-6">{state.notice}</p>}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#5a0a18]/20 px-4 py-2.5 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-[#5a0a18] px-4 py-2 font-seance text-lg font-bold text-[#f5e9cb] transition hover:brightness-125 active:translate-y-px"
        >
          Rút tiếp
        </button>
        {finished && (
          <button type="button" onClick={copy} className="rounded-xl border border-[#5a0a18]/35 px-3 py-2 text-sm font-bold text-[#5a0a18] transition hover:bg-[#5a0a18]/10">
            {copied ? "Đã chép ✓" : "📋 Chép quẻ"}
          </button>
        )}
        <button type="button" onClick={onNewRound} className="rounded-xl border border-[#5a0a18]/35 px-3 py-2 text-sm font-bold text-[#5a0a18] transition hover:bg-[#5a0a18]/10">
          🧺 Gom bài, xem quẻ mới
        </button>
        <span className="ml-auto text-[11px] font-semibold text-[#5a0a18]/60">
          🔮 Chỉ để giải trí{state.remaining !== null ? ` · còn ${state.remaining} lượt AI trong giờ này` : ""}
        </span>
      </div>
    </div>
  );
}

// ---------- The table ----------

export default function CardDrawTable() {
  const stageRef = useRef<HTMLElement>(null);
  const lookRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const lastPickAt = useRef(0);
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [phase, setPhase] = useState<Phase>("askName");
  const [order, setOrder] = useState<number[]>(ORDERED_DECK);
  const [picked, setPicked] = useState<number[]>([]);
  /** Cards move one after another (true) or all at once (false, e.g. the fan closing a gap). */
  const [stagger, setStagger] = useState(false);
  const [swirl, setSwirl] = useState(0);
  const [busy, setBusy] = useState(false);
  const [shuffles, setShuffles] = useState(0);
  const [hot, setHot] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [lastDrawn, setLastDrawn] = useState<number | null>(null);
  const [shocked, setShocked] = useState(false);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [topic, setTopic] = useState<Topic>("any");
  const [question, setQuestion] = useState("");
  const [questionDraft, setQuestionDraft] = useState("");
  const [line, setLine] = useState({ id: 0, text: LINES.greet });
  const [bubbleTalking, setBubbleTalking] = useState(false);
  const [aiReading, setAiReading] = useState<ReadingState | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTalking, setPanelTalking] = useState(false);
  // In-flight /api/fortune requests, so they can be cancelled.
  const [readingRequests] = useState(() => new Set<AbortController>());

  const say = useCallback((text: string) => setLine((current) => ({ id: current.id + 1, text })), []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.length = 0;
  };

  const cancelReading = () => {
    readingRequests.forEach((request) => request.abort());
    readingRequests.clear();
  };

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      readingRequests.forEach((request) => request.abort());
    };
  }, [readingRequests]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Her eyes follow the pointer (or the last tap). Written straight to CSS variables so it never re-renders the table.
  useEffect(() => {
    let frame = 0;
    let px = 0;
    let py = 0;
    const update = () => {
      frame = 0;
      const element = lookRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const dx = (px - (rect.left + rect.width / 2)) / (rect.width * 0.9);
      const dy = (py - (rect.top + rect.height * 0.42)) / (rect.height * 0.9);
      element.style.setProperty("--lx", Math.max(-1, Math.min(1, dx)).toFixed(3));
      element.style.setProperty("--ly", Math.max(-1, Math.min(1, dy)).toFixed(3));
    };
    const onPointer = (event: PointerEvent) => {
      px = event.clientX;
      py = event.clientY;
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const chips = chipsRef.current;
    if (chips) chips.scrollTo({ left: chips.scrollWidth, behavior: "smooth" });
  }, [picked.length]);

  const g = useMemo(() => (size.w > 0 ? geometry(size.w, size.h) : null), [size]);
  const spots = useMemo(() => (g ? layout({ phase, order, picked, stagger, swirl }, g) : null), [g, phase, order, picked, stagger, swirl]);
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const interactive = phase === "fan" && !busy;
  const hotId = interactive ? hot : null;

  // ---------- Actions ----------

  function answerName(raw: string) {
    const clean = raw.trim().slice(0, 20);
    setName(clean);
    setPhase("askTopic");
    playPop();
    say(LINES.askTopic(clean));
  }

  function askQuestion(raw: string) {
    const clean = raw.replace(/\s+/g, " ").trim().slice(0, 200);
    if (!clean) return;
    setQuestion(clean);
    setTopic("any");
    setPhase("ready");
    playPop();
    say(LINES.ready(LINES.questionAck));
  }

  function chooseTopic(id: Topic) {
    setQuestion("");
    setTopic(id);
    setPhase("ready");
    playPop();
    say(LINES.ready(TOPICS.find((item) => item.id === id)?.ack ?? ""));
  }

  function start() {
    if (busy) return;
    clearTimers();
    setOrder(ORDERED_DECK);
    setPicked([]);
    setShuffles(0);
    setBusy(true);
    setStagger(true);
    setPhase("reveal");
    playWhoosh();
    say(LINES.reveal);
    later(() => {
      setPhase("gather");
      playWhoosh();
      say(LINES.gather);
    }, REVEAL_HOLD);
    later(() => {
      setPhase("deck");
      setStagger(false);
      setBusy(false);
      say(LINES.deckFirst);
    }, REVEAL_HOLD + (DECK_SIZE - 1) * GATHER_STAGGER + MOVE + 100);
  }

  function shuffle() {
    if (busy || phase !== "deck") return;
    const count = shuffles + 1;
    const next = shuffled(order);
    setBusy(true);
    setStagger(true);
    setSwirl(0);
    setPhase("lift");
    playWhoosh();
    say(LINES.shuffling());
    const lifted = (DECK_SIZE - 1) * LIFT_STAGGER + 360;
    later(() => {
      setPhase("swirl");
      setSwirl(1);
      playWhoosh();
    }, lifted);
    later(() => setSwirl(2), lifted + SWIRL_STEP);
    const riffleAt = lifted + 2 * SWIRL_STEP;
    later(() => {
      setOrder(next);
      setPhase("riffle");
      for (let tick = 0; tick < 16; tick++) later(() => playTypeTick(0.03), tick * 32);
    }, riffleAt);
    later(() => {
      setPhase("deck");
      setStagger(false);
      setBusy(false);
      setShuffles(count);
      say(LINES.shuffled(count));
    }, riffleAt + (DECK_SIZE - 1) * RIFFLE_STAGGER + MOVE);
  }

  function fan() {
    if (busy || phase !== "deck") return;
    setBusy(true);
    setStagger(true);
    setPhase("fan");
    setHot(null);
    playWhoosh();
    say(LINES.fan);
    later(() => {
      setStagger(false);
      setBusy(false);
    }, (DECK_SIZE - 1) * FAN_STAGGER + MOVE + 50);
  }

  function pick(id: number) {
    if (!interactive || pickedSet.has(id)) return;
    // Swallow the second click of a double-click.
    const now = performance.now();
    if (now - lastPickAt.current < 150) return;
    lastPickAt.current = now;
    const next = [...picked, id];
    setPicked(next);
    setHot(null);
    setLastDrawn(id);
    if (id === ACE_OF_SPADES) {
      setShocked(true);
      playNightFall();
      later(() => setShocked(false), 1800);
    } else {
      playPop();
    }
    say(next.length === DECK_SIZE ? LINES.allPicked : reading(id, name, next.length === 1 ? topic : null));
  }

  function pickRandom() {
    const rest = order.filter((id) => !pickedSet.has(id));
    if (!rest.length) return;
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    pick(rest[random[0] % rest.length]);
  }

  function gatherBack() {
    if (busy || phase !== "fan") return;
    cancelReading();
    setAiReading(null);
    setPanelOpen(false);
    setBusy(true);
    setStagger(true);
    setPhase("gather");
    setPicked([]);
    setHot(null);
    setPreview(null);
    setLastDrawn(null);
    setShuffles(0);
    playWhoosh();
    say(LINES.gatherBack);
    later(() => {
      setPhase("deck");
      setStagger(false);
      setBusy(false);
    }, (DECK_SIZE - 1) * GATHER_STAGGER + MOVE + 100);
  }

  function newRound() {
    clearTimers();
    cancelReading();
    setAiReading(null);
    setPanelOpen(false);
    setQuestion("");
    setQuestionDraft("");
    setBusy(false);
    setStagger(false);
    setSwirl(0);
    setPhase("askTopic");
    setOrder(ORDERED_DECK);
    setPicked([]);
    setShuffles(0);
    setHot(null);
    setPreview(null);
    setLastDrawn(null);
    setShocked(false);
    playWhoosh();
    say(LINES.newRound(name));
  }

  async function requestReading() {
    if (phase !== "fan" || busy || picked.length === 0) return;
    // Same cards as the reading already made (or still coming): just show it again.
    if (aiReading && (sameCards(aiReading.cards, picked) || aiReading.status === "loading" || aiReading.status === "streaming")) {
      setPanelOpen(true);
      return;
    }
    const cards = picked;
    const request = new AbortController();
    readingRequests.add(request);
    let key = (aiReading?.key ?? 0) + 1;
    let text = "";
    const update = (patch: Partial<ReadingState>) => {
      if (!request.signal.aborted) setAiReading((current) => (current ? { ...current, ...patch } : current));
    };
    setAiReading({ key, status: "loading", cards, text: "", notice: "", remaining: aiReading?.remaining ?? null });
    setPanelOpen(true);
    setHot(null);
    playNightFall();
    say(LINES.readingWait);

    try {
      const response = await fetch("/api/fortune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards, topic, question, name }),
        signal: request.signal,
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new ReadingUnavailable(data?.error ?? "unavailable");
      }
      const remaining = Number(response.headers.get("X-Fortune-Remaining"));
      update({ status: "streaming", remaining: Number.isFinite(remaining) ? remaining : null });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        const reset = text.lastIndexOf(FORTUNE_RESET);
        if (reset >= 0) {
          text = text.slice(reset + FORTUNE_RESET.length);
          key += 1;
        }
        update({ key, text });
      }
      update({ status: "done" });
      if (!request.signal.aborted) say(LINES.readingDone);
    } catch (error) {
      if (request.signal.aborted) return;
      if (text) {
        // Broke off part-way: keep what arrived.
        update({ status: "done", text: `${text}…`, notice: "Sóng tâm linh bị đứt giữa chừng — quẻ chỉ tới đây." });
      } else {
        const code = error instanceof ReadingUnavailable ? error.message : "unavailable";
        update({ key: key + 1, status: "offline", text: offlineReading(cards, name, topic, question), notice: READING_NOTICES[code] ?? READING_NOTICES.unavailable });
        say(code === "rate_limited" || code === "daily_limit" ? LINES.readingTired : LINES.readingOffline);
      }
    } finally {
      readingRequests.delete(request);
    }
  }

  // Keyboard shortcuts, always calling the latest actions.
  useEffect(() => {
    keyHandler.current = (event) => {
      if (preview !== null || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const actions: Record<string, () => void> = {
        s: shuffle,
        f: fan,
        r: () => phase === "fan" && !panelOpen && pickRandom(),
        l: () => void requestReading(),
        g: gatherBack,
        escape: () => setPanelOpen(false),
      };
      const action = actions[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      action();
    };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const movePreview = useCallback(
    (step: number) => setPreview((current) => (current === null ? null : (picked[picked.indexOf(current) + step] ?? current))),
    [picked],
  );
  const closePreview = useCallback(() => setPreview(null), []);

  // ---------- Render ----------

  const readingLive = aiReading?.status === "loading" || aiReading?.status === "streaming";
  const mood: MediumMood = shocked ? "shock" : IN_AIR.includes(phase) || readingLive ? "chant" : "idle";
  const handState = phase === "reveal" || phase === "fan" ? "away" : IN_AIR.includes(phase) ? "chant" : "rest";
  const busyLabel = IN_AIR.includes(phase) ? "Bài đang bay…" : phase === "fan" ? "Đang xòe bài…" : "Bà đồng đang bày bài…";
  const lastInfo = lastDrawn !== null ? cardInfo(lastDrawn) : null;

  let controls: React.ReactNode;
  if (phase === "askName") {
    controls = (
      <>
        <form
          className="flex w-full max-w-md gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            answerName(nameDraft);
          }}
        >
          <input
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            maxLength={20}
            placeholder="Tên của con…"
            aria-label="Tên của bạn"
            className={INPUT}
          />
          <button type="submit" className={PRIMARY}>
            Trả lời
          </button>
        </form>
        <button type="button" onClick={() => answerName("")} className="text-sm font-semibold text-[#f3e6c4]/55 underline-offset-4 transition hover:text-[#f3e6c4] hover:underline">
          Không muốn nói tên →
        </button>
      </>
    );
  } else if (phase === "askTopic") {
    controls = (
      <>
        <form
          className="flex w-full max-w-xl gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            askQuestion(questionDraft);
          }}
        >
          <input
            value={questionDraft}
            onChange={(event) => setQuestionDraft(event.target.value)}
            maxLength={200}
            placeholder="Gõ câu hỏi… (vd: Năm nay mình có đậu lớp 10 không?)"
            aria-label="Câu hỏi của bạn"
            className={INPUT}
          />
          <button type="submit" disabled={!questionDraft.trim()} className={PRIMARY}>
            Hỏi
          </button>
        </form>
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
          {TOPICS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => chooseTopic(item.id)}
              className="rounded-xl border border-[#e0b84a]/40 bg-white/[0.05] px-3 py-1.5 text-sm font-bold text-[#f3e6c4] transition hover:-translate-y-0.5 hover:border-[#e0b84a] hover:bg-[#e0b84a]/15 active:translate-y-0"
            >
              {item.emoji} {item.label}
            </button>
          ))}
        </div>
      </>
    );
  } else if (phase === "ready") {
    controls = (
      <button type="button" onClick={start} className={`${PRIMARY} w-full max-w-xs`}>
        ▶ Bắt đầu
      </button>
    );
  } else if (busy) {
    controls = (
      <div className="flex w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-white/[0.04] py-3 font-seance text-xl text-[#f3e6c4]/70">
        <span className="animate-pulse">🕯️</span> {busyLabel}
      </div>
    );
  } else if (phase === "deck") {
    const firstShuffle = shuffles === 0;
    controls = (
      <div className="grid w-full max-w-md grid-cols-2 gap-2">
        <button type="button" onClick={shuffle} className={firstShuffle ? PRIMARY : SECONDARY}>
          🔀 {firstShuffle ? "Xào bài" : "Xào thêm"} <Kbd dark={firstShuffle}>S</Kbd>
        </button>
        <button type="button" onClick={fan} className={firstShuffle ? SECONDARY : PRIMARY}>
          🃏 Xòe bài <Kbd dark={!firstShuffle}>F</Kbd>
        </button>
      </div>
    );
  } else {
    const allDrawn = picked.length === DECK_SIZE;
    const canRead = picked.length > 0;
    controls = (
      <div className={`grid w-full grid-cols-2 gap-2 ${canRead ? "max-w-2xl sm:grid-cols-3" : "max-w-md"}`}>
        {canRead && (
          <button type="button" onClick={requestReading} className={`${PRIMARY} col-span-2 sm:order-2 sm:col-span-1`}>
            🔮 {readingLive ? "Đang luận…" : "Luận quẻ"} <Kbd dark>L</Kbd>
          </button>
        )}
        <button type="button" onClick={pickRandom} disabled={allDrawn || panelOpen} className={`${SECONDARY} sm:order-1`}>
          🎲 Rút giúp 1 lá <Kbd>R</Kbd>
        </button>
        <button type="button" onClick={gatherBack} className={`${SECONDARY} sm:order-3`}>
          🧺 Gom bài lại <Kbd>G</Kbd>
        </button>
      </div>
    );
  }

  const sigilSize = g ? Math.min((g.h - g.tableTop) * 0.8, g.w * 0.45, 360) : 0;
  const candleW = g ? Math.max(18, Math.min(36, g.cw * 0.42)) : 0;
  const candleH = candleW * 3.25;
  const handW = g ? g.cw * 1.05 : 0;
  const handH = handW * 1.4;
  const bubbleLeft = g ? g.mx + g.mw * (g.narrow ? 0.3 : 0.36) : 0;

  return (
    <main className={`${drawFontClass} ${seanceFontClass} bg-seance flex min-h-app flex-col overflow-x-clip text-[#f3e6c4]`}>
      <p className="sr-only" aria-live="polite">
        {line.text}
      </p>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 pt-3 sm:px-6 sm:pt-4">
        <Link href="/" aria-label="Về trang chủ" className="shrink-0 rounded-full px-3 py-1.5 text-sm font-bold text-[#f3e6c4]/70 transition hover:bg-white/10 hover:text-[#f3e6c4]">
          ‹ <span className="hidden sm:inline">Trang chủ</span>
        </Link>
        <h1 className="truncate font-seance text-2xl font-extrabold tracking-wide text-[#f3d27a] drop-shadow-[0_0_14px_rgba(224,184,74,0.4)] sm:text-4xl">Bà Đồng Xem Bài</h1>
        <button
          type="button"
          onClick={newRound}
          disabled={phase === "askName" || phase === "askTopic"}
          className="shrink-0 rounded-full px-3 py-1.5 text-sm font-bold text-[#f3e6c4]/70 transition hover:bg-white/10 hover:text-[#f3e6c4] disabled:invisible"
        >
          ↺ <span className="hidden sm:inline">Ván mới</span>
        </button>
      </header>

      <div className="mx-auto mt-2 w-full max-w-6xl px-3">
        <Stepper phase={phase} />
      </div>

      <section
        ref={stageRef}
        className={`pc-stage relative mx-auto mt-3 min-h-[500px] w-[calc(100%-1.5rem)] max-w-6xl flex-1 sm:min-h-[540px] sm:w-[calc(100%-2.5rem)] ${phase === "swirl" ? "is-swirl" : ""} ${shocked ? "md-shake" : ""}`}
      >
        {g && spots && (
          <>
            <div ref={lookRef} className="absolute" style={{ left: g.mx - g.mw / 2, top: 0, width: g.mw, height: g.mh }}>
              <Medium mood={mood} talking={bubbleTalking || panelTalking} />
            </div>

            <div className="altar-cloth absolute inset-x-0 bottom-0 rounded-b-[1.75rem] rounded-t-xl" style={{ top: g.tableTop }} />
            <Sigil style={{ left: g.deckX - sigilSize / 2, top: g.deckY - sigilSize / 2 + 8, width: sigilSize, height: sigilSize }} />
            <Candle style={{ left: (g.narrow ? 18 : g.mx - g.mw * 0.62) - candleW / 2, top: g.tableTop + candleH * 0.22 - candleH, width: candleW, height: candleH }} />
            {!g.narrow && (
              <>
                <Candle style={{ left: g.mx + g.mw * 0.62 - candleW / 2, top: g.tableTop + candleH * 0.22 - candleH, width: candleW, height: candleH }} />
                <Incense style={{ left: g.mx - g.mw * 0.95 - candleW * 0.75, top: g.tableTop + candleH * 0.25 - candleW * 3.5, width: candleW * 1.5, height: candleW * 3.5 }} />
              </>
            )}
            <div className="seance-vignette pointer-events-none absolute inset-0 rounded-b-[1.75rem]" />

            <MediumHand side="left" state={handState} style={{ left: g.deckX - g.cw * 1.3 - handW / 2, top: g.tableTop - handH * 0.22, width: handW, height: handH }} />
            <MediumHand side="right" state={handState} style={{ left: g.deckX + g.cw * 1.3 - handW / 2, top: g.tableTop - handH * 0.22, width: handW, height: handH }} />

            {phase === "deck" && !busy && (
              <div className="pointer-events-none absolute flex w-60 justify-center" style={{ left: g.deckX - 120, top: g.deckY + g.ch / 2 + 22 }}>
                <span key={shuffles} className="pc-pop rounded-full border border-[#e0b84a]/40 bg-black/50 px-3 py-1 text-xs font-bold text-[#f3d27a]">
                  {shuffles ? `🔀 Đã xào ${shuffles} lần` : "Chưa xào lần nào"}
                </span>
              </div>
            )}

            {phase === "fan" && (
              <div className="pointer-events-none absolute inset-x-3 rounded-2xl border-2 border-dashed border-[#e0b84a]/30 bg-black/25" style={{ top: g.trayTop, bottom: 6 }}>
                <div className="flex items-center justify-between gap-2 px-3 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-[#f3d27a]/70 sm:text-xs">
                  <span className="shrink-0">Bài con đã rút · {picked.length} lá</span>
                  {lastInfo && (
                    <span key={lastDrawn} className="pc-pop truncate normal-case tracking-normal text-[#ffe08a]">
                      Vừa rút: {lastInfo.name} {lastInfo.suit.symbol}
                    </span>
                  )}
                </div>
                {picked.length === 0 && (
                  <p className="absolute inset-0 flex items-center justify-center pt-5 font-seance text-base text-[#f5e9cb]/35 sm:text-xl">Lá con rút sẽ nằm ở đây…</p>
                )}
              </div>
            )}

            {ORDERED_DECK.map((id) => {
              const spot = spots.get(id)!;
              return (
                <span key={id} className={`pc-card ${hotId === id ? "is-hot" : ""} ${phase === "fan" && pickedSet.has(id) ? "is-drawn" : ""}`} style={cardStyle(spot, g)}>
                  <span className="pc-lift">
                    <span className={`pc-flip ${spot.up ? "is-up" : ""}`} style={{ transitionDelay: `${spot.flipDelay}ms` }}>
                      <CardBack />
                      {/* Faces are only in the DOM while they can be seen (or are flipping away). */}
                      {(spot.up || phase === "reveal" || phase === "gather") && <CardFace id={id} />}
                    </span>
                  </span>
                </span>
              );
            })}

            {/* Pointer targets: fixed boxes above the cards, so a lifted card never covers its neighbours' hit areas. */}
            {interactive &&
              ORDERED_DECK.map((id) => {
                const spot = spots.get(id)!;
                const drawn = pickedSet.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-label={drawn ? `${cardInfo(id).name} — xem lớn` : "Lá bài úp — bấm để rút"}
                    className={`pc-hitbox ${drawn ? "is-drawn" : ""}`}
                    style={{ ...cardStyle(spot, g), zIndex: 2000 + spot.z, transitionDelay: "0ms" }}
                    onClick={() => (drawn ? setPreview(id) : pick(id))}
                    onPointerEnter={(event) => event.pointerType === "mouse" && setHot(id)}
                    onPointerLeave={() => setHot((current) => (current === id ? null : current))}
                    onFocus={(event) => event.currentTarget.matches(":focus-visible") && setHot(id)}
                    onBlur={() => setHot((current) => (current === id ? null : current))}
                  />
                );
              })}

            <SpeechBubble
              key={line.id}
              text={line.text}
              onTalking={setBubbleTalking}
              style={{ left: bubbleLeft, top: g.narrow ? 4 : Math.max(8, g.mh * 0.1), width: Math.min(340, g.w - bubbleLeft - 8) }}
            />

            {panelOpen && aiReading && (
              <ReadingPanel
                reading={aiReading}
                name={name}
                question={question}
                topic={topic}
                onTalking={setPanelTalking}
                onPreview={setPreview}
                onClose={() => setPanelOpen(false)}
                onNewRound={gatherBack}
                style={{ left: Math.max(8, (g.w - 720) / 2), right: Math.max(8, (g.w - 720) / 2), top: g.tableTop + 6, bottom: 8 }}
              />
            )}

            {shocked && <div className="md-flash pointer-events-none absolute inset-0 z-[3500] rounded-[1.75rem]" />}
          </>
        )}
      </section>

      <div className="mx-auto w-full max-w-6xl px-3 pb-3 pt-4 sm:px-6">
        <div className="flex min-h-[52px] flex-col items-center justify-center gap-2">{controls}</div>
        <div className="mt-2 flex h-9 items-center gap-3 pr-28 text-xs text-[#f3e6c4]/55">
          {picked.length > 0 ? (
            <div ref={chipsRef} className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1">
              <span className="shrink-0 font-bold uppercase tracking-wider">Đã rút {picked.length}:</span>
              {picked.map((id) => {
                const info = cardInfo(id);
                return (
                  <button
                    key={id}
                    type="button"
                    title={info.name}
                    onClick={() => setPreview(id)}
                    className={`shrink-0 rounded-md bg-[#f5e9cb] px-2 py-0.5 text-sm font-extrabold shadow transition hover:-translate-y-0.5 ${info.suit.red ? "text-[#c8192c]" : "text-[#1e1b2e]"}`}
                  >
                    {info.rank}
                    {info.suit.symbol}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="min-w-0 flex-1 truncate">
              🔮 Chỉ để giải trí thôi nha.
              <span className="hidden sm:inline"> · Phím tắt: S xào bài · F xòe bài · R rút ngẫu nhiên · G gom bài</span>
            </p>
          )}
        </div>
      </div>

      {preview !== null && <PreviewModal id={preview} picked={picked} name={name} onClose={closePreview} onMove={movePreview} />}
    </main>
  );
}
