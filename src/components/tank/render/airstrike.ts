// Visuals for the carpet-bombing hazard: the ground danger-zone + target
// icon during the warning window, the bomb visibly tumbling down in the
// last stretch before impact, and the bomber plane itself.

import { AIRSTRIKE_WARN_MS, TILE_SIZE } from "@shared/tankTypes";
import { getSprite } from "@/lib/imageCache";
import { drawRotatedSprite, getTintedSprite } from "./sprite-utils";

// The last stretch before impact where the marker gives way to a visibly
// falling bomb instead of just a static blinking icon.
export const BOMB_FALL_MS = 650;
export const FALLING_BOMB_FRAMES = ["/tank/ship/bomb.png", "/tank/ship/bombdub.png", "/tank/ship/bombdup.png"];
export const PLANE_FRAMES = ["/tank/ship/ship_0012.png", "/tank/ship/ship_0013.png", "/tank/ship/ship_0014.png"];

/** Ground danger-zone for an incoming airstrike bomb — visible to everyone
 * (it's an environmental hazard, not a player-set trap). Sized to the real
 * blast `radius` so the warning stays honest as strikes grow later in the
 * match, and blinks faster the closer the strike gets. */
export function drawBombDangerZone(ctx: CanvasRenderingContext2D, x: number, y: number, msUntilStrike: number, radius: number, time: number) {
  const urgency = Math.max(0, Math.min(1, 1 - msUntilStrike / AIRSTRIKE_WARN_MS));
  const blinkPeriod = 260 - urgency * 160;
  const pulse = 0.55 + 0.45 * Math.sin(time / blinkPeriod);

  ctx.save();
  ctx.globalAlpha = 0.18 + 0.16 * pulse;
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Idle countdown icon shown at a target tile until the bomb starts visibly
 * falling (see `drawFallingBomb`). */
export function drawBombTargetIcon(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const pulse = 0.55 + 0.45 * Math.sin(time / 180);
  const tinted = getTintedSprite("/tank/ship/bomb.png", "#dc2626");
  const size = TILE_SIZE * 0.6;
  if (tinted) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * pulse;
    ctx.drawImage(tinted, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    ctx.restore();
  }
}

/** The bomb visibly tumbling down onto its target tile during the final
 * `BOMB_FALL_MS` before it lands — `fallT` runs 0 (just released, small and
 * high) to 1 (impact, full size at ground level). */
export function drawFallingBomb(ctx: CanvasRenderingContext2D, x: number, y: number, fallT: number, time: number) {
  const height = 34 * fallT; // how "high up" it still looks
  const scale = 0.55 + 0.45 * fallT;
  const drawY = y - height;

  ctx.save();
  ctx.globalAlpha = 0.2 + 0.25 * fallT;
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.ellipse(x, y, 7 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const frame = FALLING_BOMB_FRAMES[Math.floor(time / 80) % FALLING_BOMB_FRAMES.length];
  const sprite = getSprite(frame);
  if (sprite) {
    const size = TILE_SIZE * 0.55 * scale;
    const w = size * (sprite.width / sprite.height);
    ctx.drawImage(sprite, Math.round(x - w / 2), Math.round(drawY - size / 2), w, size);
  }
}

/** The bomber itself, flying a straight line across the map. A soft ground
 * shadow sells a bit of altitude over the tanks below. `sizeScale` bulges it
 * up while it's overhead dropping bombs, and shrinks it back down as it
 * recedes into the distance on either side — a small/big/small silhouette
 * instead of a constant-size sprite gliding past. */
export function drawBombPlane(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, time: number, sizeScale: number) {
  const height = 30 * sizeScale;
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 15 * sizeScale, 6 * sizeScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const frame = PLANE_FRAMES[Math.floor(time / 90) % PLANE_FRAMES.length];
  drawRotatedSprite(ctx, frame, x, y, angle, height);
}
