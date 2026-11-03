import { hillHeight, hillSkyRoads, hillWater } from "@shared/hillTerrain";
import { HILL_JEEP, HILL_VEHICLES, HILL_MAPS, type HillMapId, type HillSnapshot, type HillFlag } from "@shared/hillTypes";


import { drawSkyRoad } from "./drawSkyRoad";
import { drawVehicle, drawWheel } from "./drawVehicle";

/** `fx`/`fy`: where on screen the car sits (fractions), eased like the rest. */
export interface HillCamera { x: number; y: number; scale: number; fx?: number; fy?: number }
/**
 * Framing extras. zoom/focus: a close-up for menus (zoom on top of the usual
 * framing, where to put the car). start/finish: world x of the start and
 * finish gates, drawn behind the cars.
 */
export interface HillView { zoom?: number; focusX?: number; focusY?: number; start?: number; finish?: number }
/** World metres → canvas pixels for the camera as drawHill last framed it. */
export function hillProject(camera: HillCamera, w: number, h: number) {
  const s = camera.scale, fx = camera.fx ?? 0.32, fy = camera.fy ?? 0.53;
  return { s, sx: (x: number) => w * fx + (x - camera.x) * s, sy: (y: number) => h * fy - (y - camera.y) * s };
}

/** Canvas coordinates are CSS pixels; the caller applies capped device scaling. */
export function drawHill(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, state: HillSnapshot, camera: HillCamera, dt: number, flags: HillFlag[] = [], carAlpha = 1, squash = 1, view: HillView = {}) {
  const map = HILL_MAPS[state.map], car = HILL_VEHICLES[state.vehicle];
  const targetScale = (Math.min(w / (w < h ? 25 : 39), h / 18) / (1 + Math.min(0.25, state.speed / 90) + (state.grounded ? 0 : 0.08))) * (view.zoom ?? 1);
  const blend = 1 - Math.exp(-dt * 5);
  camera.x += (state.chassis.x - camera.x) * blend;
  camera.y += (state.chassis.y - camera.y) * blend;
  camera.scale += (targetScale - camera.scale) * blend;
  camera.fx = (camera.fx ?? 0.32) + ((view.focusX ?? 0.32) - (camera.fx ?? 0.32)) * blend;
  camera.fy = (camera.fy ?? 0.53) + ((view.focusY ?? 0.53) - (camera.fy ?? 0.53)) * blend;
  const fx = camera.fx;
  const { s, sx, sy } = hillProject(camera, w, h);
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
  const from = Math.floor(camera.x - w * fx / s) - 2;
  const to = Math.ceil(camera.x + w * (1 - fx) / s) + 2;
  ctx.beginPath(); ctx.moveTo(sx(from), h + 10);
  for (let x = from; x <= to; x++) ctx.lineTo(sx(x), sy(hillHeight(seed, x, state.map)));
  ctx.lineTo(sx(to), h + 10); ctx.closePath(); ctx.fillStyle = map.ground; ctx.fill();
  ctx.beginPath();
  for (let x = from; x <= to; x++) { const y = sy(hillHeight(seed, x, state.map)); if (x === from) ctx.moveTo(sx(x), y); else ctx.lineTo(sx(x), y); }
  ctx.strokeStyle = "#42743a"; ctx.lineWidth = 7; ctx.lineJoin = "round"; ctx.stroke();
  ctx.strokeStyle = map.edge; ctx.lineWidth = 3; ctx.stroke();
  drawWater(ctx, sx, sy, s, seed, state.map, from, to);
  for (const road of hillSkyRoads(seed, from, to, state.map)) drawSkyRoad(ctx, sx, sy, s, state.map, road);
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
  if (view.start !== undefined) drawGate(ctx, sx, sy, s, seed, state.map, view.start, false);
  if (view.finish !== undefined) drawGate(ctx, sx, sy, s, seed, state.map, view.finish, true);
  if (state.dashCooldown > 1.7) {
    // Speed lines trail behind the car along its body, like the dash itself.
    ctx.strokeStyle = "#fff3b0"; ctx.lineWidth = 3; ctx.lineCap = "round";
    const cos = Math.cos(state.chassis.angle), sin = Math.sin(state.chassis.angle);
    const at = (ax: number, ay: number) => [sx(state.chassis.x + ax * cos - ay * sin), sy(state.chassis.y + ax * sin + ay * cos)] as const;
    for (let i = 0; i < 3; i++) {
      const y = 0.3 - i * 0.35, from = at(-car.halfWidth - 0.5 - (1.7 - i * 0.3), y), to = at(-car.halfWidth - 0.5, y);
      ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(to[0], to[1]); ctx.stroke();
    }
  }
  ctx.save(); ctx.globalAlpha = carAlpha;
  // Springs follow the wheel bodies, rather than a decorative fixed wheel position.
  const c = state.chassis;
  state.wheels.forEach((wheel, i) => {
    const localX = (i ? 1 : -1) * car.wheelbase / 2;
    const ax = c.x + Math.cos(c.angle) * localX, ay = c.y + Math.sin(c.angle) * localX;
    ctx.beginPath(); ctx.moveTo(sx(ax), sy(ay)); ctx.lineTo(sx(wheel.x), sy(wheel.y));
    ctx.strokeStyle = "#d3d8ce"; ctx.lineWidth = 5; ctx.stroke();
  });
  ctx.save(); ctx.translate(sx(c.x), sy(c.y)); ctx.rotate(-c.angle); ctx.scale(s, -s * squash);
  drawVehicle(ctx, state);
  ctx.restore();
  for (const wheel of state.wheels) {
    ctx.save(); ctx.translate(sx(wheel.x), sy(wheel.y)); ctx.rotate(-wheel.angle); ctx.scale(s, -s);
    drawWheel(ctx, state.vehicle);
    ctx.restore();
  }
  ctx.restore();
  if (state.overturnRemaining !== null) {
    ctx.strokeStyle = "#e55542"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(sx(c.x), sy(c.y) - 45, 23, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.overturnRemaining / HILL_JEEP.overturnSeconds); ctx.stroke();
    ctx.fillStyle = "#922e21"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center"; ctx.fillText(String(Math.ceil(state.overturnRemaining)), sx(c.x), sy(c.y) - 38);
  }
}

