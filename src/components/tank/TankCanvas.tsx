"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BUSH_REVEAL_RADIUS,
  CRATE_MAX_HP,
  CRATE_SIZE,
  FIRE_COOLDOWN_MS,
  MAX_BOOST_ENERGY,
  MAX_HP,
  MAX_ULTIMATE_ENERGY,
  MONSTER_HP,
  MONSTER_SIZE,
  NEST_PUDDLE_RADIUS,
  PICKUP_SIZE,
  TANK_COLORS,
  TANK_SIZE,
  TANK_SKINS,
  TANK_SKINS_WITH_TURRET,
  TICK_MS,
  TILE_SIZE,
  TRAP_SIZE,
  VIEWPORT_H,
  VIEWPORT_W,
  VISION_RADIUS,
  getMap,
  mapCanvasSize,
  type Bullet,
  type Crate,
  type Direction,
  type Monster,
  type TankClientMessage,
  type TankPlayer,
  type TankPublicState,
  type TankSkin,
} from "@shared/tankTypes";
import {
  playTankBigExplosion,
  playTankBigShot,
  playTankExplosion,
  playTankHit,
  playTankImpact,
  playTankPickup,
  playTankShoot,
  playShieldBlock,
  playFireIgnite,
} from "@/lib/sound";
import { getSprite } from "@/lib/imageCache";

interface Props {
  state: TankPublicState;
  selfId: string;
  send: (msg: TankClientMessage) => void;
}

const KEY_MAP: Record<string, "up" | "down" | "left" | "right"> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

const DIR_ANGLE: Record<Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

type ExplosionKind = "normal" | "blind" | "shove" | "big" | "shield" | "fire" | "crate";
const EXPLOSION_DURATION_MS = 380;
function explosionDurationFor(kind: ExplosionKind): number {
  if (kind === "big") return 520;
  if (kind === "shield") return 220;
  return EXPLOSION_DURATION_MS;
}

// The pack's explosion1..5 are a flipbook (small flash -> big starburst ->
// cooling ring -> dissipating embers), not standalone icons — playing them
// in order over an explosion's lifetime is what makes it read as one blast.
const EXPLOSION_FRAMES = [
  "/Retina/explosion1.png",
  "/Retina/explosion2.png",
  "/Retina/explosion3.png",
  "/Retina/explosion4.png",
  "/Retina/explosion5.png",
];
// explosion1 is a plain white flash silhouette; the rest already ship their
// own orange/yellow color, so only tint kinds that need a different palette.
const EXPLOSION_TINT: Partial<Record<ExplosionKind, string>> = {
  blind: "#a855f7",
  shove: "#fde68a",
  crate: "#c2825a",
  big: "#ef4444",
};
const MINIMAP_W = 110;
const MINIMAP_H = 82;

function clampCamera(pos: number, viewport: number, mapSize: number): number {
  const half = viewport / 2;
  if (mapSize <= viewport) return mapSize / 2;
  return Math.min(Math.max(pos, half), mapSize - half);
}

function tileCharAt(m: ReturnType<typeof getMap>, x: number, y: number): string {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  return m.layout[row]?.[col] ?? "#";
}

/** Deterministic per-tile PRNG — same tile always gets the same "random"
 * texture/foliage layout, so nothing flickers or reshuffles between frames. */
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isWallTile(m: ReturnType<typeof getMap>, row: number, col: number): boolean {
  return (m.layout[row]?.[col] ?? "#") === "#";
}

function isRoadTile(m: ReturnType<typeof getMap>, row: number, col: number): boolean {
  return m.layout[row]?.[col] === "R";
}

/** Picks the right connected-road sprite name (Kenney "Tanks" pack naming)
 * for a road tile based on which of its 4 orthogonal neighbors are also
 * road — a straight, corner, T-junction ("Split"), or 4-way crossing. */
function roadTileName(n: boolean, s: boolean, e: boolean, w: boolean): string {
  const count = [n, s, e, w].filter(Boolean).length;
  if (count >= 4) return "roadCrossing";
  if (count === 3) {
    if (!s) return "roadSplitN";
    if (!n) return "roadSplitS";
    if (!w) return "roadSplitE";
    return "roadSplitW";
  }
  if (count === 2) {
    if (n && s) return "roadNorth";
    if (e && w) return "roadEast";
    if (n && w) return "roadCornerUL";
    if (n && e) return "roadCornerUR";
    if (s && w) return "roadCornerLL";
    if (s && e) return "roadCornerLR";
  }
  // Dead-end or isolated tile: fall back to whichever straight piece matches
  // the one connection it does have (the pack has no dedicated end-cap art).
  if (n || s) return "roadNorth";
  return "roadEast";
}

function drawEdgeTufts(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: "top" | "bottom" | "left" | "right",
  rng: () => number
) {
  ctx.strokeStyle = "rgba(21,128,61,0.6)";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const t = 4 + rng() * (TILE_SIZE - 8);
    const len = 6 + rng() * 3;
    let bx = x;
    let by = y;
    let dx = 0;
    let dy = 0;
    if (side === "top") {
      bx = x + t;
      by = y + 2;
      dy = len;
    } else if (side === "bottom") {
      bx = x + t;
      by = y + TILE_SIZE - 2;
      dy = -len;
    } else if (side === "left") {
      bx = x + 2;
      by = y + t;
      dx = len;
    } else {
      bx = x + TILE_SIZE - 2;
      by = y + t;
      dx = -len;
    }
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + dx, by + dy);
    ctx.stroke();
  }
}

/**
 * Pre-renders the whole map's static ground/walls to an offscreen canvas
 * once per map (cached by mapId) — real Kenney floor tiles (grass or sand,
 * per the map's `terrain`) plus procedural wall shading and hazard tint, no
 * per-tile grid lines. Bushes/trees and hazard glow are animated, so those
 * are drawn live every frame instead. Returns null (and draws nothing) if
 * the floor tile sprites haven't finished loading yet — the caller should
 * fall back to a plain fill and retry next frame rather than cache a blank.
 */
