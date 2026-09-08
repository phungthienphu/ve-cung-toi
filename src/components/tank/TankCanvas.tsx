"use client";

import { useEffect, useRef, useState } from "react";
import {
  BUSH_REVEAL_RADIUS,
  MAX_BOOST_ENERGY,
  MAX_HP,
  MAX_ULTIMATE_ENERGY,
  MONSTER_HP,
  MONSTER_SIZE,
  NEST_PUDDLE_RADIUS,
  PICKUP_SIZE,
  TANK_SIZE,
  TILE_SIZE,
  TRAP_SIZE,
  VIEWPORT_H,
  VIEWPORT_W,
  VISION_RADIUS,
  getMap,
  mapCanvasSize,
  type Bullet,
  type Monster,
  type TankClientMessage,
  type TankPlayer,
  type TankPublicState,
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

type ExplosionKind = "normal" | "blind" | "shove" | "big" | "shield" | "fire";
const EXPLOSION_DURATION_MS = 320;
function explosionDurationFor(kind: ExplosionKind): number {
  if (kind === "big") return 480;
  if (kind === "shield") return 220;
  return EXPLOSION_DURATION_MS;
}
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
 * once per map (cached by mapId) — smooth gradients + speckle texture + soft
 * ambient occlusion where floor meets wall, no per-tile grid lines. Bushes
 * and hazard glow are animated, so those are drawn live every frame instead.
 */
function buildMapBackground(m: ReturnType<typeof getMap>): HTMLCanvasElement {
  const { w, h } = mapCanvasSize(m);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, "#e8d9ae");
  base.addColorStop(1, "#dcc794");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  for (let row = 0; row < m.layout.length; row++) {
    for (let col = 0; col < m.layout[row].length; col++) {
      const tile = m.layout[row][col];
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      const rng = mulberry32(row * 7919 + col * 104729);

      if (tile === "#") {
        const grad = ctx.createLinearGradient(x, y, x, y + TILE_SIZE);
        grad.addColorStop(0, "#8a7355");
        grad.addColorStop(1, "#5c4a34");
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        // Sandbag-style seam lines for a bit of "obstacle", not "brick grid".
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 3, y + TILE_SIZE * 0.38);
        ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE * 0.34);
        ctx.moveTo(x + 3, y + TILE_SIZE * 0.7);
        ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE * 0.74);
        ctx.stroke();
        if (!isWallTile(m, row - 1, col)) {
          ctx.fillStyle = "rgba(255,255,255,0.14)";
          ctx.fillRect(x, y, TILE_SIZE, 3);
        }
        if (!isWallTile(m, row, col - 1)) {
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(x, y, 3, TILE_SIZE);
        }
        if (!isWallTile(m, row + 1, col)) {
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
        }
        if (!isWallTile(m, row, col + 1)) {
          ctx.fillStyle = "rgba(0,0,0,0.2)";
          ctx.fillRect(x + TILE_SIZE - 3, y, 3, TILE_SIZE);
        }
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = "rgba(0,0,0,0.12)";
          ctx.beginPath();
          ctx.arc(x + rng() * TILE_SIZE, y + rng() * TILE_SIZE, 1.4 + rng(), 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }

      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = rng() > 0.5 ? "rgba(154,120,66,0.3)" : "rgba(237,222,178,0.4)";
        ctx.beginPath();
        ctx.arc(x + rng() * TILE_SIZE, y + rng() * TILE_SIZE, 1 + rng() * 1.6, 0, Math.PI * 2);
        ctx.fill();
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
    }
  }
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
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);

  for (let row = 0; row < m.layout.length; row++) {
    for (let col = 0; col < m.layout[row].length; col++) {
      const tile = m.layout[row][col];
      if (tile === "#") ctx.fillStyle = "#475569";
      else if (tile === "H") ctx.fillStyle = "#dc2626";
      else if (tile === "B") ctx.fillStyle = "#166534";
      else continue;
      ctx.fillRect(col * TILE_SIZE * scaleX, row * TILE_SIZE * scaleY, TILE_SIZE * scaleX + 0.5, TILE_SIZE * scaleY + 0.5);
    }
  }

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect((camX - VIEWPORT_W / 2) * scaleX, (camY - VIEWPORT_H / 2) * scaleY, VIEWPORT_W * scaleX, VIEWPORT_H * scaleY);

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

function drawHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number) {
  const width = TANK_SIZE + 6;
  const height = 4;
  const barY = y - TANK_SIZE / 2 - 14;
  const pct = Math.max(0, Math.min(1, hp / MAX_HP));
  const left = Math.round(x - width / 2);

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(left, barY, width, height);

  ctx.fillStyle = pct > 0.5 ? "#22c55e" : pct > 0.25 ? "#f59e0b" : "#ef4444";
  ctx.fillRect(left, barY, Math.round(width * pct), height);

  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(left + 0.5, barY + 0.5, width - 1, height - 1);
}