/** A gantry over the road facing the camera, with a chequered stripe painted across the track. */
function drawGate(ctx: CanvasRenderingContext2D, sx: (x: number) => number, sy: (y: number) => number, s: number, seed: number, map: HillMapId, x: number, finish: boolean) {
  const ground = (at: number) => hillHeight(seed, at, map);
  if (sx(x + 3) < -20 || sx(x - 3) > ctx.canvas.width + 20) return;
  const cell = 0.4;
  for (let i = 0; i < 3; i++) {
    for (let row = 0; row < 2; row++) {
      const a = x - 0.6 + i * cell, b = a + cell;
      ctx.beginPath();
      ctx.moveTo(sx(a), sy(ground(a) - row * cell));
      ctx.lineTo(sx(b), sy(ground(b) - row * cell));
      ctx.lineTo(sx(b), sy(ground(b) - (row + 1) * cell));
      ctx.lineTo(sx(a), sy(ground(a) - (row + 1) * cell));
      ctx.closePath();
      ctx.fillStyle = (i + row) % 2 ? "#f7f3e8" : "#1d2326";
      ctx.fill();
    }
  }
  const left = x - 2.4, right = x + 2.4;
  const top = Math.max(ground(left), ground(right)) + 5.4;
  ctx.lineCap = "round";
  for (const post of [left, right]) {
    ctx.strokeStyle = "#1d2b2f"; ctx.lineWidth = Math.max(5, 0.24 * s);
    ctx.beginPath(); ctx.moveTo(sx(post), sy(ground(post))); ctx.lineTo(sx(post), sy(top)); ctx.stroke();
    ctx.strokeStyle = finish ? "#f2efe6" : "#e8f6e3"; ctx.lineWidth = Math.max(3, 0.15 * s);
    ctx.beginPath(); ctx.moveTo(sx(post), sy(ground(post))); ctx.lineTo(sx(post), sy(top)); ctx.stroke();
  }
  const bx = sx(left - 0.3), by = sy(top + 0.2), bw = (right - left + 0.6) * s, bh = 1.5 * s;
  ctx.fillStyle = finish ? "#1d2326" : "#2e9d57";
  ctx.strokeStyle = "#1d2b2f"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 0.2 * s); ctx.fill(); ctx.stroke();
  if (finish) {
    const square = bh / 5, count = Math.floor(bw / square);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = i % 2 ? "#f7f3e8" : "#1d2326";
      ctx.fillRect(bx + i * square, by, square, square);
      ctx.fillStyle = i % 2 ? "#1d2326" : "#f7f3e8";
      ctx.fillRect(bx + i * square, by + bh - square, square, square);
    }
  }
  ctx.font = `900 ${Math.max(11, 0.62 * s)}px sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 4; ctx.strokeStyle = "#1d2b2f";
  const label = finish ? "🏁 ĐÍCH" : "XUẤT PHÁT";
  ctx.strokeText(label, bx + bw / 2, by + bh / 2);
  ctx.fillStyle = finish ? "#ffd166" : "#ffffff";
  ctx.fillText(label, bx + bw / 2, by + bh / 2);
  ctx.textBaseline = "alphabetic";
}

const WATER: Partial<Record<HillMapId, { deep: string; shallow: string; foam: string }>> = {
  tea: { deep: "rgba(38, 112, 170, 0.85)", shallow: "rgba(92, 170, 214, 0.75)", foam: "#d8f1ff" },
  sand: { deep: "rgba(20, 128, 150, 0.85)", shallow: "rgba(72, 196, 200, 0.75)", foam: "#e6fffb" },
  mountain: { deep: "rgba(32, 84, 110, 0.88)", shallow: "rgba(78, 136, 160, 0.78)", foam: "#d2e6ee" },
};

/** Ravine pools: a sheet of water down to the ground, with a gently moving surface. */
function drawWater(ctx: CanvasRenderingContext2D, sx: (x: number) => number, sy: (y: number) => number, s: number, seed: number, map: HillMapId, from: number, to: number) {
  const look = WATER[map];
  if (!look) return;
  const time = Date.now() / 1000;
  for (let section = Math.max(1, Math.floor((from - 40) / 72) - 1); section <= Math.floor((to - 40) / 72); section++) {
    const water = hillWater(seed, section, map);
    if (!water) continue;
    // Where the ground is under the surface: that stretch holds water.
    const xs: number[] = [];
    for (let x = water.from; x <= water.to; x += 0.5) if (hillHeight(seed, x, map) < water.level) xs.push(x);
    if (xs.length < 2) continue;
    const left = xs[0], right = xs[xs.length - 1];
    const gradient = ctx.createLinearGradient(0, sy(water.level), 0, sy(water.level - 3));
    gradient.addColorStop(0, look.shallow);
    gradient.addColorStop(1, look.deep);
    ctx.beginPath();
    ctx.moveTo(sx(left), sy(water.level));
    for (let x = left; x <= right; x += 0.5) ctx.lineTo(sx(x), sy(water.level + Math.sin(x * 1.3 + time * 2.4) * 0.05));
    for (let x = right; x >= left; x -= 0.5) ctx.lineTo(sx(x), sy(Math.min(water.level, hillHeight(seed, x, map))));
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.beginPath();
    for (let x = left; x <= right; x += 0.5) {
      const y = sy(water.level + Math.sin(x * 1.3 + time * 2.4) * 0.05);
      if (x === left) ctx.moveTo(sx(x), y); else ctx.lineTo(sx(x), y);
    }
    ctx.strokeStyle = look.foam; ctx.globalAlpha = 0.8; ctx.lineWidth = Math.max(1.5, 0.06 * s); ctx.stroke(); ctx.globalAlpha = 1;
  }
}
