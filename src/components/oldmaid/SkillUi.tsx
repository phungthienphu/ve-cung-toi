"use client";

import { JOKER, SKILLS, SKILL_SHOW_MS, seatAfter, skillOf, type PublicOldMaidState, type SkillType } from "@shared/oldMaidTypes";
import { Face, SkillFace } from "./MyHand";
import { btnGhost, useNow } from "./panels";

// Everything about playing a skill card on screen: whether it can be played
// right now (and why not), its sheet, the "tung chiêu" moment every player
// sees, the 🤲 choice and the 🛡️ button.

export type SkillStatus = { ok: true } | { ok: false; reason: string };

/** Mirrors the server's rules, so a card only glows / its button only lights when playing it will work. */
export function skillStatus(card: number, state: PublicOldMaidState, myId: string): SkillStatus {
  const skill = skillOf(card);
  const no = (reason: string): SkillStatus => ({ ok: false, reason });
  if (state.phase !== "playing") return no("Chỉ dùng được khi đang chơi.");
  const { turn, pending } = state;
  const me = state.players.find((player) => player.id === myId);
  const active = state.players.filter((player) => player.seat !== null && player.finishedRank === null && player.cardCount > 0);
  const countOf = (id: string) => state.players.find((player) => player.id === id)?.cardCount ?? 0;
  const myTurn = turn?.drawerId === myId && !pending;
  const when = SKILLS[skill].when + ".";
  let reason: string | null = null;
  switch (skill) {
    case "peek":
      if (!myTurn) reason = when;
      break;
    case "radar":
      if (!myTurn) reason = when;
      else if (active.length < 2) reason = "Không còn ai để dò.";
      break;
    case "double":
      if (!myTurn) reason = when;
      else if (countOf(turn!.targetId) < 2) reason = "Người kia chỉ còn 1 lá.";
      break;
    case "reverse": {
      if (!myTurn || me?.seat == null) {
        reason = when;
        break;
      }
      const left = seatAfter(active.map((player) => player.seat!), me.seat);
      const leftId = active.find((player) => player.seat === left)?.id;
      if (!leftId || leftId === myId || leftId === turn!.targetId) reason = "Bàn chỉ còn 2 người — bên trái cũng là bên phải.";
      break;
    }
    case "switch":
      if (!turn || turn.targetId !== myId || pending) reason = when;
      else if (turn.switchArmed) reason = "Bẫy đã giăng rồi.";
      else if ((me?.cardCount ?? 0) - 1 < 2) reason = "Cần ít nhất 2 lá khác trên tay để tráo.";
      break;
    case "return":
      if (!pending || pending.drawerId !== myId || pending.choosing) reason = when;
      break;
  }
  if (!reason && (pending ? pending.skillUsers : turn?.skillUsers ?? []).includes(myId)) reason = "Lượt này bạn đã dùng 1 lá kỹ năng rồi.";
  return reason ? no(reason) : { ok: true };
}

