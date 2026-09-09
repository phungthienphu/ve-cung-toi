// Short-lived cosmetic effects: explosions (the shared flipbook every impact
// kind plays, including the airstrike's own bomb variant), tire-skid marks,
// oil-spill decals, muzzle flashes, and bush-entry leaf bursts. Each has its
// own tracked-list item type + duration constant, consumed by TankCanvas's
// draw loop via a `useRef<T[]>` per effect kind.

import { TANK_SIZE } from "@shared/tankTypes";
import { getSprite } from "@/lib/imageCache";
import { getTintedSprite } from "./sprite-utils";

export type ExplosionKind = "normal" | "blind" | "shove" | "big" | "shield" | "fire" | "crate" | "bomb" | "ultimate";
const EXPLOSION_DURATION_MS = 380;
export function explosionDurationFor(kind: ExplosionKind): number {
  if (kind === "bomb") return 560;
  if (kind === "big") return 520;
  if (kind === "shield") return 220;
  if (kind === "ultimate") return 450;
  return EXPLOSION_DURATION_MS;
}

// The pack's explosion1..5 are a flipbook (small flash -> big starburst ->
// cooling ring -> dissipating embers), not standalone icons — playing them
// in order over an explosion's lifetime is what makes it read as one blast.
export const EXPLOSION_FRAMES = [
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

// Bomb explosions use their own dedicated 4-frame flipbook (already fully
// colored, no tint needed) instead of the shared Retina one.
export const BOMB_EXPLOSION_FRAMES = ["/ship/tile_0004.png", "/ship/tile_0005.png", "/ship/tile_0006.png", "/ship/tile_0007.png"];

export interface Explosion {
  id: string;
  x: number;
  y: number;
  start: number;
  kind: ExplosionKind;
  radius?: number; // only set for "bomb" — scales the visual to the real blast size
  color?: string; // only set for "ultimate" — matches whichever skin activated it
}

export function drawExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, kind: ExplosionKind, radius?: number, color?: string) {
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
  if (kind === "ultimate") {
    // Two outward-racing rings + a quick flash — a clear "a skill just fired"
    // cue, distinct from a normal explosion, that reads for every player
    // watching (not just whoever pressed the button).
    const tint = color ?? "#22d3ee";
    const alpha = 1 - progress;
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(x, y, (TANK_SIZE / 2) * (1 - progress), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = tint;
    ctx.lineWidth = 2.5;
    for (const ringDelay of [0, 0.18]) {
      const ringProgress = Math.max(0, Math.min(1, progress - ringDelay));
      if (ringProgress <= 0) continue;
      ctx.beginPath();
      ctx.arc(x, y, (TANK_SIZE / 2 + 4) + ringProgress * 26, 0, Math.PI * 2);
      ctx.globalAlpha = alpha * (1 - ringProgress);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  // Bombs get their own dedicated flipbook and scale to the real blast
  // radius so a late-match, bigger-radius strike visibly looks like a
  // bigger explosion.
  const maxSize = kind === "bomb" ? (radius ?? 40) * 2.2 : kind === "big" ? 46 : kind === "shove" ? 30 : 24;
  const size = maxSize * (0.4 + 0.6 * Math.min(1, progress * 1.6));
  const alpha = 1 - progress;
  const frames = kind === "bomb" ? BOMB_EXPLOSION_FRAMES : EXPLOSION_FRAMES;
  const frameIdx = Math.min(frames.length - 1, Math.floor(progress * frames.length));
  const tint = kind === "bomb" ? undefined : EXPLOSION_TINT[kind];
  const sprite = tint ? getTintedSprite(frames[frameIdx], tint) : getSprite(frames[frameIdx]);

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

export const MARK_DURATION_MS = 3200;
export interface SkidMark {
  id: string;
  x: number;
  y: number;
  start: number;
}

/** Faint, slow-fading tire-skid decal left on the ground where a shove landed. */
export function drawSkidMark(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
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

export const OIL_SPILL_DURATION_MS = 6500;
export interface OilSpill {
  id: string;
  x: number;
  y: number;
  start: number;
}

export function drawOilSpill(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
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

export const MUZZLE_FLASH_DURATION_MS = 110;
export interface MuzzleFlash {
  id: string;
  x: number;
  y: number;
  angle: number;
  start: number;
}

export function drawMuzzleFlash(ctx: CanvasRenderingContext2D, flash: MuzzleFlash, progress: number) {
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

export const LEAF_PARTICLE_DURATION_MS = 900;
export interface LeafParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  sprite: string;
  start: number;
}

export function spawnLeafBurst(ref: { current: LeafParticle[] }, x: number, y: number) {
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

export function drawLeafParticle(ctx: CanvasRenderingContext2D, leaf: LeafParticle, progress: number) {
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
