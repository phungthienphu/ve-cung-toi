// Placed game objects with their own HP/behavior: tanks, forest monsters,
// crates, traps, and ground pickups.

import {
  CRATE_MAX_HP,
  CRATE_SIZE,
  MAX_HP,
  MONSTER_HP,
  MONSTER_SIZE,
  PICKUP_SIZE,
  TANK_SIZE,
  TANK_SKINS_WITH_TURRET,
  TRAP_SIZE,
  type Crate,
  type Direction,
  type Monster,
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
  aimAngle: number | null
) {
  const half = TANK_SIZE / 2;
  drawHealthBar(ctx, x, y, hp, isAlly);

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
    const body = getSprite(`/Retina/tankBody_${skin}.png`);
    if (body) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(bodyAngle + Math.PI / 2);
      const h = renderSize;
      const w = h * (body.width / body.height);
      ctx.drawImage(body, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    const barrel = getSprite(`/Retina/tank${capitalize(skin)}_barrel1.png`);
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
    const composed = getSprite(`/Retina/tank_${skin}.png`);
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

export function drawHealthPickup(ctx: CanvasRenderingContext2D, x: number, y: number) {
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

export function drawItemPickup(ctx: CanvasRenderingContext2D, x: number, y: number, kind: "trap" | "blind" | "shield" | "fire") {
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

export function drawCrate(ctx: CanvasRenderingContext2D, crate: Crate) {
  const img = getSprite("/Retina/crateWood.png");
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
  const tinted = getTintedSprite("/trap_scope.png", "#f59e0b");
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

export function drawMonster(ctx: CanvasRenderingContext2D, monster: Monster) {
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