/** A tapped skill card: what it does, play it (or why not yet), or dangle it like any card. */
export function SkillSheet({
  card,
  status,
  radarTargets,
  canTease,
  teased,
  onUse,
  onTease,
  onClose,
}: {
  card: number;
  status: SkillStatus;
  /** 📡: who can be scanned. */
  radarTargets: { id: string; name: string }[];
  canTease: boolean;
  teased: boolean;
  onUse: (targetId?: string) => void;
  onTease: () => void;
  onClose: () => void;
}) {
  const type = skillOf(card);
  const skill = SKILLS[type];
  const useLabel: Record<SkillType, string> = {
    peek: "🔍 Chọn lá để soi",
    radar: "📡 Dò ai?",
    double: "🤲 Rút hai lượt này",
    reverse: "↩️ Rút người bên trái",
    switch: "🎭 Giăng bẫy",
    return: "🛡️ Trả lá vừa rút",
  };
  return (
    <div className="absolute inset-0 z-[55] flex items-end justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Lá kỹ năng ${skill.name}`}
        onClick={(event) => event.stopPropagation()}
        className="om-pop w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#2e1065] to-[#1e0b3d] p-4 text-white shadow-[0_20px_60px_rgba(76,29,149,0.6)] ring-1 ring-violet-300/30"
      >
        <div className="flex gap-4">
          <span className="relative block h-[8.4rem] w-24 shrink-0" style={{ fontSize: 19 }}>
            <SkillFace card={card} className="shadow-[0_0_30px_rgba(167,139,250,0.6)]" />
          </span>
          <div className="min-w-0">
            <p className="font-draw-display text-2xl font-extrabold leading-tight">
              {skill.icon} {skill.name}
            </p>
            <p className="mt-1 inline-block rounded-full bg-violet-400/20 px-2.5 py-0.5 text-[11px] font-bold text-violet-100">{skill.when}</p>
            <p className="mt-2 text-sm leading-relaxed text-violet-100/85">{skill.detail}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {status.ok && type === "radar" ? (
            <>
              <p className="text-center text-xs font-bold uppercase tracking-wider text-violet-200/70">Dò ai?</p>
              <div className="grid grid-cols-2 gap-2">
                {radarTargets.map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => onUse(target.id)}
                    className="truncate rounded-2xl bg-violet-500 px-3 py-2.5 text-sm font-bold shadow-[0_4px_0_#4c1d95] transition hover:brightness-110 active:translate-y-0.5"
                  >
                    📡 {target.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button
              type="button"
              disabled={!status.ok}
              onClick={() => onUse()}
              className="w-full rounded-2xl bg-gradient-to-b from-[#c4b5fd] to-[#7c3aed] px-5 py-3 font-draw-display text-lg font-extrabold text-white shadow-[0_5px_0_#4c1d95] transition hover:brightness-110 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0"
            >
              {useLabel[type]}
            </button>
          )}
          {!status.ok && <p className="text-center text-xs font-semibold text-amber-200">⏳ {status.reason}</p>}
          <div className="grid grid-cols-2 gap-2">
            {canTease ? (
              <button type="button" onClick={onTease} className={btnGhost}>
                {teased ? "Thôi nhử" : "☝️ Nhử lá này"}
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={onClose} className={btnGhost}>
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface SkillCast {
  key: number;
  playerId: string;
  skill: SkillType;
  card: number;
  targetId?: string;
  at: number;
}

/**
 * The "tung chiêu" moment: the played card flips up big with a burst of light
 * and a line saying who did what to whom, then drops to the table. Smaller and
 * up top when it's your own, so it never blocks what you do next.
 */
export function CastOverlay({ cast, myId, nameOf }: { cast: SkillCast | null; myId: string; nameOf: (id: string | undefined) => string }) {
  const now = useNow(100);
  if (!cast || now - cast.at > SKILL_SHOW_MS) return null;
  const mine = cast.playerId === myId;
  const who = mine ? "Bạn" : nameOf(cast.playerId);
  const target = cast.targetId === myId ? "bạn" : nameOf(cast.targetId);
  const line: Record<SkillType, string> = {
    peek: `soi trước 1 lá của ${target}`,
    radar: `dò xem ${target} có giữ heo không`,
    double: `rút 2 lá của ${target}, giữ 1`,
    reverse: `quay sang rút bài ${target}`,
    switch: `giăng bẫy — ${target} rút lá nào cũng bị tráo!`,
    return: `trả lá vừa rút về cho ${target}`,
  };
  const skill = SKILLS[cast.skill];
  return (
    <div className={`pointer-events-none absolute inset-x-0 z-[45] flex justify-center px-4 ${mine ? "top-32 sm:top-24" : "top-[18%]"}`}>
      <div key={cast.key} className="om-cast relative flex flex-col items-center">
        <span aria-hidden className="om-cast-burst absolute left-1/2 top-[38%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <span className={`relative block ${mine ? "h-28 w-20" : "h-48 w-[8.6rem]"}`} style={{ fontSize: mine ? 16 : 27 }}>
          <SkillFace card={cast.card} className="shadow-[0_0_60px_rgba(196,181,253,0.9)]" />
        </span>
        <p className="relative mt-3 max-w-xs rounded-2xl bg-black/70 px-4 py-2 text-center font-draw-display text-base font-extrabold leading-snug text-white ring-1 ring-violet-300/40 backdrop-blur sm:text-lg">
          {skill.icon} {who} dùng <span className="text-violet-200">{skill.name}</span>
          <span className="block text-sm font-semibold text-violet-100/85">{line[cast.skill]}</span>
        </p>
      </div>
    </div>
  );
}

/** 🤲 Rút hai: both drawn cards face up; tap the one to keep. */
export function DoubleChoice({ cards, endsAt, targetName, onKeep }: { cards: [number, number]; endsAt: number; targetName: string; onKeep: (which: 0 | 1) => void }) {
  const now = useNow(100);
  const fraction = Math.max(0, Math.min(1, (endsAt - now) / 6000));
  return (
    <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-label="Chọn lá để giữ" className="om-pop w-full max-w-sm rounded-3xl bg-[#1e0b3d]/95 p-5 text-center text-white ring-1 ring-violet-300/30">
        <p className="font-draw-display text-2xl font-extrabold">🤲 Giữ lá nào?</p>
        <p className="mt-1 text-sm text-violet-100/80">Lá còn lại trả về cho {targetName}.</p>
        <div className="mt-4 flex justify-center gap-4">
          {cards.map((card, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onKeep(index as 0 | 1)}
              aria-label={`Giữ lá thứ ${index + 1}`}
              className="group relative block h-40 w-[6.9rem] rounded-[0.9rem] transition hover:-translate-y-2 focus:-translate-y-2 focus:outline-none"
              style={{ fontSize: 22 }}
            >
              <span className="relative block h-full w-full">
                <Face card={card} />
              </span>
              {card === JOKER && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-pink-500 px-2 py-0.5 text-[11px] font-black">🐷 HEO!</span>}
              <span className="mt-2 block text-xs font-bold text-violet-200 opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">Giữ lá này</span>
            </button>
          ))}
        </div>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="om-timer h-full rounded-full bg-violet-400" style={{ width: `${fraction * 100}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-white/45">Hết giờ thì giữ lá bạn đã chọn.</p>
      </div>
    </div>
  );
}

/** 🛡️ Trả lại: while the card you just drew is in your fingers. Sits above the Joker scare, so it's never covered. */
export function ReturnButton({ endsAt, totalMs, onReturn }: { endsAt: number; totalMs: number; onReturn: () => void }) {
  const now = useNow(100);
  const fraction = Math.max(0, Math.min(1, (endsAt - now) / totalMs));
  if (fraction <= 0) return null;
  return (
    <div className="pointer-events-auto relative z-[55] mb-2 flex justify-center">
      <button
        type="button"
        onClick={onReturn}
        className="om-pop om-skill-ready relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#c4b5fd] to-[#7c3aed] px-6 py-3 font-draw-display text-lg font-extrabold text-white shadow-[0_5px_0_#4c1d95] transition active:translate-y-0.5"
      >
        🛡️ Trả lá này về
        <span className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
          <span className="block h-full bg-white" style={{ width: `${fraction * 100}%` }} />
        </span>
      </button>
    </div>
  );
}
