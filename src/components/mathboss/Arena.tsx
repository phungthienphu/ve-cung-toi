"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MathBossPhase, MathBossPlayer, Shot } from "@shared/mathBossTypes";
import { playTankBigExplosion, playTankHit, playTankShoot, playUltimateReady, playWhoosh } from "@/lib/sound";
import { HERO_PALETTE, HeroSprite, OUTLINE, Projectile } from "./HeroSprite";
import { MonsterSprite, type MonsterMood } from "./MonsterSprite";
import { Scenery } from "./Scenery";

/** Must stay under the server's SHOT_FLIGHT_MS so the round never ends mid-flight. */
const FLIGHT_MS = 750;
const ORB_MS = 600;
/** Monster's left edge, in % of the arena: where it enters, and how close it gets by the buzzer. */
const MONSTER_START = 70;
const MONSTER_END = 38;
/** Where feet meet the grass (Scenery's floor at the arena's height). */
const GROUND_PX = 52;
/** Bow / muzzle height above the ground for a 144px hero. */
const SHOT_BOTTOM_PX = GROUND_PX + 58;
/** Middle of the monster's body, for impacts. */
const IMPACT_BOTTOM_PX = GROUND_PX + 120;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const heroLeft = (index: number, count: number) => 2 + index * (count <= 3 ? 11 : 33 / (count - 1));

type Effect =
  | { id: string; kind: "burst"; left: number; big?: boolean }
  | { id: string; kind: "sparks"; left: number; sparks: { dx: number; dy: number; color: string; size: number }[] }
  | { id: string; kind: "pop"; left: number; text: string; tone: "damage" | "miss" | "combo" }
  | { id: string; kind: "orb"; from: number; to: number }
  | { id: string; kind: "combo" };

let effectSeq = 0;
const nextId = () => `fx${effectSeq++}`;

interface ArenaProps {
  players: MathBossPlayer[];
  phase: MathBossPhase;
  shots: Shot[];
  startedAt: number | null;
  endsAt: number | null;
  rage: boolean;
  bossHp: number;
  bossMaxHp: number;
  /** Damage of one shot right now (10 × the rage multiplier). */
  shotDamage: number;
  /** Result phase: the round's outcome. */
  roundId: string | null;
  roundDamage: number;
  combo: boolean;
  comboDamage: number;
  speech?: string | null;
}

