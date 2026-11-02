import { hillHeight } from "@shared/hillTerrain";
import { HILL_JEEP, type HillSnapshot } from "@shared/hillTypes";

import { drawJeepBody, drawJeepWheel } from "./drawJeep";

export interface HillCamera { x: number; y: number; scale: number }
/** Canvas coordinates are CSS pixels; the caller applies capped device scaling. */
export function drawHill(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, state: HillSnapshot, camera: HillCamera, dt: number) {
  const targetScale = Math.min(w / (w < h ? 25 : 39), h / 18) / (1 + Math.min(0.25, state.speed / 90) + (state.grounded ? 0 : 0.08));
  const blend = 1 - Math.exp(-dt * 5);
  camera.x += (state.chassis.x - camera.x) * blend;
  camera.y += (state.chassis.y - camera.y) * blend;
  camera.scale += (targetScale - camera.scale) * blend;
  const s = camera.scale;
  const sx = (x: number) => w * 0.32 + (x - camera.x) * s;
  const sy = (y: number) => h * 0.53 - (y - camera.y) * s;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#79c8e4"); sky.addColorStop(1, "#eaf6ca");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff1ae"; ctx.beginPath(); ctx.arc(w * 0.8, h * 0.2, 35, 0, Math.PI * 2); ctx.fill();
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle = ["#9cc9a0", "#77ad89", "#519574"][layer];
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let px = 0; px <= w + 10; px += 10) {
      const world = px / s + camera.x * (0.12 + layer * 0.12);
      ctx.lineTo(px, h * (0.48 + layer * 0.08) + Math.sin(world / (12 - layer * 2)) * (28 + layer * 6));
    }
    ctx.lineTo(w, h); ctx.fill();
  }
  const from = Math.floor(camera.x - w * 0.32 / s) - 2;
  const to = Math.ceil(camera.x + w * 0.68 / s) + 2;
  ctx.beginPath(); ctx.moveTo(sx(from), h + 10);
  for (let x = from; x <= to; x++) ctx.lineTo(sx(x), sy(hillHeight(seed, x)));
  ctx.lineTo(sx(to), h + 10); ctx.closePath(); ctx.fillStyle = "#9b6d43"; ctx.fill();
  ctx.beginPath();
  for (let x = from; x <= to; x++) { const y = sy(hillHeight(seed, x)); if (x === from) ctx.moveTo(sx(x), y); else ctx.lineTo(sx(x), y); }
  ctx.strokeStyle = "#42743a"; ctx.lineWidth = 7; ctx.lineJoin = "round"; ctx.stroke();
  ctx.strokeStyle = "#94bb52"; ctx.lineWidth = 3; ctx.stroke();
  for (let x = Math.ceil(from / 100) * 100; x <= to; x += 100) {
    if (x < 0) continue;
    const y = sy(hillHeight(seed, x));
    ctx.fillStyle = "#5c4b37"; ctx.fillRect(sx(x) - 2, y - 40, 4, 40);
    ctx.fillStyle = "#fff4cd"; ctx.fillRect(sx(x) - 26, y - 55, 52, 23);
    ctx.fillStyle = "#35583e"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText(`${x} m`, sx(x), y - 39);
  }
  for (const item of state.pickups) {
    const x = sx(item.x), y = sy(item.y);
    if (x < -30 || x > w + 30) continue;
    if (item.kind === "coin") {
      ctx.fillStyle = "#ffd24e"; ctx.strokeStyle = "#b77c24"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, s * 0.22, s * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = "#e45249"; ctx.fillRect(x - 10, y - 12, 20, 25);
      ctx.strokeStyle = "#fff1cf"; ctx.lineWidth = 3; ctx.strokeRect(x - 5, y - 18, 10, 6);
      ctx.fillStyle = "white"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center"; ctx.fillText("+", x, y + 6);
    }
  }
  // Springs follow the wheel bodies, rather than a decorative fixed wheel position.
  const c = state.chassis;
  state.wheels.forEach((wheel, i) => {
    const localX = (i ? 1 : -1) * HILL_JEEP.wheelbase / 2;
    const ax = c.x + Math.cos(c.angle) * localX, ay = c.y + Math.sin(c.angle) * localX;
    ctx.beginPath(); ctx.moveTo(sx(ax), sy(ay)); ctx.lineTo(sx(wheel.x), sy(wheel.y));
    ctx.strokeStyle = "#d3d8ce"; ctx.lineWidth = 5; ctx.stroke();
  });
  ctx.save(); ctx.translate(sx(c.x), sy(c.y)); ctx.rotate(-c.angle); ctx.scale(s, -s);
  drawJeepBody(ctx, state);
  ctx.restore();
  for (const wheel of state.wheels) {
    ctx.save(); ctx.translate(sx(wheel.x), sy(wheel.y)); ctx.rotate(-wheel.angle); ctx.scale(s, -s);
    drawJeepWheel(ctx);
    ctx.restore();
  }
  if (state.overturnRemaining !== null) {
    ctx.strokeStyle = "#e55542"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(sx(c.x), sy(c.y) - 45, 23, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.overturnRemaining / 3); ctx.stroke();
    ctx.fillStyle = "#922e21"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center"; ctx.fillText(String(Math.ceil(state.overturnRemaining)), sx(c.x), sy(c.y) - 38);
  }
}
