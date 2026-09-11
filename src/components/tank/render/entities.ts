// Placed game objects with their own HP/behavior: tanks, forest monsters,
// crates, traps, and ground pickups.

import {
  BULLET_SPREAD_MAX_DEG,
  CRATE_MAX_HP,
  CRATE_SIZE,
  MAX_HP,
  MONSTER_SIZE,
  PICKUP_SIZE,
  TANK_SIZE,
  TANK_SKINS_WITH_TURRET,
  TRAP_SIZE,
  type Crate,
  type Direction,
  type PublicMonster,
} from "@shared/tankTypes";
import { getSprite } from "@/lib/imageCache";
import { DIR_ANGLE, capitalize, getTintedSprite, skinForColor } from "./sprite-utils";

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

export function drawTank(
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
  aimAngle: number | null,
  isRapidFiring: boolean,
  dashInfo: { isDashing: boolean; angle: number } | null
) {
  const half = TANK_SIZE / 2;
  drawHealthBar(ctx, x, y, hp, isAlly);

  // Blue's rapid-fire ultimate: a fast-flickering cyan ring, distinct from
  // the slower amber boost ring so both stay readable if they ever overlap.
  if (isRapidFiring) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 70);
    ctx.save();
    ctx.strokeStyle = `rgba(34,211,238,${0.5 + 0.5 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, half + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Huge's dash: a billowing dust cloud + a fan of streaks trailing behind,
  // opposite the dash direction — drawn before the tank sprite so it reads
  // as being kicked up from underneath rather than floating on top.
  if (dashInfo?.isDashing) {
    const t = performance.now();
    const backX = Math.cos(dashInfo.angle + Math.PI);
    const backY = Math.sin(dashInfo.angle + Math.PI);
    const perpX = -Math.sin(dashInfo.angle);
    const perpY = Math.cos(dashInfo.angle);

    // Soft billowing dust cloud, biggest right behind the tank and fading
    // out further back — sells "kicking up a lot of ground", not just a
    // motion streak.
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const puffDist = 8 + i * 11 + Math.sin(t / 60 + i * 2) * 3;
      const puffSize = (half + 6 - i * 3) * (1 + 0.15 * Math.sin(t / 50 + i));
      const px = x + backX * puffDist + perpX * Math.sin(t / 80 + i * 1.7) * 4;
      const py = y + backY * puffDist + perpY * Math.sin(t / 80 + i * 1.7) * 4;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, puffSize);
      grad.addColorStop(0, `rgba(168,143,101,${0.5 - i * 0.13})`);
      grad.addColorStop(1, "rgba(168,143,101,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, puffSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // A denser fan of streak lines cutting through the dust cloud.
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const spread = (i - 3.5) * 3.2;
      const len = 12 + ((i * 7) % 12) + Math.sin(t / 40 + i) * 3;
      ctx.strokeStyle = `rgba(120,113,108,${0.55 - (i % 3) * 0.1})`;
      ctx.lineWidth = i % 2 === 0 ? 2.2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(x + perpX * spread, y + perpY * spread);
      ctx.lineTo(x + perpX * spread + backX * len, y + perpY * spread + backY * len);
      ctx.stroke();
    }
    ctx.restore();
  }

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
    const body = getSprite(`/tank/Retina/tankBody_${skin}.png`);
    if (body) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(bodyAngle + Math.PI / 2);
      const h = renderSize;
      const w = h * (body.width / body.height);
      ctx.drawImage(body, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    const barrel = getSprite(`/tank/Retina/tank${capitalize(skin)}_barrel1.png`);
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
    const composed = getSprite(`/tank/Retina/tank_${skin}.png`);
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

/** Small flame flicker drawn over a burning tank. */
export function drawBurningOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
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

/** Spinning "dizzy stars" over a stunned tank (Sand's ultimate) — visible to
 * everyone, same as the burning overlay, so it's obvious at a glance who
 * currently can't move or act. */
export function drawStunnedOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const half = TANK_SIZE / 2;
  const orbitY = y - half - 16;
  for (let i = 0; i < 3; i++) {
    const angle = time / 260 + (i / 3) * Math.PI * 2;
    const sx = x + Math.cos(angle) * 10;
    const sy = orbitY + Math.sin(angle) * 3;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    ctx.fillStyle = "#fde047";
    ctx.strokeStyle = "#a16207";
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
      const r = p % 2 === 0 ? 4 : 1.8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/** EMP item: jagged yellow sparks crackling over a tank whose cannon is
 * jammed — same "electric arcs" technique as drawHookedOverlay but yellow
 * (not hook's cyan) and without the flipped-barrel sprite, since movement
 * still works here, only firing is disabled. Visible to everyone, same
 * reasoning as the burning/stunned overlays. */
export function drawJammedOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const half = TANK_SIZE / 2;
  const flickerSeed = Math.floor(time / 60);
  const rand = (seed: number) => {
    const v = Math.sin(seed * 12.9898 + flickerSeed * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };

  ctx.save();
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 1.25;
  ctx.globalAlpha = 0.85;
  const boltCount = 3;
  for (let i = 0; i < boltCount; i++) {
    const angle = (i / boltCount) * Math.PI * 2 + rand(i) * Math.PI * 0.5;
    const outerR = half + 9;
    const sx = x + Math.cos(angle) * outerR;
    const sy = y + Math.sin(angle) * outerR;
    const midAngle = angle + (rand(i + 10) - 0.5) * 1.0;
    const midR = half + 2;
    const mx = x + Math.cos(midAngle) * midR;
    const my = y + Math.sin(midAngle) * midR;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(mx, my);
    ctx.stroke();
  }
  ctx.restore();
}

/** bigRed's hook holding a target still — jagged electric arcs crackling
 * around the tank plus its own barrel hovering upside-down overhead, reading
 * as "aimed at / pinned" rather than the generic dizzy-stars stun look. Drawn
 * instead of drawStunnedOverlay while `hookedUntil` is active (see
 * TankCanvas.tsx), even though both block input the same way server-side. */
export function drawHookedOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const half = TANK_SIZE / 2;
  const flickerSeed = Math.floor(time / 70);
  const rand = (seed: number) => {
    const v = Math.sin(seed * 12.9898 + flickerSeed * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };

  ctx.save();
  ctx.strokeStyle = "#7dd3fc";
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.9;
  const boltCount = 4;
  for (let i = 0; i < boltCount; i++) {
    const angle = (i / boltCount) * Math.PI * 2 + rand(i) * Math.PI * 0.4;
    const outerR = half + 14;
    const sx = x + Math.cos(angle) * outerR;
    const sy = y + Math.sin(angle) * outerR;
    const midR = half + 5;
    const midAngle = angle + (rand(i + 10) - 0.5) * 0.8;
    const mx = x + Math.cos(midAngle) * midR;
    const my = y + Math.sin(midAngle) * midR;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(mx, my);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.restore();

  const sprite = getSprite("/tank/Retina/barrelRed_top.png");
  if (sprite) {
    const w = 20;
    const h = (sprite.naturalHeight / sprite.naturalWidth) * w;
    const bob = Math.sin(time / 180) * 2;
    ctx.save();
    ctx.translate(x, y - half - 22 + bob);
    ctx.rotate(Math.PI);
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

/** darkLarge's aura, the emitter's own side: a large violet ring at
 * DARKLARGE_AURA_RADIUS around the tank while its channel is up, so
 * everyone can see exactly how close they need to stay to be covered. */
export function drawAuraEmitterRing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, time: number) {
  const pulse = 0.6 + 0.4 * Math.sin(time / 260);
  ctx.save();
  ctx.fillStyle = `rgba(167,139,250,${0.05 * pulse})`;
  ctx.strokeStyle = `rgba(167,139,250,${0.55 * pulse})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** darkLarge's aura, the beneficiary's side: a soft violet glow on anyone
 * (ally or darkLarge itself) currently standing inside an active aura —
 * distinct in color from the item shield's blue ring (drawn inline above)
 * so the two "can't be hurt" states still read as different things. */
