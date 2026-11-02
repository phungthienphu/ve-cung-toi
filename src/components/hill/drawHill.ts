import { hillHeight } from "@shared/hillTerrain";
import { HILL_VEHICLES, HILL_MAPS, type HillSnapshot, type HillFlag } from "@shared/hillTypes";

import { drawJeepWheel } from "./drawJeep";

import { drawVehicle } from "./drawVehicle";

export interface HillCamera { x: number; y: number; scale: number }
/** Canvas coordinates are CSS pixels; the caller applies capped device scaling. */
export function drawHill(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, state: HillSnapshot, camera: HillCamera, dt: number, flags: HillFlag[] = []) {
  const map = HILL_MAPS[state.map], car = HILL_VEHICLES[state.vehicle];
  const targetScale = Math.min(w / (w < h ? 25 : 39), h / 18) / (1 + Math.min(0.25, state.speed / 90) + (state.grounded ? 0 : 0.08));
  const blend = 1 - Math.exp(-dt * 5);
  camera.x += (state.chassis.x - camera.x) * blend;
  camera.y += (state.chassis.y - camera.y) * blend;
  camera.scale += (targetScale - camera.scale) * blend;
  const s = camera.scale;
  const sx = (x: number) => w * 0.32 + (x - camera.x) * s;
  const sy = (y: number) => h * 0.53 - (y - camera.y) * s;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, map.sky[0]); sky.addColorStop(1, map.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff1ae"; ctx.beginPath(); ctx.arc(w * 0.8, h * 0.2, 35, 0, Math.PI * 2); ctx.fill();
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle = map.hills[layer];
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
  for (let x = from; x <= to; x++) ctx.lineTo(sx(x), sy(hillHeight(seed, x, state.map)));
  ctx.lineTo(sx(to), h + 10); ctx.closePath(); ctx.fillStyle = map.ground; ctx.fill();
  ctx.beginPath();
  for (let x = from; x <= to; x++) { const y = sy(hillHeight(seed, x, state.map)); if (x === from) ctx.moveTo(sx(x), y); else ctx.lineTo(sx(x), y); }
  ctx.strokeStyle = "#42743a"; ctx.lineWidth = 7; ctx.lineJoin = "round"; ctx.stroke();
  ctx.strokeStyle = map.edge; ctx.lineWidth = 3; ctx.stroke();
  for (let x = Math.ceil(from / 100) * 100; x <= to; x += 100) {
    if (x < 0) continue;
    const y = sy(hillHeight(seed, x, state.map));
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
    } else if (item.kind === "energy") {
      ctx.fillStyle = "#32d7ee"; ctx.strokeStyle = "#125975"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "white"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center"; ctx.fillText("ϟ", x, y + 6);
    } else {
      ctx.fillStyle = "#e45249"; ctx.fillRect(x - 10, y - 12, 20, 25);
      ctx.strokeStyle = "#fff1cf"; ctx.lineWidth = 3; ctx.strokeRect(x - 5, y - 18, 10, 6);
      ctx.fillStyle = "white"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center"; ctx.fillText("+", x, y + 6);
    }
  }
  for (const flag of flags) {
    const x = sx(flag.distance + 5), y = sy(hillHeight(seed, flag.distance + 5, state.map));
    if (x < -120 || x > w + 120) continue;
    ctx.strokeStyle = "#f5f0d6"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 80); ctx.stroke();
    ctx.fillStyle = flag.kind === "personal" ? "#ed6556" : flag.kind === "leader" ? "#ffc947" : "#63c9e7";
    ctx.beginPath(); ctx.moveTo(x, y - 80); ctx.lineTo(x + 35, y - 69); ctx.lineTo(x, y - 57); ctx.fill();
    ctx.fillStyle = "#203e49"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`${flag.name.slice(0, 24)} · ${flag.distance}m`, x, y - 90);
  }
  if (state.dashCooldown > 1.7) {
    ctx.strokeStyle = "#fff3b0"; ctx.lineWidth = 3; ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const x = sx(state.chassis.x - car.halfWidth - 0.5), y = sy(state.chassis.y + 0.3 - i * 0.35);
      ctx.beginPath(); ctx.moveTo(x - (1.7 - i * 0.3) * s, y); ctx.lineTo(x, y); ctx.stroke();
    }
  }
  // Springs follow the wheel bodies, rather than a decorative fixed wheel position.
  const c = state.chassis;
  state.wheels.forEach((wheel, i) => {
    const localX = (i ? 1 : -1) * car.wheelbase / 2;
    const ax = c.x + Math.cos(c.angle) * localX, ay = c.y + Math.sin(c.angle) * localX;
    ctx.beginPath(); ctx.moveTo(sx(ax), sy(ay)); ctx.lineTo(sx(wheel.x), sy(wheel.y));
    ctx.strokeStyle = "#d3d8ce"; ctx.lineWidth = 5; ctx.stroke();
  });
  ctx.save(); ctx.translate(sx(c.x), sy(c.y)); ctx.rotate(-c.angle); ctx.scale(s, -s);
  drawVehicle(ctx, state);
  ctx.restore();
  for (const wheel of state.wheels) {
    ctx.save(); ctx.translate(sx(wheel.x), sy(wheel.y)); ctx.rotate(-wheel.angle); ctx.scale(s, -s);
    drawJeepWheel(ctx, car.wheelRadius);
    ctx.restore();
  }
  if (state.overturnRemaining !== null) {
    ctx.strokeStyle = "#e55542"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(sx(c.x), sy(c.y) - 45, 23, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.overturnRemaining / 3); ctx.stroke();
    ctx.fillStyle = "#922e21"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center"; ctx.fillText(String(Math.ceil(state.overturnRemaining)), sx(c.x), sy(c.y) - 38);
  }
}
