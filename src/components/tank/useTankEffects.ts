"use client";

// Every reactive "something happened, spawn a cosmetic effect and/or play a
// sound" concern lives here, detected purely by diffing consecutive `state`
// snapshots — none of this affects gameplay, it's all client-only juice.
// TankCanvas's draw loop reads the ref lists this returns every frame.

import { useEffect, useRef, useState } from "react";
import { TANK_SKINS, ULTIMATE_CONFIG, getMap, skinForColor, type Bullet, type TankPublicState } from "@shared/tankTypes";
import { getSprite } from "@/lib/imageCache";
import {
  playBoostStart,
  playBombBoom,
  playBombWhistle,
  playFireIgnite,
  playPlaneRoar,
  playSandWave,
  playShieldBlock,
  playStunned,
  playTankBigExplosion,
  playTankDestroyed,
  playTankExplosion,
  playTankHit,
  playTankImpact,
  playTankPickup,
  playUltimateReady,
} from "@/lib/sound";
import {
  BOMB_EXPLOSION_FRAMES,
  EXPLOSION_FRAMES,
  type Explosion,
  type LeafParticle,
  type MuzzleFlash,
  type OilSpill,
  type SandWaveEffect,
  type SkidMark,
  spawnLeafBurst,
} from "./render/effects";
import { tileCharAt } from "./render/map-background";
import { BOMB_FALL_MS, FALLING_BOMB_FRAMES, PLANE_FRAMES } from "./render/airstrike";

function preloadTankSprites() {
  const roadNames = ["North", "East", "CornerUL", "CornerUR", "CornerLL", "CornerLR", "SplitN", "SplitS", "SplitE", "SplitW", "Crossing"];
  const skins: string[] = [...TANK_SKINS];
  const srcs = [
    "/Retina/tileGrass1.png",
    "/Retina/tileGrass2.png",
    "/Retina/tileSand1.png",
    "/Retina/tileSand2.png",
    "/Retina/sandbagBeige.png",
    "/Retina/sandbagBrown.png",
    "/Retina/crateWood.png",
    "/Retina/treeGreen_large.png",
    "/Retina/treeGreen_small.png",
    "/Retina/treeBrown_large.png",
    "/Retina/treeGreen_leaf.png",
    "/Retina/treeBrown_leaf.png",
    "/Retina/treeGreen_twigs.png",
    "/Retina/treeBrown_twigs.png",
    "/Retina/oilSpill_small.png",
    "/trap_scope.png",
    "/Retina/shotOrange.png",
    "/Retina/shotRed.png",
    "/Retina/bulletDark1_outline.png",
    ...roadNames.flatMap((n) => [`/Retina/tileGrass_road${n}.png`, `/Retina/tileSand_road${n}.png`]),
    ...skins.flatMap((s) => [`/Retina/tankBody_${s}.png`, `/Retina/tank_${s}.png`]),
    ...["Blue", "Dark", "Green", "Red", "Sand"].flatMap((s) => [`/Retina/tank${s}_barrel1.png`, `/Retina/bullet${s}1_outline.png`]),
    ...EXPLOSION_FRAMES,
    ...PLANE_FRAMES,
    ...FALLING_BOMB_FRAMES,
    ...BOMB_EXPLOSION_FRAMES,
  ];
  for (const src of srcs) getSprite(src);
}