// The side-on battlefield on the tutor's screen. Heroes hold the left edge;
// during a round the monster stomps in from the right (that walk *is* the
// timer). Every answer fires a shot as it arrives; a round where nobody hits
// ends with the monster lunging at the heroes, a full-team round with a
// combined combo blast.
export function Arena(props: ArenaProps) {
  const { players, phase, shots, startedAt, endsAt, rage, bossHp, bossMaxHp, shotDamage, roundId, roundDamage, combo, comboDamage, speech } = props;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase !== "question") return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [phase]);

  const hurt = roundDamage > 0;
  let monsterLeft = MONSTER_START;
  if (phase === "question" && startedAt && endsAt) monsterLeft = MONSTER_START - (MONSTER_START - MONSTER_END) * clamp01((now - startedAt) / (endsAt - startedAt));
  else if (phase === "result") monsterLeft = hurt ? MONSTER_START : MONSTER_END;
  else if (phase === "victory") monsterLeft = 58;
  else if (phase === "pick") monsterLeft = 76;

  const mood: MonsterMood = phase === "victory" ? "defeated" : phase === "question" ? "walk" : phase === "result" ? (hurt ? "hurt" : "laugh") : "idle";
  const secondsLeft = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
  const screen = phase === "question" ? String(secondsLeft) : phase === "result" ? (hurt ? `-${roundDamage}` : "HAHA") : phase === "victory" ? "0" : "?";

  // ---------- effects ----------
  const sceneRef = useRef<HTMLDivElement>(null);
  const monsterRef = useRef<HTMLDivElement>(null);
  const heroRefs = useRef(new Map<string, HTMLDivElement>());
  const monsterLeftRef = useRef(monsterLeft);
  monsterLeftRef.current = monsterLeft;
  const targets = useRef(new Map<string, number>());
  const seenShots = useRef(new Set<string>());
  const seenRound = useRef<string | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [effects, setEffects] = useState<Effect[]>([]);
  const [firing, setFiring] = useState<string[]>([]);

  useEffect(() => {
    const live = timers.current;
    return () => live.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const later = (ms: number, fn: () => void) => {
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        fn();
      }, ms);
      timers.current.add(timer);
    };
    const add = (effect: Effect, lifeMs: number) => {
      setEffects((list) => [...list, effect]);
      later(lifeMs, () => setEffects((list) => list.filter((item) => item.id !== effect.id)));
    };
    const shake = (strength = 1) =>
      sceneRef.current?.animate(
        [0, -7, 6, -4, 3, 0].map((x, index) => ({ transform: `translate(${x * strength}px, ${(index % 2 ? 3 : -3) * strength * (index ? 1 : 0)}px)` })),
        { duration: 380, easing: "ease-out" }
      );
    const flashMonster = () =>
      monsterRef.current?.animate(
        [{ filter: "brightness(2.4) saturate(0.2)", transform: "scale(1.05, 0.93)" }, { filter: "none", transform: "none" }],
        { duration: 320, easing: "ease-out" }
      );
    const impact = (left: number, text: string, big = false) => {
      add({ id: nextId(), kind: "burst", left, big }, 520);
      add({
        id: nextId(),
        kind: "sparks",
        left,
        sparks: Array.from({ length: big ? 16 : 10 }, (_, index) => {
          const angle = (index / (big ? 16 : 10)) * Math.PI * 2 + Math.random() * 0.4;
          const distance = (big ? 110 : 70) + Math.random() * 40;
          return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, color: ["#fde047", "#fb923c", "#ffffff"][index % 3], size: 6 + Math.random() * 6 };
        }),
      }, 700);
      add({ id: nextId(), kind: "pop", left, text, tone: big ? "combo" : "damage" }, 1300);
      flashMonster();
      shake(big ? 1.8 : 1);
    };

    for (const shot of shots) {
      if (seenShots.current.has(shot.id)) continue;
      seenShots.current.add(shot.id);
      targets.current.set(shot.id, monsterLeftRef.current);
      const shooter = players.find((player) => player.id === shot.playerId);
      if (shooter?.hero?.weapon === "gun") playTankShoot();
      else playWhoosh();
      setFiring((list) => [...list, shot.playerId]);
      later(260, () => setFiring((list) => list.filter((id) => id !== shot.playerId)));
      heroRefs.current.get(shot.playerId)?.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-9px) rotate(-3deg)" }, { transform: "translateX(0)" }],
        { duration: 280, easing: "ease-out" }
      );
      const target = monsterLeftRef.current;
      later(FLIGHT_MS, () => {
        if (shot.hit) {
          playTankHit();
          impact(target + 8, `-${shotDamage}`);
        } else {
          add({ id: nextId(), kind: "pop", left: target - 4, text: "Hụt!", tone: "miss" }, 1300);
        }
      });
    }

    // Round wrap-up: a combo blast, or the monster's counter-attack.
    if (phase === "result" && roundId && seenRound.current !== roundId) {
      seenRound.current = roundId;
      if (combo) {
        const shooters = players.filter((player) => player.hero);
        const from = shooters.reduce((sum, _player, index) => sum + heroLeft(index, shooters.length), 0) / Math.max(1, shooters.length) + 10;
        later(250, () => {
          playUltimateReady();
          add({ id: nextId(), kind: "combo" }, 1700);
          add({ id: nextId(), kind: "orb", from, to: MONSTER_START + 8 }, ORB_MS);
          later(ORB_MS, () => {
            playTankBigExplosion();
            impact(MONSTER_START + 8, `-${comboDamage} COMBO`, true);
          });
        });
      } else if (roundDamage === 0) {
        monsterRef.current?.animate(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-190px) rotate(-6deg)", offset: 0.35 },
            { transform: "translateX(-170px) rotate(-3deg)", offset: 0.55 },
            { transform: "translateX(0)" },
          ],
          { duration: 1100, easing: "cubic-bezier(0.3, 0, 0.3, 1)" }
        );
        later(380, () => {
          playTankHit();
          shake(1.4);
          heroRefs.current.forEach((hero) =>
            hero.animate([{ transform: "translateX(0)" }, { transform: "translateX(-14px) rotate(-7deg)" }, { transform: "translateX(0)" }], { duration: 450, easing: "ease-out" })
          );
        });
      } else {
        monsterRef.current?.animate([{ transform: "translateX(0) rotate(0)" }, { transform: "translateX(36px) rotate(7deg)" }, { transform: "translateX(0) rotate(0)" }], {
          duration: 650,
          easing: "ease-out",
        });
      }
    }
  }, [shots, players, phase, roundId, combo, roundDamage, comboDamage, shotDamage]);

  const heroes = players;
  const indexOf = new Map(heroes.map((player, index) => [player.id, index]));
  const hpPct = bossMaxHp > 0 ? clamp01(bossHp / bossMaxHp) * 100 : 100;

  return (
    <div ref={sceneRef} className="relative h-[22rem] w-full">
      <div className="absolute inset-0 overflow-hidden rounded-3xl border-4 shadow-[0_10px_0_rgba(43,29,58,0.35)]" style={{ borderColor: OUTLINE }}>
        <Scenery />
      </div>

      {heroes.map((player, index) => (
        <div key={player.id} className="absolute flex w-36 flex-col items-center" style={{ left: `${heroLeft(index, heroes.length)}%`, bottom: GROUND_PX }}>
          <span
            className="mb-0.5 max-w-[9rem] truncate rounded-full border-[3px] px-3 py-0.5 font-draw-display text-sm font-extrabold text-white"
            style={{ borderColor: OUTLINE, backgroundColor: player.hero ? HERO_PALETTE[player.hero.color].main : "#94a3b8" }}
          >
            {player.name}
          </span>
          <div ref={(node) => { if (node) heroRefs.current.set(player.id, node); else heroRefs.current.delete(player.id); }}>
            {player.hero ? (
              <div className={phase === "victory" ? "mb-hero-cheer" : "mb-hero-idle"}>
                <HeroSprite hero={player.hero} firing={firing.includes(player.id)} className="h-36 w-36" />
              </div>
            ) : (
              <div className="flex h-36 w-36 items-center justify-center font-draw-display text-6xl font-black text-white/70 drop-shadow">?</div>
            )}
          </div>
        </div>
      ))}

      <div
        className="absolute"
        style={{ left: `${monsterLeft}%`, bottom: GROUND_PX - 4, transition: `left ${phase === "question" ? "0.12s linear" : "0.7s ease-out"}` }}
      >
        <div ref={monsterRef}>
          <div className={phase === "victory" ? "mb2-faint" : ""}>
            {phase !== "victory" && (
              <div className="mx-auto mb-1 h-4 w-40 overflow-hidden rounded-full border-[3px] bg-[#3b0764]" style={{ borderColor: OUTLINE }}>
                <div className="h-full rounded-full bg-gradient-to-b from-[#fb7185] to-[#e11d48] transition-[width] duration-500" style={{ width: `${hpPct}%` }} />
              </div>
            )}
            <MonsterSprite mood={mood} rage={rage} screen={screen} className="h-[15rem] w-[13rem]" />
          </div>
        </div>
        {speech && (
          <div
            className="animate-bounce-in absolute -top-12 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-2xl border-[3px] bg-white px-4 py-1.5 font-draw-display text-lg font-extrabold text-[#2b1d3a] shadow-lg"
            style={{ borderColor: OUTLINE }}
          >
            {speech}
          </div>
        )}
      </div>

      {shots.map((shot) => {
        const shooter = players.find((player) => player.id === shot.playerId);
        if (!shooter?.hero) return null;
        const from = heroLeft(indexOf.get(shot.playerId) ?? 0, heroes.length) + 9;
        const target = targets.current.get(shot.id) ?? monsterLeft;
        return (
          <div
            key={shot.id}
            className={`pointer-events-none absolute z-20 ${shot.hit ? "mb-shot-hit" : "mb-shot-miss"}`}
            style={{ "--from": `${from}%`, "--to": `${shot.hit ? target + 3 : target - 6}%`, "--dur": `${FLIGHT_MS}ms`, bottom: SHOT_BOTTOM_PX } as CSSProperties}
          >
            <Projectile weapon={shooter.hero.weapon} color={shooter.hero.color} />
          </div>
        );
      })}

      {effects.map((effect) => <EffectView key={effect.id} effect={effect} />)}
    </div>
  );
}

