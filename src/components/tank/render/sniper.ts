// Dark's ultimate: a telegraphed scope line from the tank to wherever it's
// currently aiming, visible to every player (not just Dark) while charging —
// the whole point is to give opponents a fair chance to see it coming and
// dodge before the shot actually releases.

import { SNIPER_SCOPE_RANGE, getMap } from "@shared/tankTypes";
import { tileCharAt } from "./map-background";

const RAY_STEP = 8;

/** Marches along `angle` from (x, y) until it hits a wall or runs out of
 * range, returning where the scope line should end. Purely a rendering
 * concern — the real bullet does its own collision once actually fired.
 *
 * `maxDist` defaults to the full SNIPER_SCOPE_RANGE (used for every other
 * player's scope, since only their aim *angle* is known over the network,
 * never how far their cursor actually is). The local player's own line
 * should instead pass the real cursor distance so the reticle sits under
 * the mouse instead of always stretching out to the wall/max range. */
export function computeScopeEndpoint(
  m: ReturnType<typeof getMap>,
  x: number,
  y: number,
  angle: number,
  maxDist: number = SNIPER_SCOPE_RANGE
): { x: number; y: number } {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let px = x;
  let py = y;
  const cappedMax = Math.min(maxDist, SNIPER_SCOPE_RANGE);
  for (let dist = 0; dist < cappedMax; dist += RAY_STEP) {
    const nx = x + dx * dist;
    const ny = y + dy * dist;
    if (tileCharAt(m, nx, ny) === "#") break;
    px = nx;
    py = ny;
  }
  return { x: px, y: py };
}

/** The line itself plus a small reticle at its tip — a fast pulse so it
 * reads as "actively charging" rather than a static decal. */
export function drawScopeLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, time: number) {
  const pulse = 0.6 + 0.4 * Math.sin(time / 90);

  ctx.save();
  ctx.strokeStyle = `rgba(248,113,113,${0.55 * pulse})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = `rgba(248,113,113,${0.85})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x2, y2, 7 * (0.85 + 0.15 * pulse), 0, Math.PI * 2);
  ctx.moveTo(x2 - 10, y2);
  ctx.lineTo(x2 - 4, y2);
  ctx.moveTo(x2 + 4, y2);
  ctx.lineTo(x2 + 10, y2);
  ctx.moveTo(x2, y2 - 10);
  ctx.lineTo(x2, y2 - 4);
  ctx.moveTo(x2, y2 + 4);
  ctx.lineTo(x2, y2 + 10);
  ctx.stroke();
  ctx.restore();
}