export function drawAuraShieldGlow(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const half = TANK_SIZE / 2;
  const pulse = 0.6 + 0.4 * Math.sin(time / 220);
  ctx.save();
  ctx.fillStyle = `rgba(167,139,250,${0.15 * pulse})`;
  ctx.strokeStyle = `rgba(167,139,250,${0.75 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, half + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Local accuracy cue for the "spam widens spread" mechanic (see
 * BULLET_SPREAD_* in tankTypes.ts and tank-server.ts's handleShoot): two
 * thin lines fanning out from the muzzle showing roughly how far the next
 * shot could drift off-aim, redder the hotter it's running. Self only —
 * this is a UI hint about your own next shot, not something opponents need
 * to see. */
export function drawSpreadCone(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, spreadDeg: number) {
  const half = TANK_SIZE / 2;
  const offset = half + 6;
  const len = 34;
  const spreadRad = (spreadDeg * Math.PI) / 180;
  const heatT = Math.min(1, spreadDeg / BULLET_SPREAD_MAX_DEG);
  ctx.save();
  ctx.strokeStyle = `rgba(248,113,113,${0.3 + 0.4 * heatT})`;
  ctx.lineWidth = 1.5;
  for (const sign of [-1, 1]) {
    const a = angle + sign * spreadRad;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * offset, y + Math.sin(angle) * offset);
    ctx.lineTo(x + Math.cos(a) * (offset + len), y + Math.sin(a) * (offset + len));
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHealthPickup(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const img = getSprite("/tank/items/heart-hp.png");
  if (!img) return;
  const size = PICKUP_SIZE * 1.5;
  const bob = Math.sin(performance.now() / 280 + x) * 1.5;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(x - size / 2), Math.round(y - size / 2 + bob), size, size);
  ctx.restore();
}

export function drawItemPickup(ctx: CanvasRenderingContext2D, x: number, y: number, kind: "trap" | "blind" | "shield" | "fire" | "emp") {
  if (kind === "shield") {
    const img = getSprite("/tank/items/shield.png");
    if (!img) return;
    const size = PICKUP_SIZE * 1.5;
    const bob = Math.sin(performance.now() / 280 + x) * 1.5;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(x - size / 2), Math.round(y - size / 2 + bob), size, size);
    ctx.restore();
    return;
  }
  const half = PICKUP_SIZE / 2;
  const palette: Record<typeof kind, [string, string, string]> = {
    trap: ["#fef3c7", "#b45309", "💣"],
    blind: ["#ede9fe", "#6d28d9", "M"],
    fire: ["#ffedd5", "#c2410c", "🔥"],
    emp: ["#fef9c3", "#a16207", "⚡"],
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

export function drawCrate(ctx: CanvasRenderingContext2D, crate: Crate) {
  const img = getSprite("/tank/Retina/crateWood.png");
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

export function drawTrap(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const tinted = getTintedSprite("/tank/trap_scope.png", "#f59e0b");
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

export function drawMonster(ctx: CanvasRenderingContext2D, monster: PublicMonster) {
  const half = MONSTER_SIZE / 2;
  const bob = Math.sin(performance.now() / 220 + monster.x) * 1.5;

  // Health pips — each monster's own maxHp, since a pack isn't all equally
  // tough.
  for (let i = 0; i < monster.maxHp; i++) {
    ctx.fillStyle = i < monster.hp ? "#a855f7" : "#334155";
    ctx.fillRect(Math.round(monster.x - half + i * (half / 1.2)), monster.y - half - 12, 6, 4);
  }

  const variants = ["/tank/monster/tile_0108.png", "/tank/monster/tile_0109.png", "/tank/monster/tile_0121.png"];
  const variantIndex = [...monster.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % variants.length;
  const img = getSprite(variants[variantIndex]);
  if (!img) return;

  const size = MONSTER_SIZE * 1.55;
  ctx.save();
  if (monster.aggroPlayerId) {
    const pulse = 0.55 + 0.25 * Math.sin(performance.now() / 100);
    ctx.shadowColor = `rgba(239,68,68,${pulse})`;
    ctx.shadowBlur = 9;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(monster.x - size / 2), Math.round(monster.y - size / 2 + bob), size, size);
  ctx.restore();
}