function drawTank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  dir: string,
  name: string,
  hp: number,
  isSelf: boolean,
  isBoosting: boolean,
  shieldHitsLeft: number
) {
  const half = TANK_SIZE / 2;
  drawHealthBar(ctx, x, y, hp);

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
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.strokeRect(Math.round(x - half) - 2, Math.round(y - half) - 2, TANK_SIZE + 4, TANK_SIZE + 4);
  }

  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - half), Math.round(y - half), TANK_SIZE, TANK_SIZE);

  if (isSelf) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(x - half) + 1, Math.round(y - half) + 1, TANK_SIZE - 2, TANK_SIZE - 2);
  }

  const turretSize = 8;
  const offset = half - 2;
  let tx = x;
  let ty = y;
  if (dir === "up") ty -= offset;
  else if (dir === "down") ty += offset;
  else if (dir === "left") tx -= offset;
  else tx += offset;
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(Math.round(tx - turretSize / 2), Math.round(ty - turretSize / 2), turretSize, turretSize);

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

function drawTrap(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const half = TRAP_SIZE / 2;
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 2]);
  ctx.strokeRect(Math.round(x - half), Math.round(y - half), TRAP_SIZE, TRAP_SIZE);
  ctx.setLineDash([]);
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

/** Flame projectile fired while a fire item's charges are active. */
function drawFireBullet(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const flicker = 0.75 + 0.25 * Math.sin(time / 40);
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 8);
  glow.addColorStop(0, `rgba(254,240,138,${0.9 * flicker})`);
  glow.addColorStop(0.6, `rgba(251,146,60,${0.6 * flicker})`);
  glow.addColorStop(1, "rgba(251,146,60,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ea580c";
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

function drawBigBullet(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const flicker = 0.75 + 0.25 * Math.sin(time / 45);
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 11);
  glow.addColorStop(0, `rgba(254,215,170,${0.9 * flicker})`);
  glow.addColorStop(0.5, `rgba(239,68,68,${0.55 * flicker})`);
  glow.addColorStop(1, "rgba(239,68,68,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fed7aa";
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b91c1c";
  ctx.beginPath();
  ctx.arc(x, y, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  const maxRadius = kind === "big" ? 34 : kind === "shove" ? 22 : 18;
  const radius = maxRadius * progress;
  const alpha = 1 - progress;
  const colors =
    kind === "blind"
      ? ["168,85,247", "216,180,254"]
      : kind === "shove"
        ? ["250,204,21", "255,247,204"]
        : kind === "big"
          ? ["239,68,68", "255,214,153"]
          : ["251,146,60", "254,240,138"];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = `rgb(${colors[0]})`;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgb(${colors[1]})`;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
  ctx.fill();
  if (kind === "shove" || kind === "big") {
    // A few radiating spark lines on top of the burst — sells the "clang"
    // (or, for a big shot, a proper shockwave burst).
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = kind === "big" ? 3 : 2;
    const rayCount = kind === "big" ? 10 : 6;
    for (let i = 0; i < rayCount; i++) {
      const ang = (i / rayCount) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * radius * 1.3, y + Math.sin(ang) * radius * 1.3);
      ctx.stroke();
    }
  }
  if (kind === "big") {
    // Expanding shockwave ring for extra "oomph".
    ctx.strokeStyle = `rgba(254,240,138,${alpha * 0.8})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
    ctx.stroke();
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

/**
 * Organic, animated bush clump. Deterministically seeded per tile (row/col)
 * so the shape stays stable frame to frame — only the `time`-driven sway
 * moves. `bias` pulls the clump toward any adjacent wall so bushes read as
 * growing out of the terrain instead of floating alone mid-tile. `opacity`
 * lets the same drawing be reused as a lighter "foliage in front" overlay
 * for whichever tank is currently standing in this tile.
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
  ctx.save();
  ctx.globalAlpha = opacity;

  for (let i = 0; i < 7; i++) {
    let px = rng() * TILE_SIZE;
    let py = rng() * TILE_SIZE;
    if (bias.top) py *= 0.55;
    if (bias.bottom) py = TILE_SIZE - (TILE_SIZE - py) * 0.55;
    if (bias.left) px *= 0.55;
    if (bias.right) px = TILE_SIZE - (TILE_SIZE - px) * 0.55;
    const sway = Math.sin(time / 480 + row * 2.1 + col * 1.7 + i) * 2;
    const r = 4.5 + rng() * 3.5;
    ctx.fillStyle = i % 2 === 0 ? "#15803d" : "#166534";
    ctx.beginPath();
    ctx.ellipse(tileX + px + sway, tileY + py, r, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "#4ade80";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const bx = rng() * TILE_SIZE;
    const by = rng() * TILE_SIZE;
    const sway = Math.sin(time / 380 + row * 3 + col * 1.3 + i * 2) * 3.5;
    ctx.beginPath();
    ctx.moveTo(tileX + bx, tileY + by + 5);
    ctx.quadraticCurveTo(tileX + bx + sway, tileY + by - 4, tileX + bx + sway * 1.6, tileY + by - 10);
    ctx.stroke();
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
  stateRef.current = state;

  const explosionsRef = useRef<Explosion[]>([]);
  const marksRef = useRef<SkidMark[]>([]);
  const prevBulletsRef = useRef<Map<string, Bullet>>(new Map());
  const bgCacheRef = useRef<{ mapId: string; canvas: HTMLCanvasElement } | null>(null);

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
    for (const imp of state.impacts) {
      if (imp.kind === "shove") {
        explosionsRef.current.push({ id: imp.id, x: imp.x, y: imp.y, start: now, kind: "shove" });
        marksRef.current.push({ id: imp.id, x: imp.x, y: imp.y, start: now });
        sawShove = true;
      } else if (imp.kind === "shield") {
        explosionsRef.current.push({ id: imp.id, x: imp.x, y: imp.y, start: now, kind: "shield" });
        sawShield = true;
      } else {
        explosionsRef.current.push({ id: imp.id, x: imp.x, y: imp.y, start: now, kind: "normal" });
        sawTrap = true;
      }
    }
    if (sawShove) playTankImpact();
    if (sawTrap) playTankExplosion();
    if (sawShield) playShieldBlock();
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
      const m = getMap(s.mapId);
      const { w: mapW, h: mapH } = mapCanvasSize(m);
      const self = s.players.find((p) => p.id === selfId);
      const isBlinded = !!self && !!self.blindedUntil && self.blindedUntil > s.serverNow;

      // Follow-camera: center on the local player, clamped so the viewport
      // never scrolls past the map edge. Everything below is drawn in world
      // coordinates inside this translate — only the visible slice ends up
      // on screen, matching a MOBA-style zoomed-in view.
      const camX = clampCamera(self ? self.x : mapW / 2, VIEWPORT_W, mapW);
      const camY = clampCamera(self ? self.y : mapH / 2, VIEWPORT_H, mapH);
      const offsetX = Math.round(VIEWPORT_W / 2 - camX);
      const offsetY = Math.round(VIEWPORT_H / 2 - camY);

      ctx.clearRect(0, 0, VIEWPORT_W, VIEWPORT_H);
      ctx.save();
      ctx.translate(offsetX, offsetY);

      if (!bgCacheRef.current || bgCacheRef.current.mapId !== s.mapId) {
        bgCacheRef.current = { mapId: s.mapId, canvas: buildMapBackground(m) };
      }
      ctx.drawImage(bgCacheRef.current.canvas, 0, 0);

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

      // Traps are only ever drawn for their own owner — everyone else's
      // client received the same data but simply chooses not to render it.
      for (const trap of s.traps) {
        if (trap.ownerId === selfId) drawTrap(ctx, trap.x, trap.y);
      }

      for (const pu of s.pickups) {
        if (pu.kind === "health") drawHealthPickup(ctx, pu.x, pu.y);
        else drawItemPickup(ctx, pu.x, pu.y, pu.kind);
      }

      for (const b of s.bullets) {
        if (b.kind === "big") {
          drawBigBullet(ctx, b.x, b.y, now);
        } else if (b.kind === "fire") {
          drawFireBullet(ctx, b.x, b.y, now);
        } else {
          ctx.fillStyle = b.kind === "blind" ? "#a855f7" : "#facc15";
          ctx.fillRect(Math.round(b.x - 3), Math.round(b.y - 3), 6, 6);
        }
      }

      for (const monster of s.monsters) {
        if (monster.alive) drawMonster(ctx, monster);
      }

      const visiblePlayers = s.players.filter((p) => p.alive && (p.id === selfId || !self || !isBushHidden(m, p, self)));
      for (const p of visiblePlayers) {
        drawTank(ctx, p.x, p.y, p.color, p.dir, p.name, p.hp, p.id === selfId, p.isBoosting, p.shieldHitsLeft);
        if (p.burningUntil && p.burningUntil > s.serverNow) drawBurningOverlay(ctx, p.x, p.y, now);
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

  useEffect(() => {
    const held = { up: false, down: false, left: false, right: false, boost: false };
    let lastSent = "";

    function sendInput() {
      const key = `${held.up}${held.down}${held.left}${held.right}${held.boost}`;
      if (key === lastSent) return;
      lastSent = key;
      send({ type: "input", ...held });
    }

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
  }, [send, selfId]);

  const self = state.players.find((p) => p.id === selfId);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={VIEWPORT_W}
          height={VIEWPORT_H}
          className="block w-full touch-none rounded-xl border border-slate-200 bg-white shadow-xl"
          style={{ aspectRatio: `${VIEWPORT_W} / ${VIEWPORT_H}` }}
        />
        <canvas
          ref={minimapRef}
          width={MINIMAP_W}
          height={MINIMAP_H}
          className="absolute bottom-2 right-2 rounded-md border border-white/50 shadow-lg"
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