function buildMapBackground(m: ReturnType<typeof getMap>): HTMLCanvasElement | null {
  const floorSrcs =
    m.terrain === "sand" ? ["/Retina/tileSand1.png", "/Retina/tileSand2.png"] : ["/Retina/tileGrass1.png", "/Retina/tileGrass2.png"];
  const floorTiles = floorSrcs.map(getSprite);
  if (floorTiles.some((img) => !img)) return null;

  // Only this map's actually-used road variants need to be ready — gating on
  // the full 18-sprite set would delay every map's first paint needlessly.
  const roadPrefix = m.terrain === "sand" ? "tileSand" : "tileGrass";
  const neededRoadSrcs = new Set<string>();
  for (let row = 0; row < m.layout.length; row++) {
    for (let col = 0; col < m.layout[row].length; col++) {
      if (!isRoadTile(m, row, col)) continue;
      const name = roadTileName(isRoadTile(m, row - 1, col), isRoadTile(m, row + 1, col), isRoadTile(m, row, col + 1), isRoadTile(m, row, col - 1));
      neededRoadSrcs.add(`/Retina/${roadPrefix}_${name}.png`);
    }
  }
  if ([...neededRoadSrcs].some((src) => !getSprite(src))) return null;

  const { w, h } = mapCanvasSize(m);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  for (let row = 0; row < m.layout.length; row++) {
    for (let col = 0; col < m.layout[row].length; col++) {
      const tile = m.layout[row][col];
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      const rng = mulberry32(row * 7919 + col * 104729);

      if (tile === "#") {
        // Ground shows underneath (sandbag art doesn't fill a perfect square),
        // then a real sandbag sprite as the obstacle itself.
        ctx.drawImage(floorTiles[rng() > 0.5 ? 1 : 0]!, x, y, TILE_SIZE, TILE_SIZE);
        const wallImg = getSprite(rng() > 0.5 ? "/Retina/sandbagBeige.png" : "/Retina/sandbagBrown.png");
        if (wallImg) {
          ctx.drawImage(wallImg, x - 1, y - 1, TILE_SIZE + 2, TILE_SIZE + 2);
        } else {
          ctx.fillStyle = "#8a7355";
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }
        // Soft contact shadow where this wall meets open floor, for depth.
        if (!isWallTile(m, row - 1, col)) {
          ctx.fillStyle = "rgba(255,255,255,0.14)";
          ctx.fillRect(x, y, TILE_SIZE, 3);
        }
        if (!isWallTile(m, row + 1, col)) {
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
        }
        continue;
      }

      const floorImg = floorTiles[rng() > 0.75 ? 1 : 0]!;
      ctx.drawImage(floorImg, x, y, TILE_SIZE, TILE_SIZE);

      if (tile === "R") {
        const prefix = m.terrain === "sand" ? "tileSand" : "tileGrass";
        const name = roadTileName(isRoadTile(m, row - 1, col), isRoadTile(m, row + 1, col), isRoadTile(m, row, col + 1), isRoadTile(m, row, col - 1));
        const roadImg = getSprite(`/Retina/${prefix}_${name}.png`);
        if (roadImg) ctx.drawImage(roadImg, x, y, TILE_SIZE, TILE_SIZE);
      }

      if (tile === "H") {
        ctx.fillStyle = "rgba(127,29,29,0.16)";
        ctx.beginPath();
        ctx.ellipse(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 2 - 2, TILE_SIZE / 2 - 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isWallTile(m, row - 1, col)) drawEdgeTufts(ctx, x, y, "top", rng);
      if (isWallTile(m, row + 1, col)) drawEdgeTufts(ctx, x, y, "bottom", rng);
      if (isWallTile(m, row, col - 1)) drawEdgeTufts(ctx, x, y, "left", rng);
      if (isWallTile(m, row, col + 1)) drawEdgeTufts(ctx, x, y, "right", rng);

      // Scattered twig/pebble litter on plain floor tiles — purely decorative
      // ground clutter, baked into the static background so it costs nothing
      // per frame. Sparse (~1 in 9 tiles) so it reads as texture, not noise.
      if (tile === "." && rng() < 0.11) {
        const twigImg = getSprite(m.terrain === "sand" ? "/Retina/treeBrown_twigs.png" : "/Retina/treeGreen_twigs.png");
        if (twigImg) {
          const size = TILE_SIZE * 0.7;
          ctx.save();
          ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
          ctx.rotate(rng() * Math.PI * 2);
          ctx.drawImage(twigImg, -size / 2, -size / 2, size, size);
          ctx.restore();
        }
      }
    }
  }
  // A light overall darkening so bright foreground elements (bullets, tanks,
  // pickups) read clearly against the floor art instead of blending into it.
  ctx.fillStyle = "rgba(15,23,42,0.12)";
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

/** Same "server sends everything, client just doesn't render it" trick used
 * for the blind item's fog-of-war: bushes hide enemy tanks standing in them
 * unless the viewer is close enough to have spotted them anyway. */
function isBushHidden(m: ReturnType<typeof getMap>, target: TankPlayer, self: TankPlayer): boolean {
  if (tileCharAt(m, target.x, target.y) !== "B") return false;
  return Math.hypot(target.x - self.x, target.y - self.y) > BUSH_REVEAL_RADIUS;
}

/** Small always-visible overview of the whole map — walls, hazards, every
 * tank's dot, and a frame showing the main camera's current viewport. */
// The minimap's walls/hazards/bushes never change during a match — pre-
// render them once per map instead of re-scanning every tile every frame.
const minimapBgCache = new Map<string, HTMLCanvasElement>();
function getMinimapBackground(m: ReturnType<typeof getMap>): HTMLCanvasElement {
  const cached = minimapBgCache.get(m.id);
  if (cached) return cached;

  const { w: mapW, h: mapH } = mapCanvasSize(m);
  const scaleX = MINIMAP_W / mapW;
  const scaleY = MINIMAP_H / mapH;
  const off = document.createElement("canvas");
  off.width = MINIMAP_W;
  off.height = MINIMAP_H;
  const octx = off.getContext("2d")!;
  octx.fillStyle = "#0f172a";
  octx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);

  for (let row = 0; row < m.layout.length; row++) {
    for (let col = 0; col < m.layout[row].length; col++) {
      const tile = m.layout[row][col];
      if (tile === "#") octx.fillStyle = "#475569";
      else if (tile === "H") octx.fillStyle = "#dc2626";
      else if (tile === "B") octx.fillStyle = "#166534";
      else continue;
      octx.fillRect(col * TILE_SIZE * scaleX, row * TILE_SIZE * scaleY, TILE_SIZE * scaleX + 0.5, TILE_SIZE * scaleY + 0.5);
    }
  }
  minimapBgCache.set(m.id, off);
  return off;
}

function drawMinimap(
  canvas: HTMLCanvasElement | null,
  s: TankPublicState,
  m: ReturnType<typeof getMap>,
  selfId: string,
  camX: number,
  camY: number
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { w: mapW, h: mapH } = mapCanvasSize(m);
  const scaleX = MINIMAP_W / mapW;
  const scaleY = MINIMAP_H / mapH;

  ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);
  ctx.drawImage(getMinimapBackground(m), 0, 0);

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect((camX - VIEWPORT_W / 2) * scaleX, (camY - VIEWPORT_H / 2) * scaleY, VIEWPORT_W * scaleX, VIEWPORT_H * scaleY);

  ctx.fillStyle = "#92400e";
  for (const crate of s.crates) {
    ctx.fillRect(crate.x * scaleX - 1.5, crate.y * scaleY - 1.5, 3, 3);
  }

  for (const monster of s.monsters) {
    if (!monster.alive) continue;
    ctx.fillStyle = "#a855f7";
    const mx = monster.x * scaleX;
    const my = monster.y * scaleY;
    ctx.beginPath();
    ctx.moveTo(mx, my - 2.5);
    ctx.lineTo(mx + 2.5, my);
    ctx.lineTo(mx, my + 2.5);
    ctx.lineTo(mx - 2.5, my);
    ctx.closePath();
    ctx.fill();
  }

  for (const p of s.players) {
    if (!p.alive) continue;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x * scaleX, p.y * scaleY, p.id === selfId ? 3 : 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (p.id === selfId) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

interface Explosion {
  id: string;
  x: number;
  y: number;
  start: number;
  kind: ExplosionKind;
}

const MARK_DURATION_MS = 3200;
interface SkidMark {
  id: string;
  x: number;
  y: number;
  start: number;
}

const OIL_SPILL_DURATION_MS = 6500;
interface OilSpill {
  id: string;
  x: number;
  y: number;
  start: number;
}

const MUZZLE_FLASH_DURATION_MS = 110;
interface MuzzleFlash {
  id: string;
  x: number;
  y: number;
  angle: number;
  start: number;
}

function drawMuzzleFlash(ctx: CanvasRenderingContext2D, flash: MuzzleFlash, progress: number) {
  const alpha = 1 - progress;
  const len = 12 * (1 - progress * 0.4);
  ctx.save();
  ctx.translate(flash.x, flash.y);
  ctx.rotate(flash.angle);
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.4, "rgba(254,240,138,0.8)");
  grad.addColorStop(1, "rgba(251,191,36,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, -4);
  ctx.lineTo(len * 1.4, 0);
  ctx.lineTo(len, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const LEAF_PARTICLE_DURATION_MS = 900;
interface LeafParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  sprite: string;
  start: number;
}

function spawnLeafBurst(ref: { current: LeafParticle[] }, x: number, y: number) {
  const count = 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 25 + Math.random() * 35;
    ref.current.push({
      id: `${x}-${y}-${i}-${Math.random()}`,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30, // a little upward pop before gravity takes over
      spin: (Math.random() - 0.5) * 10,
      sprite: Math.random() > 0.5 ? "/Retina/treeGreen_leaf.png" : "/Retina/treeBrown_leaf.png",
      start: performance.now(),
    });
  }
}

function drawLeafParticle(ctx: CanvasRenderingContext2D, leaf: LeafParticle, progress: number) {
  const t = (progress * LEAF_PARTICLE_DURATION_MS) / 1000;
  const gravity = 160;
  const px = leaf.x + leaf.vx * t;
  const py = leaf.y + leaf.vy * t + 0.5 * gravity * t * t;
  const img = getSprite(leaf.sprite);
  const size = 9;
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.translate(px, py);
  ctx.rotate(leaf.spin * t);
  if (img) {
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(-2, -2, 4, 4);
  }
  ctx.restore();
}

function drawOilSpill(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
  const img = getSprite("/Retina/oilSpill_small.png");
  const growIn = Math.min(1, progress * 6); // pops in quickly, then lingers and fades
  const fadeOut = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
  const alpha = growIn * fadeOut * 0.85;
  const size = TANK_SIZE * 1.4;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (img) {
    ctx.drawImage(img, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  } else {
    ctx.fillStyle = "#292524";
    ctx.beginPath();
    ctx.arc(x, y, size / 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, isAlly: boolean) {
  const width = TANK_SIZE + 6;
  const height = 4;
  const barY = y - TANK_SIZE / 2 - 14;
  const pct = Math.max(0, Math.min(1, hp / MAX_HP));
  const left = Math.round(x - width / 2);

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(left, barY, width, height);

  ctx.fillStyle = isAlly ? "#22c55e" : "#ef4444";
  ctx.fillRect(left, barY, Math.round(width * pct), height);

  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(left + 0.5, barY + 0.5, width - 1, height - 1);
}

function skinForColor(color: string): TankSkin {
  const idx = TANK_COLORS.indexOf(color);
  return TANK_SKINS[idx >= 0 ? idx : 0];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function drawTank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  dir: Direction,
  name: string,
  hp: number,
  isSelf: boolean,
  isAlly: boolean,
  isBoosting: boolean,
  shieldHitsLeft: number,
  aimAngle: number | null
) {
  const half = TANK_SIZE / 2;
  drawHealthBar(ctx, x, y, hp, isAlly);

  if (shieldHitsLeft > 0) {
    const radius = half + 8;
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 300);
    ctx.save();
    ctx.fillStyle = `rgba(59,130,246,${0.12 * pulse})`;
    ctx.strokeStyle = `rgba(59,130,246,${0.7 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#3b82f6";
    for (let i = 0; i < shieldHitsLeft; i++) {
      const ang = (i / shieldHitsLeft) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * radius, y + Math.sin(ang) * radius, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (isBoosting) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 150);
    ctx.strokeStyle = `rgba(251,191,36,${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, half + 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Real Kenney "Tanks" sprites (public/Retina): the sprite's own art is
  // drawn facing "up" by default, so rotating by (angle + 90°) points it the
  // right way for our atan2-style angle convention (0 = right, 90° = down).
  const skin = skinForColor(color);
  const bodyAngle = DIR_ANGLE[dir];
  const renderSize = TANK_SIZE * 1.7;

  if (TANK_SKINS_WITH_TURRET.has(skin)) {
    const body = getSprite(`/Retina/tankBody_${skin}.png`);
    if (body) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(bodyAngle + Math.PI / 2);
      const h = renderSize;
      const w = h * (body.width / body.height);
      ctx.drawImage(body, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    const barrel = getSprite(`/Retina/tank${capitalize(skin)}_barrel1.png`);
    if (barrel) {
      const turretAngle = aimAngle ?? bodyAngle;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(turretAngle + Math.PI / 2);
      const h = renderSize * 0.7;
      const w = h * (barrel.width / barrel.height);
      ctx.drawImage(barrel, -w / 2, -h, w, h);
      ctx.restore();
    }
  } else {
    // Heavy skins (bigRed/darkLarge/huge) ship one fused body+turret sprite
    // with no independent aim — the whole vehicle turns to face movement.
    const composed = getSprite(`/Retina/tank_${skin}.png`);
    if (composed) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(bodyAngle + Math.PI / 2);
      const h = renderSize * 1.3;
      const w = h * (composed.width / composed.height);
      ctx.drawImage(composed, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  if (isSelf) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, half + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#1e293b";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.fillText(name, Math.round(x), Math.round(y - half - 20));
}

function drawHealthPickup(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const half = PICKUP_SIZE / 2;
  ctx.fillStyle = "#dcfce7";
  ctx.fillRect(Math.round(x - half), Math.round(y - half), PICKUP_SIZE, PICKUP_SIZE);
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(Math.round(x - half) + 0.5, Math.round(y - half) + 0.5, PICKUP_SIZE - 1, PICKUP_SIZE - 1);
  ctx.fillStyle = "#16a34a";
  const armW = 3;
  ctx.fillRect(Math.round(x - armW / 2), Math.round(y - half + 3), armW, PICKUP_SIZE - 6);
  ctx.fillRect(Math.round(x - half + 3), Math.round(y - armW / 2), PICKUP_SIZE - 6, armW);
}

function drawItemPickup(ctx: CanvasRenderingContext2D, x: number, y: number, kind: "trap" | "blind" | "shield" | "fire") {
  const half = PICKUP_SIZE / 2;
  const palette: Record<typeof kind, [string, string, string]> = {
    trap: ["#fef3c7", "#b45309", "T"],
    blind: ["#ede9fe", "#6d28d9", "M"],
    shield: ["#dbeafe", "#1d4ed8", "S"],
    fire: ["#ffedd5", "#c2410c", "F"],
  };
  const [bg, fg, label] = palette[kind];
  ctx.fillStyle = bg;
  ctx.fillRect(Math.round(x - half), Math.round(y - half), PICKUP_SIZE, PICKUP_SIZE);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(Math.round(x - half) + 0.5, Math.round(y - half) + 0.5, PICKUP_SIZE - 1, PICKUP_SIZE - 1);
  ctx.fillStyle = fg;
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, Math.round(x), Math.round(y) + 1);
  ctx.textBaseline = "alphabetic";
}

function drawHazardSpikes(ctx: CanvasRenderingContext2D, tileX: number, tileY: number, time: number) {
  const pulse = 0.5 + 0.5 * Math.sin(time / 300);
  const cx0 = tileX + TILE_SIZE / 2;
  const cy0 = tileY + TILE_SIZE / 2;
  const glow = ctx.createRadialGradient(cx0, cy0, 2, cx0, cy0, TILE_SIZE / 2);
  glow.addColorStop(0, `rgba(248,113,113,${0.32 + 0.22 * pulse})`);
  glow.addColorStop(1, "rgba(248,113,113,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);

  const spikeCount = 3;
  const spikeW = TILE_SIZE / spikeCount;
  for (let i = 0; i < spikeCount; i++) {
    const cx = tileX + spikeW * i + spikeW / 2;
    const tip = tileY + 5 - pulse * 1.5;
    const grad = ctx.createLinearGradient(cx, tip, cx, tileY + TILE_SIZE - 3);
    grad.addColorStop(0, "#fca5a5");
    grad.addColorStop(1, "#b91c1c");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - spikeW / 2 + 2, tileY + TILE_SIZE - 3);
    ctx.lineTo(cx, tip);
    ctx.lineTo(cx + spikeW / 2 - 2, tileY + TILE_SIZE - 3);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCrate(ctx: CanvasRenderingContext2D, crate: Crate) {
  const img = getSprite("/Retina/crateWood.png");
  const size = CRATE_SIZE * 1.5;
  if (img) {
    ctx.drawImage(img, Math.round(crate.x - size / 2), Math.round(crate.y - size / 2), size, size);
  } else {
    ctx.fillStyle = "#92400e";
    ctx.fillRect(Math.round(crate.x - CRATE_SIZE / 2), Math.round(crate.y - CRATE_SIZE / 2), CRATE_SIZE, CRATE_SIZE);
  }
  if (crate.hp < CRATE_MAX_HP) {
    const barY = crate.y - size / 2 - 8;
    for (let i = 0; i < CRATE_MAX_HP; i++) {
      ctx.fillStyle = i < crate.hp ? "#a16207" : "#334155";
      ctx.fillRect(Math.round(crate.x - size / 2 + i * (size / CRATE_MAX_HP) + 1), barY, Math.round(size / CRATE_MAX_HP - 2), 3);
    }
  }
}

const tintedSpriteCache = new Map<string, HTMLCanvasElement>();

/** Tints a white-on-transparent icon a solid color, cached per (src, color)
 * pair. Compositing happens on a small offscreen buffer — doing it directly
 * on the main canvas would tint whatever's already drawn underneath too. */
function getTintedSprite(src: string, color: string): HTMLCanvasElement | null {
  const key = `${src}|${color}`;
  const cached = tintedSpriteCache.get(key);
  if (cached) return cached;
  const img = getSprite(src);
  if (!img) return null;
  const off = document.createElement("canvas");
  off.width = img.naturalWidth;
  off.height = img.naturalHeight;
  const octx = off.getContext("2d")!;
  octx.drawImage(img, 0, 0);
  octx.globalCompositeOperation = "source-atop";
  octx.fillStyle = color;
  octx.fillRect(0, 0, off.width, off.height);
  tintedSpriteCache.set(key, off);
  return off;
}

function drawTrap(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const tinted = getTintedSprite("/trap_scope.png", "#f59e0b");
  const pulse = 0.75 + 0.25 * Math.sin(time / 260);
  const size = TRAP_SIZE * 1.5;
  if (tinted) {
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.drawImage(tinted, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    ctx.restore();
  } else {
    const half = TRAP_SIZE / 2;
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(Math.round(x - half), Math.round(y - half), TRAP_SIZE, TRAP_SIZE);
    ctx.setLineDash([]);
  }
}

/** The default "big shot" skill's heavy round — a glowing red-orange ember
 * with a short flickering trail, unmistakably beefier than a normal bullet. */
/** Marks a monster's nest on the ground — a muddy puddle, present even while
 * the monster is dead/respawning so the territory always reads as claimed.
 * Also mechanically douses a burning tank that steps into it. */
function drawNestPuddle(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const ripple = 0.5 + 0.5 * Math.sin(time / 700);
  ctx.save();
  ctx.fillStyle = "rgba(87,65,45,0.55)";
  ctx.beginPath();
  ctx.ellipse(x, y, NEST_PUDDLE_RADIUS, NEST_PUDDLE_RADIUS * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(96,165,250,${0.25 + 0.1 * ripple})`;
  ctx.beginPath();
  ctx.ellipse(x, y, NEST_PUDDLE_RADIUS * 0.65, NEST_PUDDLE_RADIUS * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(191,219,254,${0.3 + 0.2 * ripple})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, NEST_PUDDLE_RADIUS * (0.3 + 0.25 * ripple), NEST_PUDDLE_RADIUS * (0.2 + 0.16 * ripple), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Draws `src` centered at (x, y), rotated to face `angle` — the sprite's own
 * art points "up" by default, matching the tank body/turret convention.
 * Returns false (drawing nothing) if the sprite hasn't loaded yet. */
function drawRotatedSprite(ctx: CanvasRenderingContext2D, src: string, x: number, y: number, angle: number, height: number): boolean {
  const img = getSprite(src);
  if (!img) return false;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  const w = height * (img.width / img.height);
  ctx.drawImage(img, -w / 2, -height / 2, w, height);
  ctx.restore();
  return true;
}

const BULLET_SKIN_MAP: Record<TankSkin, "Blue" | "Dark" | "Green" | "Red" | "Sand"> = {
  blue: "Blue",
  dark: "Dark",
  green: "Green",
  red: "Red",
  sand: "Sand",
  bigRed: "Red",
  darkLarge: "Dark",
  huge: "Dark",
};

/** A normal shot — colored to match the shooter's own tank skin. Uses the
 * pack's "_outline" variant (a dark ring around the bullet) so it still
 * reads clearly even against a same-colored floor, e.g. sand bullets over
 * sand terrain. */
function drawNormalBullet(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, skin: TankSkin) {
  const ok = drawRotatedSprite(ctx, `/Retina/bullet${BULLET_SKIN_MAP[skin]}1_outline.png`, x, y, angle, 20);
  if (!ok) {
    ctx.fillStyle = "#facc15";
    ctx.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6);
  }
}

/** The blind item's shot — a generic bullet shape tinted purple. */
function drawBlindBullet(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  const tinted = getTintedSprite("/Retina/bulletDark1_outline.png", "#a855f7");
  if (tinted) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    const h = 18;
    const w = h * (tinted.width / tinted.height);
    ctx.drawImage(tinted, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#a855f7";
    ctx.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6);
  }
}

/** Flame projectile fired while a fire item's charges are active. */
function drawFireBullet(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, time: number) {
  const flicker = 0.75 + 0.25 * Math.sin(time / 40);
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
  glow.addColorStop(0, `rgba(254,240,138,${0.8 * flicker})`);
  glow.addColorStop(1, "rgba(251,146,60,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (!drawRotatedSprite(ctx, "/Retina/shotOrange.png", x, y, angle, 20)) {
    ctx.fillStyle = "#ea580c";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Small flame flicker drawn over a burning tank. */
function drawBurningOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const half = TANK_SIZE / 2;
  for (let i = 0; i < 3; i++) {
    const phase = time / 150 + i * 2.1;
    const fx = x + (i - 1) * 6;
    const fy = y - half - 2 + Math.sin(phase) * 2;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = i % 2 === 0 ? "#f97316" : "#facc15";
    ctx.beginPath();
    ctx.moveTo(fx, fy - 7);
    ctx.quadraticCurveTo(fx + 4, fy - 2, fx, fy + 3);
    ctx.quadraticCurveTo(fx - 4, fy - 2, fx, fy - 7);
    ctx.fill();
    ctx.restore();
  }
}

function drawBigBullet(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, time: number) {
  const flicker = 0.75 + 0.25 * Math.sin(time / 45);
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 13);
  glow.addColorStop(0, `rgba(254,215,170,${0.8 * flicker})`);
  glow.addColorStop(1, "rgba(239,68,68,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (!drawRotatedSprite(ctx, "/Retina/shotRed.png", x, y, angle, 26)) {
    ctx.fillStyle = "#b91c1c";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, kind: ExplosionKind) {
  if (kind === "shield") {
    // A quick blue ripple — a shield absorbing a hit, not an explosion.
    const alpha = 1 - progress;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, (TANK_SIZE / 2 + 8) * (0.6 + 0.4 * progress), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const maxSize = kind === "big" ? 46 : kind === "shove" ? 30 : 24;
  const size = maxSize * (0.4 + 0.6 * Math.min(1, progress * 1.6));
  const alpha = 1 - progress;
  const frameIdx = Math.min(EXPLOSION_FRAMES.length - 1, Math.floor(progress * EXPLOSION_FRAMES.length));
  const tint = EXPLOSION_TINT[kind];
  const sprite = tint ? getTintedSprite(EXPLOSION_FRAMES[frameIdx], tint) : getSprite(EXPLOSION_FRAMES[frameIdx]);

  ctx.save();
  ctx.globalAlpha = alpha;
  if (sprite) {
    ctx.drawImage(sprite, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  } else {
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Faint, slow-fading tire-skid decal left on the ground where a shove landed. */
function drawSkidMark(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
  const alpha = (1 - progress) * 0.45;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 7);
  ctx.lineTo(x + 9, y + 7);
  ctx.moveTo(x - 9, y + 7);
  ctx.lineTo(x + 9, y - 7);
  ctx.stroke();
  ctx.restore();
}

interface BushBias {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

function bushNeighborBias(m: ReturnType<typeof getMap>, row: number, col: number): BushBias {
  return {
    top: isWallTile(m, row - 1, col),
    bottom: isWallTile(m, row + 1, col),
    left: isWallTile(m, row, col - 1),
    right: isWallTile(m, row, col + 1),
  };
}

const BUSH_SPRITES = ["/Retina/treeGreen_large.png", "/Retina/treeGreen_small.png", "/Retina/treeBrown_large.png"];

/**
 * Real tree/bush sprite, deterministically picked+placed per tile (row/col)
 * so it stays stable frame to frame — only the `time`-driven sway moves.
 * `bias` nudges it toward any adjacent wall so it reads as growing out of
 * the terrain instead of floating mid-tile. `opacity` lets the same call be
 * reused as a lighter "foliage in front" overlay for whichever tank is
 * currently standing in this tile (so you can see yourself under the leaves).
 */
function drawBush(
  ctx: CanvasRenderingContext2D,
  tileX: number,
  tileY: number,
  row: number,
  col: number,
  bias: BushBias,
  time: number,
  opacity: number
) {
  const rng = mulberry32(row * 7919 + col * 104729 + 17);
  const img = getSprite(BUSH_SPRITES[Math.floor(rng() * BUSH_SPRITES.length)]);
  const dx = bias.left ? -4 : bias.right ? 4 : 0;
  const dy = bias.top ? -4 : bias.bottom ? 4 : 0;
  const cx = tileX + TILE_SIZE / 2 + dx;
  const cy = tileY + TILE_SIZE / 2 + dy;
  const sway = Math.sin(time / 650 + row * 2.1 + col * 1.7) * 0.06;

  ctx.save();
  ctx.globalAlpha = opacity;
  if (img) {
    const size = TILE_SIZE * 1.2;
    ctx.translate(cx, cy + size * 0.3);
    ctx.rotate(sway);
    ctx.drawImage(img, -size / 2, -size * 0.8, size, size);
  } else {
    ctx.fillStyle = "#166534";
    ctx.beginPath();
    ctx.arc(cx, cy, TILE_SIZE * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMonster(ctx: CanvasRenderingContext2D, monster: Monster) {
  const half = MONSTER_SIZE / 2;
  const wobble = Math.sin(performance.now() / 220 + monster.x) * 1.5;

  // Health pips.
  for (let i = 0; i < MONSTER_HP; i++) {
    ctx.fillStyle = i < monster.hp ? "#a855f7" : "#334155";
    ctx.fillRect(Math.round(monster.x - half + i * (half / 1.2)), monster.y - half - 12, 6, 4);
  }

  ctx.fillStyle = "#3f6212";
  ctx.beginPath();
  ctx.arc(monster.x, monster.y + wobble * 0.3, half, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#65a30d";
  for (const [dx, dy] of [
    [-half * 0.6, -half * 0.5],
    [half * 0.6, -half * 0.5],
    [0, -half * 0.85],
  ]) {
    ctx.beginPath();
    ctx.moveTo(monster.x + dx, monster.y + dy + wobble * 0.3);
    ctx.lineTo(monster.x + dx - 4, monster.y + dy + 6 + wobble * 0.3);
    ctx.lineTo(monster.x + dx + 4, monster.y + dy + 6 + wobble * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  const isAggro = !!monster.aggroPlayerId;
  const eyeY = monster.y - 2 + wobble * 0.3;
  ctx.fillStyle = isAggro ? "#fecaca" : "#fef9c3";
  ctx.beginPath();
  ctx.arc(monster.x - 5, eyeY, 3.5, 0, Math.PI * 2);
  ctx.arc(monster.x + 5, eyeY, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isAggro ? "#b91c1c" : "#7f1d1d";
  ctx.beginPath();
  ctx.arc(monster.x - 5, eyeY, isAggro ? 2.2 : 1.6, 0, Math.PI * 2);
  ctx.arc(monster.x + 5, eyeY, isAggro ? 2.2 : 1.6, 0, Math.PI * 2);
  ctx.fill();
}

export default function TankCanvas({ state, selfId, send }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  // The previous server snapshot + when the current one arrived — lets the
  // draw loop smoothly slide tanks between the two instead of them sitting
  // still for ~3 rendered frames and then jumping, which is what a server
  // tick rate of 20Hz looks like on a ~60fps screen with no interpolation.
  const prevStateRef = useRef<TankPublicState | null>(null);
  const stateChangedAtRef = useRef(performance.now());
  if (stateRef.current !== state) {
    prevStateRef.current = stateRef.current;
    stateChangedAtRef.current = performance.now();
    stateRef.current = state;
  }

  // Kick every sprite this screen could possibly need off loading the moment
  // the match starts, instead of discovering each one lazily mid-frame (which
  // was making buildMapBackground/etc. redo their full tile scan on every
  // rAF tick until each image happened to finish loading).
  useEffect(() => {
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
    ];
    for (const src of srcs) getSprite(src);
  }, []);

  const explosionsRef = useRef<Explosion[]>([]);
  const marksRef = useRef<SkidMark[]>([]);
  const oilSpillsRef = useRef<OilSpill[]>([]);
  const muzzleFlashesRef = useRef<MuzzleFlash[]>([]);
  const leavesRef = useRef<LeafParticle[]>([]);
  const prevBulletsRef = useRef<Map<string, Bullet>>(new Map());
  const bgCacheRef = useRef<{ mapId: string; canvas: HTMLCanvasElement } | null>(null);

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
      } else {
        explosionsRef.current.push({ id: imp.id, x: imp.x, y: imp.y, start: now, kind: "normal" });
        sawTrap = true;
      }
    }
    if (sawShove) playTankImpact();
    if (sawTrap) playTankExplosion();
    if (sawShield) playShieldBlock();
    if (sawCrate) playTankExplosion();
  }, [state.impacts]);

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
  const prevSelfRef = useRef<{ hp: number; itemCount: number; burning: boolean } | null>(null);
  useEffect(() => {
    const self = state.players.find((p) => p.id === selfId);
    if (!self) return;
    const isBurning = !!self.burningUntil && self.burningUntil > state.serverNow;
    const prev = prevSelfRef.current;
    if (prev) {
      if (self.hp < prev.hp) playTankHit();
      else if (self.hp > prev.hp || self.items.length > prev.itemCount) playTankPickup();
      if (isBurning && !prev.burning) playFireIgnite();
    }
    prevSelfRef.current = { hp: self.hp, itemCount: self.items.length, burning: isBurning };
  }, [state.players, selfId, state.serverNow]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Render at native device resolution so curves (tanks, monsters, bushes)
    // stay smooth instead of the browser nearest-neighbor-upscaling a lower
    // internal resolution — that mismatch was the main source of the
    // "blocky/low-res" look. All drawing below still happens in the same
    // logical VIEWPORT_W x VIEWPORT_H coordinate space thanks to this scale.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = VIEWPORT_W * dpr;
    canvas.height = VIEWPORT_H * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    function draw() {
      if (!ctx) return;
      const s = stateRef.current;
      const prevS = prevStateRef.current;
      const m = getMap(s.mapId);
      const { w: mapW, h: mapH } = mapCanvasSize(m);
      const self = s.players.find((p) => p.id === selfId);
      const isBlinded = !!self && !!self.blindedUntil && self.blindedUntil > s.serverNow;

      // Server ticks at 20Hz but the screen paints at ~60fps — without this,
      // every tank (and the camera that follows the local one) would sit
      // still for ~3 frames and then jump, reading as constant stutter while
      // moving. Slide smoothly from each entity's last known spot toward its
      // current one instead, snapping only on a big jump (e.g. a respawn).
      const tickT = Math.min(1, (performance.now() - stateChangedAtRef.current) / TICK_MS);
      function renderPos(id: string, curX: number, curY: number): { x: number; y: number } {
        const prev = prevS?.players.find((p) => p.id === id);
        if (!prev) return { x: curX, y: curY };
        if (Math.hypot(curX - prev.x, curY - prev.y) > TANK_SIZE * 3) return { x: curX, y: curY };
        return { x: prev.x + (curX - prev.x) * tickT, y: prev.y + (curY - prev.y) * tickT };
      }
      const selfRender = self ? renderPos(self.id, self.x, self.y) : null;

      // Follow-camera: center on the local player, clamped so the viewport
      // never scrolls past the map edge. Everything below is drawn in world
      // coordinates inside this translate — only the visible slice ends up
      // on screen, matching a MOBA-style zoomed-in view.
      const camX = clampCamera(selfRender ? selfRender.x : mapW / 2, VIEWPORT_W, mapW);
      const camY = clampCamera(selfRender ? selfRender.y : mapH / 2, VIEWPORT_H, mapH);
      const offsetX = Math.round(VIEWPORT_W / 2 - camX);
      const offsetY = Math.round(VIEWPORT_H / 2 - camY);
      cameraOffsetRef.current.x = offsetX;
      cameraOffsetRef.current.y = offsetY;

      ctx.clearRect(0, 0, VIEWPORT_W, VIEWPORT_H);
      ctx.save();
      ctx.translate(offsetX, offsetY);

      if (!bgCacheRef.current || bgCacheRef.current.mapId !== s.mapId) {
        const built = buildMapBackground(m);
        if (built) bgCacheRef.current = { mapId: s.mapId, canvas: built };
      }
      if (bgCacheRef.current && bgCacheRef.current.mapId === s.mapId) {
        ctx.drawImage(bgCacheRef.current.canvas, 0, 0);
      } else {
        // Floor sprites still loading — flat fallback so the frame isn't blank.
        ctx.fillStyle = m.terrain === "sand" ? "#dcc794" : "#dde9c9";
        ctx.fillRect(0, 0, mapCanvasSize(m).w, mapCanvasSize(m).h);
      }

      const now = performance.now();

      // Monster nests are marked on the ground regardless of whether the
      // monster is currently alive or mid-respawn — the territory is fixed.
      for (const monster of s.monsters) {
        drawNestPuddle(ctx, monster.nestX, monster.nestY, now);
      }

      for (let row = 0; row < m.layout.length; row++) {
        for (let col = 0; col < m.layout[row].length; col++) {
          const tile = m.layout[row][col];
          if (tile === "H") drawHazardSpikes(ctx, col * TILE_SIZE, row * TILE_SIZE, now);
          else if (tile === "B") drawBush(ctx, col * TILE_SIZE, row * TILE_SIZE, row, col, bushNeighborBias(m, row, col), now, 0.9);
        }
      }

      marksRef.current = marksRef.current.filter((mk) => now - mk.start < MARK_DURATION_MS);
      for (const mk of marksRef.current) {
        drawSkidMark(ctx, mk.x, mk.y, (now - mk.start) / MARK_DURATION_MS);
      }

      oilSpillsRef.current = oilSpillsRef.current.filter((o) => now - o.start < OIL_SPILL_DURATION_MS);
      for (const o of oilSpillsRef.current) {
        drawOilSpill(ctx, o.x, o.y, (now - o.start) / OIL_SPILL_DURATION_MS);
      }

      for (const crate of s.crates) {
        drawCrate(ctx, crate);
      }

      // Traps are only ever drawn for their own owner — everyone else's
      // client received the same data but simply chooses not to render it.
      for (const trap of s.traps) {
        if (trap.ownerId === selfId) drawTrap(ctx, trap.x, trap.y, now);
      }

      for (const pu of s.pickups) {
        if (pu.kind === "health") drawHealthPickup(ctx, pu.x, pu.y);
        else drawItemPickup(ctx, pu.x, pu.y, pu.kind);
      }

      for (const b of s.bullets) {
        if (b.kind === "big") {
          drawBigBullet(ctx, b.x, b.y, b.angle, now);
        } else if (b.kind === "fire") {
          drawFireBullet(ctx, b.x, b.y, b.angle, now);
        } else if (b.kind === "blind") {
          drawBlindBullet(ctx, b.x, b.y, b.angle);
        } else {
          const owner = s.players.find((p) => p.id === b.ownerId);
          drawNormalBullet(ctx, b.x, b.y, b.angle, owner ? skinForColor(owner.color) : "blue");
        }
      }

      for (const monster of s.monsters) {
        if (monster.alive) drawMonster(ctx, monster);
      }

      const visiblePlayers = s.players.filter((p) => p.alive && (p.id === selfId || !self || !isBushHidden(m, p, self)));
      for (const p of visiblePlayers) {
        const isAlly = p.id === selfId || (s.mode === "team" && !!self && p.team === self.team);
        const rp = renderPos(p.id, p.x, p.y);
        drawTank(ctx, rp.x, rp.y, p.color, p.dir, p.name, p.hp, p.id === selfId, isAlly, p.isBoosting, p.shieldHitsLeft, p.aimAngle);
        if (p.burningUntil && p.burningUntil > s.serverNow) drawBurningOverlay(ctx, rp.x, rp.y, now);
      }

      // Whoever's standing in a bush (self included) gets a second, lighter
      // pass of foliage drawn on top afterward — reads as grass partially
      // covering the tank, instead of the bush only ever sitting underneath.
      for (const p of visiblePlayers) {
        const row = Math.floor(p.y / TILE_SIZE);
        const col = Math.floor(p.x / TILE_SIZE);
        if ((m.layout[row]?.[col] ?? "#") !== "B") continue;
        drawBush(ctx, col * TILE_SIZE, row * TILE_SIZE, row, col, bushNeighborBias(m, row, col), now, 0.5);
      }

      explosionsRef.current = explosionsRef.current.filter((ex) => now - ex.start < explosionDurationFor(ex.kind));
      for (const ex of explosionsRef.current) {
        const duration = explosionDurationFor(ex.kind);
        drawExplosion(ctx, ex.x, ex.y, (now - ex.start) / duration, ex.kind);
      }

      leavesRef.current = leavesRef.current.filter((l) => now - l.start < LEAF_PARTICLE_DURATION_MS);
      for (const l of leavesRef.current) {
        drawLeafParticle(ctx, l, (now - l.start) / LEAF_PARTICLE_DURATION_MS);
      }

      muzzleFlashesRef.current = muzzleFlashesRef.current.filter((f) => now - f.start < MUZZLE_FLASH_DURATION_MS);
      for (const f of muzzleFlashesRef.current) {
        drawMuzzleFlash(ctx, f, (now - f.start) / MUZZLE_FLASH_DURATION_MS);
      }

      ctx.restore();

      // Fog of war: purely a local rendering restriction — the browser still
      // has the full state above, it just chooses to paint over most of it.
      // Drawn in screen space (post-restore), so it has to re-derive where
      // the local tank landed on screen after the camera translate above.
      if (isBlinded && self) {
        const screenX = self.x + offsetX;
        const screenY = self.y + offsetY;
        ctx.save();
        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.beginPath();
        ctx.rect(0, 0, VIEWPORT_W, VIEWPORT_H);
        ctx.arc(screenX, screenY, VISION_RADIUS, 0, Math.PI * 2, true);
        ctx.fill("evenodd");
        ctx.restore();
      }

      drawMinimap(minimapRef.current, s, m, selfId, camX, camY);

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [selfId]);

  // Shared with the touch joystick/boost button below — both the keyboard
  // listener and the touch handlers mutate this same object so either input
  // method (or a mix, e.g. keyboard + touch on a hybrid device) works.
  const heldRef = useRef({ up: false, down: false, left: false, right: false, boost: false });
  const lastSentInputRef = useRef("");
  // Desktop-only mouse aim: null means "no mouse aim active, fire along the
  // 4-directional facing instead" (touch devices never set this).
  const aimAngleRef = useRef<number | null>(null);
  // Updated every draw() frame so the mousemove handler (which runs outside
  // the rAF loop) can convert a screen-space mouse position into a world
  // angle without redoing the camera-clamp math itself.
  const cameraOffsetRef = useRef({ x: 0, y: 0 });
  const sendInput = useCallback(() => {
    const held = heldRef.current;
    const angle = aimAngleRef.current;
    const angleBucket = angle === null ? "n" : Math.round(angle * 40);
    const key = `${held.up}${held.down}${held.left}${held.right}${held.boost}:${angleBucket}`;
    if (key === lastSentInputRef.current) return;
    lastSentInputRef.current = key;
    send({ type: "input", ...held, aimAngle: angle ?? undefined });
  }, [send]);

  useEffect(() => {
    const held = heldRef.current;

    function onKeyDown(e: KeyboardEvent) {
      const dir = KEY_MAP[e.key];
      if (dir) {
        if (!held[dir]) {
          held[dir] = true;
          sendInput();
        }
        e.preventDefault();
      } else if (e.key === "Shift") {
        if (!held.boost) {
          held.boost = true;
          sendInput();
        }
      } else if (e.key === " " && !e.repeat) {
        send({ type: "shoot" });
        playTankShoot();
        e.preventDefault();
      } else if (["1", "2", "3"].includes(e.key)) {
        const self = stateRef.current.players.find((p) => p.id === selfId);
        const kind = self?.items[Number(e.key) - 1];
        if (kind) send({ type: "use_item", kind });
        e.preventDefault();
      } else if ((e.key === "r" || e.key === "R") && !e.repeat) {
        const self = stateRef.current.players.find((p) => p.id === selfId);
        if (self && self.ultimateEnergy >= MAX_ULTIMATE_ENERGY) {
          send({ type: "shoot", big: true });
          playTankBigShot();
        }
        e.preventDefault();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      const dir = KEY_MAP[e.key];
      if (dir) {
        held[dir] = false;
        sendInput();
      } else if (e.key === "Shift") {
        held.boost = false;
        sendInput();
      }
    }
    function onBlur() {
      held.up = held.down = held.left = held.right = held.boost = false;
      sendInput();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      send({ type: "input", up: false, down: false, left: false, right: false, boost: false });
    };
  }, [send, selfId, sendInput]);

  // Touch controls: a virtual joystick (resolved to the same 4-directional
  // input the server understands — no diagonal movement in this game) plus
  // hold-to-fire and hold-to-boost buttons. Hidden on pointer:fine devices
  // via the `sm:hidden` classes below; a touch/mouse drag on a hybrid device
  // works too since these use Pointer Events.
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const joyActiveRef = useRef(false);
  const JOY_DEAD_ZONE = 12;

  function angleToDir(dx: number, dy: number): "up" | "down" | "left" | "right" {
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (deg >= -45 && deg < 45) return "right";
    if (deg >= 45 && deg < 135) return "down";
    if (deg >= -135 && deg < -45) return "up";
    return "left";
  }

  function updateJoystick(clientX: number, clientY: number) {
    const base = joyBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const maxDist = rect.width / 2;
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
    const dir = dist < JOY_DEAD_ZONE ? null : angleToDir(dx, dy);
    const held = heldRef.current;
    held.up = dir === "up";
    held.down = dir === "down";
    held.left = dir === "left";
    held.right = dir === "right";
    sendInput();
  }

  function resetJoystick() {
    joyActiveRef.current = false;
    const held = heldRef.current;
    held.up = held.down = held.left = held.right = false;
    if (joyKnobRef.current) joyKnobRef.current.style.transform = "translate(-50%, -50%)";
    sendInput();
  }

  function handleJoyPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    joyActiveRef.current = true;
    updateJoystick(e.clientX, e.clientY);
  }
  function handleJoyPointerMove(e: React.PointerEvent) {
    if (!joyActiveRef.current) return;
    updateJoystick(e.clientX, e.clientY);
  }

  const shootIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  function startShooting() {
    send({ type: "shoot" });
    playTankShoot();
    if (shootIntervalRef.current) return;
    shootIntervalRef.current = setInterval(() => {
      send({ type: "shoot" });
      playTankShoot();
    }, FIRE_COOLDOWN_MS);
  }
  function stopShooting() {
    if (shootIntervalRef.current) {
      clearInterval(shootIntervalRef.current);
      shootIntervalRef.current = null;
    }
  }

  function setBoost(active: boolean) {
    heldRef.current.boost = active;
    sendInput();
  }

  // Desktop mouse-aim: shots fire toward the cursor instead of only the 4
  // movement directions. Converts the mouse's CSS-pixel position into the
  // canvas's logical VIEWPORT coordinate space (which can differ from the
  // canvas's displayed size on a responsive layout), then into a world
  // angle using the local tank's last-known world position.
  function handleAimMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const self = stateRef.current.players.find((p) => p.id === selfId);
    if (!canvas || !self) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const mouseX = ((e.clientX - rect.left) / rect.width) * VIEWPORT_W;
    const mouseY = ((e.clientY - rect.top) / rect.height) * VIEWPORT_H;
    const selfScreenX = self.x + cameraOffsetRef.current.x;
    const selfScreenY = self.y + cameraOffsetRef.current.y;
    aimAngleRef.current = Math.atan2(mouseY - selfScreenY, mouseX - selfScreenX);
    sendInput();
  }
  function handleAimLeave() {
    aimAngleRef.current = null;
    sendInput();
    stopShooting();
  }

  // Left-click to fire, in addition to Space — held down keeps firing at the
  // same cooldown-respecting rate as the touch fire button.
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    startShooting();
  }
  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    stopShooting();
  }

  const self = state.players.find((p) => p.id === selfId);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={VIEWPORT_W}
          height={VIEWPORT_H}
          onMouseMove={handleAimMove}
          onMouseLeave={handleAimLeave}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          className="block w-full touch-none rounded-xl border border-slate-200 bg-white shadow-xl"
          style={{ aspectRatio: `${VIEWPORT_W} / ${VIEWPORT_H}` }}
        />
        <canvas
          ref={minimapRef}
          width={MINIMAP_W}
          height={MINIMAP_H}
          className="absolute left-2 top-2 rounded-md border border-white/50 shadow-lg md:bottom-2 md:left-auto md:right-2 md:top-auto"
        />
        {killFeed.length > 0 && (
          <div className="pointer-events-none absolute right-2 top-2 flex max-w-[70%] flex-col items-end gap-1">
            {killFeed.map((f) => (
              <div key={f.id} className="truncate rounded bg-black/70 px-2 py-1 text-[11px] font-medium text-white shadow">
                {f.text}
              </div>
            ))}
          </div>
        )}

        {/* Touch controls — desktop has keyboard (WASD/arrows, space, Shift),
            so these only render on small/touch-sized viewports. */}
        <div
          ref={joyBaseRef}
          onPointerDown={handleJoyPointerDown}
          onPointerMove={handleJoyPointerMove}
          onPointerUp={resetJoystick}
          onPointerCancel={resetJoystick}
          className="absolute bottom-3 left-3 h-24 w-24 touch-none rounded-full border border-white/40 bg-black/25 md:hidden"
        >
          <div
            ref={joyKnobRef}
            className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow"
          />
        </div>
        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setBoost(true);
          }}
          onPointerUp={() => setBoost(false)}
          onPointerCancel={() => setBoost(false)}
          className="absolute bottom-24 right-3 flex h-14 w-14 touch-none items-center justify-center rounded-full border border-white/40 bg-amber-400/80 text-xl shadow-lg md:hidden"
        >
          ⚡
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            startShooting();
          }}
          onPointerUp={stopShooting}
          onPointerCancel={stopShooting}
          className="absolute bottom-3 right-3 flex h-16 w-16 touch-none items-center justify-center rounded-full border border-white/40 bg-red-500/80 text-xs font-bold text-white shadow-lg md:hidden"
        >
          BẮN
        </button>
      </div>
      {self && (
        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 shadow-xl">
          <span className="shrink-0 text-xs font-medium text-slate-500">⚡ Tăng tốc (Shift)</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-amber-400 transition-[width]"
              style={{ width: `${Math.max(0, Math.min(100, (self.boostEnergy / MAX_BOOST_ENERGY) * 100))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
