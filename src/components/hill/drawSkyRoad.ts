import type { HillSkyRoad } from '@shared/hillTerrain';
import type { HillMapId } from '@shared/hillTypes';

const LOOK = {
  tea: { soil: '#a96b42', deep: '#654338', stone: '#cf9b69', edge: '#473b30', turf: '#4c933e', light: '#a5da60', shade: '#2f6337' },
  sand: { soil: '#c99a60', deep: '#936444', stone: '#e8be81', edge: '#71533b', turf: '#b8ac56', light: '#eed78a', shade: '#8d8541' },
  mountain: { soil: '#8e7770', deep: '#534d55', stone: '#baa899', edge: '#413f48', turf: '#568772', light: '#b2caaa', shade: '#355b52' },
  moon: { soil: '#8887ac', deep: '#535475', stone: '#b2afcf', edge: '#373d5b', turf: '#8ca5ba', light: '#d7e7e8', shade: '#61788f' },
} satisfies Record<HillMapId, object>;

/** Stable world-space texture: camera movement never shuffles the island's details. */
const grain = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** A grass-capped floating island; its level top matches the one-way physics surface. */
export function drawSkyRoad(ctx: CanvasRenderingContext2D, sx: (x: number) => number, sy: (y: number) => number, s: number, map: HillMapId, road: HillSkyRoad) {
  const look = LOOK[map], left = sx(road.x0), right = sx(road.x1), top = sy(road.y);
  const length = road.x1 - road.x0;
  const bottom = (x: number) => top + s * (0.88 + grain(Math.floor(x * 2) + road.section * 31) * .4);
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // Broken soil silhouette, with tapered end faces rather than square metal caps.
  ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(right, top);
  ctx.lineTo(right - .12 * s, top + .65 * s);
  for (let x = road.x1 - .3; x > road.x0 + .3; x -= .45) ctx.lineTo(sx(x), bottom(x));
  ctx.lineTo(left + .12 * s, top + .65 * s); ctx.closePath();
  const earth = ctx.createLinearGradient(0, top, 0, top + 1.3 * s);
  earth.addColorStop(0, look.soil); earth.addColorStop(.5, look.soil); earth.addColorStop(1, look.deep);
  ctx.fillStyle = earth; ctx.fill();
  ctx.strokeStyle = look.edge; ctx.lineWidth = Math.max(1, .065 * s); ctx.stroke();
  ctx.save(); ctx.clip();
  // A darker lower stratum and scattered angular stones keep the face organic.
  ctx.strokeStyle = look.deep; ctx.lineWidth = .13 * s; ctx.beginPath();
  for (let i = 0; i <= Math.ceil(length); i++) {
    const x = road.x0 + i, y = top + (.67 + grain(i + road.section) * .13) * s;
    if (i === 0) ctx.moveTo(sx(x), y); else ctx.lineTo(sx(x), y);
  }
  ctx.stroke();
  for (let i = 0; i < length * 3; i++) {
    const x = left + (.2 + grain(i + road.section * 67) * (length - .4)) * s;
    const y = top + (.35 + grain(i + 200) * .64) * s;
    const r = (.06 + grain(i + 400) * .1) * s;
    ctx.fillStyle = i % 3 ? look.stone : look.deep;
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - r * .3, y - r * .6);
    ctx.lineTo(x + r, y - r * .35); ctx.lineTo(x + r * .65, y + r * .6);
    ctx.lineTo(x - r * .6, y + r * .5); ctx.closePath(); ctx.fill();
  }
  // Grass overhangs down the soil face. Decorations never form pillars below it.
  ctx.fillStyle = look.shade; ctx.fillRect(left, top, right - left, .19 * s);
  for (let i = 0; i < length / .3; i++) {
    const x = left + i * .3 * s, drop = (.18 + grain(i + road.section) * .19) * s;
    ctx.beginPath(); ctx.moveTo(x - .1 * s, top); ctx.lineTo(x + .23 * s, top);
    ctx.lineTo(x + .12 * s, top + drop); ctx.lineTo(x + .03 * s, top + drop * .65); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // Soft scalloped sod and tiny highlights, aligned to the actual drivable edge.
  ctx.strokeStyle = look.turf; ctx.lineWidth = .16 * s;
  ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(right, top); ctx.stroke();
  for (let i = 0; i < length / .24; i++) {
    const x = left + (.1 + i * .24) * s;
    ctx.fillStyle = i % 3 ? look.turf : look.light;
    ctx.beginPath(); ctx.ellipse(x, top - .035 * s, .16 * s, (.06 + grain(i + 900) * .035) * s, 0, 0, Math.PI * 2); ctx.fill();
    if (map !== 'moon' && i % 5 === 0) {
      ctx.strokeStyle = look.light; ctx.lineWidth = Math.max(1, .025 * s);
      ctx.beginPath(); ctx.moveTo(x, top - .04 * s); ctx.lineTo(x - .045 * s, top - .18 * s);
      ctx.moveTo(x, top - .04 * s); ctx.lineTo(x + .055 * s, top - .13 * s); ctx.stroke();
    }
  }
  ctx.restore();
}
