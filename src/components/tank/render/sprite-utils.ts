// Small sprite-drawing primitives shared across every other render/*.ts
// module: tinting white-silhouette icons, rotating a sprite to face a world
// angle, mapping a tank color back to its Kenney skin name, and a
// deterministic per-tile PRNG for stable-but-varied ground texture.

import { TANK_COLORS, TANK_SKINS, type Direction, type TankSkin } from "@shared/tankTypes";
import { getSprite } from "@/lib/imageCache";

/** Deterministic per-tile PRNG — same tile always gets the same "random"
 * texture/foliage layout, so nothing flickers or reshuffles between frames. */
export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DIR_ANGLE: Record<Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

export function skinForColor(color: string): TankSkin {
  const idx = TANK_COLORS.indexOf(color);
  return TANK_SKINS[idx >= 0 ? idx : 0];
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const BULLET_SKIN_MAP: Record<TankSkin, "Blue" | "Dark" | "Green" | "Red" | "Sand"> = {
  blue: "Blue",
  dark: "Dark",
  green: "Green",
  red: "Red",
  sand: "Sand",
  bigRed: "Red",
  darkLarge: "Dark",
  huge: "Dark",
};

const tintedSpriteCache = new Map<string, HTMLCanvasElement>();

/** Tints a white-on-transparent icon a solid color, cached per (src, color)
 * pair. Compositing happens on a small offscreen buffer — doing it directly
 * on the main canvas would tint whatever's already drawn underneath too. */
export function getTintedSprite(src: string, color: string): HTMLCanvasElement | null {
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

/** Draws `src` centered at (x, y), rotated to face `angle` — the sprite's own
 * art points "up" by default, matching the tank body/turret convention.
 * Returns false (drawing nothing) if the sprite hasn't loaded yet. */
export function drawRotatedSprite(ctx: CanvasRenderingContext2D, src: string, x: number, y: number, angle: number, height: number): boolean {
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