export function useTankEffects(state: TankPublicState, selfId: string) {
  const explosionsRef = useRef<Explosion[]>([]);
  const marksRef = useRef<SkidMark[]>([]);
  const oilSpillsRef = useRef<OilSpill[]>([]);
  const muzzleFlashesRef = useRef<MuzzleFlash[]>([]);
  const leavesRef = useRef<LeafParticle[]>([]);
  const sandWavesRef = useRef<SandWaveEffect[]>([]);
  const prevBulletsRef = useRef<Map<string, Bullet>>(new Map());

  // Kick every sprite this screen could possibly need off loading the moment
  // the match starts, instead of discovering each one lazily mid-frame (which
  // was making buildMapBackground/etc. redo their full tile scan on every
  // rAF tick until each image happened to finish loading).
  useEffect(() => {
    preloadTankSprites();
  }, []);

  // A tank driving into a bush kicks up a little burst of leaves — purely
  // cosmetic, detected client-side the same way as everything else here.
  const prevBushByPlayerRef = useRef<Map<string, boolean>>(new Map());
  useEffect(() => {
    const m = getMap(state.mapId);
    const prevBush = prevBushByPlayerRef.current;
    const seenIds = new Set<string>();
    for (const p of state.players) {
      seenIds.add(p.id);
      if (!p.alive) {
        prevBush.set(p.id, false);
        continue;
      }
      const onBush = tileCharAt(m, p.x, p.y) === "B";
      if (onBush && !prevBush.get(p.id)) spawnLeafBurst(leavesRef, p.x, p.y);
      prevBush.set(p.id, onBush);
    }
    for (const id of prevBush.keys()) {
      if (!seenIds.has(id)) prevBush.delete(id);
    }
  }, [state.players, state.mapId]);

  // A burst ring the instant any tank's ultimate activates (currently just
  // Blue's rapid-fire buff) — visible to everyone watching, not just an
  // optimistic echo for whoever pressed the button, matching how other
  // impact effects (shove, trap) are shared state rather than a local-only
  // cue. Future per-skin ultimates just need to be added to this check.
  const prevUltimateActiveByPlayerRef = useRef<Map<string, boolean>>(new Map());
  useEffect(() => {
    const prevActive = prevUltimateActiveByPlayerRef.current;
    const seenIds = new Set<string>();
    for (const p of state.players) {
      seenIds.add(p.id);
      const isActive = !!p.rapidFireUntil && p.rapidFireUntil > state.serverNow;
      if (isActive && !prevActive.get(p.id)) {
        explosionsRef.current.push({ id: `ultimate-${p.id}-${performance.now()}`, x: p.x, y: p.y, start: performance.now(), kind: "ultimate" });
      }
      prevActive.set(p.id, isActive);
    }
    for (const id of prevActive.keys()) {
      if (!seenIds.has(id)) prevActive.delete(id);
    }
  }, [state.players, state.serverNow]);

  // Any tank losing HP (not just self) leaves an oil spill on the ground
  // where it was hit — a lingering scar of the fight, not tied to whichever
  // client happens to be watching.
  const prevHpByPlayerRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const prevHp = prevHpByPlayerRef.current;
    for (const p of state.players) {
      const last = prevHp.get(p.id);
      if (last !== undefined && p.hp < last) {
        oilSpillsRef.current.push({ id: `${p.id}-${p.hp}-${performance.now()}`, x: p.x, y: p.y, start: performance.now() });
      }
      prevHp.set(p.id, p.hp);
    }
  }, [state.players]);

  // Detect bullets that vanished between broadcasts (hit a wall or a tank —
  // the server doesn't distinguish, it just stops including them) and spawn
  // a short-lived explosion at their last known spot. Purely cosmetic.
  useEffect(() => {
    const prev = prevBulletsRef.current;
    const now = new Map<string, Bullet>();
    for (const b of state.bullets) now.set(b.id, b);

    for (const [id, last] of prev) {
      if (!now.has(id)) {
        explosionsRef.current.push({ id, x: last.x, y: last.y, start: performance.now(), kind: last.kind });
        if (last.kind === "big") playTankBigExplosion();
        else playTankExplosion();
      }
    }
    // A bullet that's brand new this broadcast just left the barrel — flash
    // the muzzle at its spawn spot.
    for (const [id, b] of now) {
      if (!prev.has(id)) {
        muzzleFlashesRef.current.push({ id, x: b.x, y: b.y, angle: b.angle, start: performance.now() });
      }
    }
    prevBulletsRef.current = now;
  }, [state.bullets]);

  // Shoves and trap triggers are single-tick server events — every broadcast
  // that carries one is brand new, so just spawn the matching effect for
  // whatever's in the array right now.
  useEffect(() => {
    if (state.impacts.length === 0) return;
    const now = performance.now();
    let sawShove = false;
    let sawTrap = false;
    let sawShield = false;
    let sawCrate = false;
    let sawBomb = false;
    let sawSandWave = false;
    for (const imp of state.impacts) {
      if (imp.kind === "shove") {
        explosionsRef.current.push({ id: imp.id, x: imp.x, y: imp.y, start: now, kind: "shove" });
        marksRef.current.push({ id: imp.id, x: imp.x, y: imp.y, start: now });
        sawShove = true;
      } else if (imp.kind === "shield") {
        explosionsRef.current.push({ id: imp.id, x: imp.x, y: imp.y, start: now, kind: "shield" });
        sawShield = true;
      } else if (imp.kind === "crate") {
        explosionsRef.current.push({ id: imp.id, x: imp.x, y: imp.y, start: now, kind: "crate" });
        sawCrate = true;
      } else if (imp.kind === "bomb") {
        explosionsRef.current.push({ id: imp.id, x: imp.x, y: imp.y, start: now, kind: "bomb", radius: imp.radius });
        sawBomb = true;
      } else if (imp.kind === "sand_wave") {
        sandWavesRef.current.push({ id: imp.id, x: imp.x, y: imp.y, angle: imp.angle ?? 0, start: now });
        sawSandWave = true;
      } else {
        explosionsRef.current.push({ id: imp.id, x: imp.x, y: imp.y, start: now, kind: "normal" });
        sawTrap = true;
      }
    }
    if (sawShove) playTankImpact();
    if (sawTrap) playTankExplosion();
    if (sawShield) playShieldBlock();
    if (sawCrate) playTankExplosion();
    if (sawBomb) playBombBoom();
    if (sawSandWave) playSandWave();
  }, [state.impacts]);

  // Airstrike audio: an engine roar for the whole flight (played once, the
  // moment a strike is first seen) and a falling whistle right as the bombs
  // start their visible drop (see BOMB_FALL_MS) — both keyed by strike id so
  // each one only fires once no matter how many state broadcasts land while
  // it's active.
  const airstrikeRoarPlayedRef = useRef<Set<string>>(new Set());
  const airstrikeWhistlePlayedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const liveIds = new Set(state.airstrikes.map((s) => s.id));
    for (const strike of state.airstrikes) {
      if (!airstrikeRoarPlayedRef.current.has(strike.id)) {
        airstrikeRoarPlayedRef.current.add(strike.id);
        playPlaneRoar(strike.planeArriveAt - strike.planeDepartAt);
      }
      if (!airstrikeWhistlePlayedRef.current.has(strike.id) && state.serverNow >= strike.strikeAt - BOMB_FALL_MS) {
        airstrikeWhistlePlayedRef.current.add(strike.id);
        playBombWhistle(BOMB_FALL_MS);
      }
    }
    for (const id of airstrikeRoarPlayedRef.current) {
      if (!liveIds.has(id)) airstrikeRoarPlayedRef.current.delete(id);
    }
    for (const id of airstrikeWhistlePlayedRef.current) {
      if (!liveIds.has(id)) airstrikeWhistlePlayedRef.current.delete(id);
    }
  }, [state.airstrikes, state.serverNow]);

  // PUBG-style kill feed: each elimination event gets a line in the top-right
  // corner for a few seconds, then fades out of the list.
  const [killFeed, setKillFeed] = useState<{ id: string; text: string; expiresAt: number }[]>([]);
  useEffect(() => {
    if (state.kills.length === 0) return;
    const now = Date.now();
    setKillFeed((prev) => [
      ...prev,
      ...state.kills.map((k) => ({
        id: k.id,
        text: k.killerName ? `${k.killerName} đã hạ gục ${k.victimName}` : `${k.victimName} đã gục ngã`,
        expiresAt: now + 4000,
      })),
    ]);
  }, [state.kills]);
  useEffect(() => {
    if (killFeed.length === 0) return;
    const t = setTimeout(() => {
      const now = Date.now();
      setKillFeed((prev) => prev.filter((f) => f.expiresAt > now));
    }, 500);
    return () => clearTimeout(t);
  }, [killFeed]);

  // Reactive sound cues from the self tank's own state changes — took
  // damage (bullet/trap/hazard), or picked something up off the ground.
  const prevSelfRef = useRef<{
    hp: number;
    itemCount: number;
    burning: boolean;
    stunned: boolean;
    alive: boolean;
    isBoosting: boolean;
    ultimateEnergy: number;
  } | null>(null);
  useEffect(() => {
    const self = state.players.find((p) => p.id === selfId);
    if (!self) return;
    const isBurning = !!self.burningUntil && self.burningUntil > state.serverNow;
    const isStunned = !!self.stunnedUntil && self.stunnedUntil > state.serverNow;
    const prev = prevSelfRef.current;
    if (prev) {
      if (!self.alive && prev.alive) playTankDestroyed();
      else if (self.hp < prev.hp) playTankHit();
      else if (self.hp > prev.hp || self.items.length > prev.itemCount) playTankPickup();
      if (isBurning && !prev.burning) playFireIgnite();
      if (isStunned && !prev.stunned) playStunned();
      if (self.isBoosting && !prev.isBoosting) playBoostStart();
      const maxEnergy = ULTIMATE_CONFIG[skinForColor(self.color)].maxEnergy;
      if (self.ultimateEnergy >= maxEnergy && prev.ultimateEnergy < maxEnergy) playUltimateReady();
    }
    prevSelfRef.current = {
      hp: self.hp,
      itemCount: self.items.length,
      burning: isBurning,
      stunned: isStunned,
      alive: self.alive,
      isBoosting: self.isBoosting,
      ultimateEnergy: self.ultimateEnergy,
    };
  }, [state.players, selfId, state.serverNow]);

  return { explosionsRef, marksRef, oilSpillsRef, muzzleFlashesRef, leavesRef, sandWavesRef, killFeed };
}