function EffectView({ effect }: { effect: Effect }) {
  switch (effect.kind) {
    case "burst":
      return (
        <svg
          viewBox="-60 -60 120 120"
          className={`mb2-burst pointer-events-none absolute z-30 ${effect.big ? "h-64 w-64" : "h-36 w-36"}`}
          style={{ left: `${effect.left}%`, bottom: IMPACT_BOTTOM_PX }}
          aria-hidden
        >
          <polygon
            points={Array.from({ length: 16 }, (_, index) => {
              const radius = index % 2 ? 24 : 56;
              const angle = (index / 16) * Math.PI * 2;
              return `${Math.cos(angle) * radius},${Math.sin(angle) * radius}`;
            }).join(" ")}
            fill="#fde047"
            stroke={OUTLINE}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <circle r="20" fill="white" />
        </svg>
      );
    case "sparks":
      return (
        <>
          {effect.sparks.map((spark, index) => (
            <span
              key={index}
              className="mb2-spark pointer-events-none absolute z-30 rounded-full"
              style={{
                left: `${effect.left}%`,
                bottom: IMPACT_BOTTOM_PX,
                width: spark.size,
                height: spark.size,
                backgroundColor: spark.color,
                boxShadow: `0 0 8px ${spark.color}`,
                "--dx": `${spark.dx}px`,
                "--dy": `${spark.dy}px`,
              } as CSSProperties}
            />
          ))}
        </>
      );
    case "pop":
      return (
        <span
          className={`mb2-pop mb2-outline-text pointer-events-none absolute z-40 whitespace-nowrap font-draw-display font-black ${
            effect.tone === "miss" ? "text-4xl text-slate-200" : effect.tone === "combo" ? "text-6xl text-amber-300" : "text-6xl text-yellow-300"
          }`}
          style={{ left: `${effect.left}%`, bottom: IMPACT_BOTTOM_PX + 40 }}
        >
          {effect.text}
        </span>
      );
    case "orb":
      return (
        <span
          className="mb2-orb pointer-events-none absolute z-30 h-24 w-24 rounded-full"
          style={{
            "--from": `${effect.from}%`,
            "--to": `${effect.to}%`,
            bottom: IMPACT_BOTTOM_PX - 30,
            background: "radial-gradient(circle, #ffffff 0%, #fde047 35%, #f97316 65%, rgba(249,115,22,0) 72%)",
            boxShadow: "0 0 40px 12px rgba(253, 224, 71, 0.75)",
          } as CSSProperties}
        />
      );
    case "combo":
      return (
        <span className="mb2-combo mb2-outline-text pointer-events-none absolute left-1/2 top-1/3 z-50 whitespace-nowrap font-draw-display text-8xl font-black italic text-amber-300 drop-shadow-[0_8px_0_rgba(43,29,58,0.5)]">
          COMBO!
        </span>
      );
  }
}
