// The 4 projectile visuals: a normal shot (skin-colored), the blind item's
// shot, the fire item's flame, and the ultimate's heavy round.

import type { TankSkin } from "@shared/tankTypes";
import { BULLET_SKIN_MAP, drawRotatedSprite, getTintedSprite } from "./sprite-utils";

/** A normal shot — colored to match the shooter's own tank skin. Uses the
 * pack's "_outline" variant (a dark ring around the bullet) so it still
 * reads clearly even against a same-colored floor, e.g. sand bullets over
 * sand terrain. */
export function drawNormalBullet(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, skin: TankSkin) {
  const ok = drawRotatedSprite(ctx, `/tank/Retina/bullet${BULLET_SKIN_MAP[skin]}1_outline.png`, x, y, angle, 20);
  if (!ok) {
    ctx.fillStyle = "#facc15";
    ctx.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6);
  }
}

/** The blind item's shot — a generic bullet shape tinted purple. */
export function drawBlindBullet(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  const tinted = getTintedSprite("/tank/Retina/bulletDark1_outline.png", "#a855f7");
  if (tinted) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    const h = 18;
    const w = h * (tinted.width / tinted.height);
    ctx.drawImage(tinted, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#a855f7";
    ctx.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6);
  }
}

/** The EMP item's shot — a generic bullet shape tinted electric yellow,
 * same construction as drawBlindBullet just a different color so the two
 * status-effect rounds still read as visually distinct in flight. */
export function drawEmpBullet(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  const tinted = getTintedSprite("/tank/Retina/bulletDark1_outline.png", "#facc15");
  if (tinted) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    const h = 18;
    const w = h * (tinted.width / tinted.height);
    ctx.drawImage(tinted, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#facc15";
    ctx.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6);
  }
}

/** Flame projectile fired while a fire item's charges are active. */
export function drawFireBullet(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, time: number) {
  const flicker = 0.75 + 0.25 * Math.sin(time / 40);
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
  glow.addColorStop(0, `rgba(254,240,138,${0.8 * flicker})`);
  glow.addColorStop(1, "rgba(251,146,60,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (!drawRotatedSprite(ctx, "/tank/Retina/shotOrange.png", x, y, angle, 20)) {
    ctx.fillStyle = "#ea580c";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The default "big shot" skill's heavy round — a glowing red-orange ember
 * with a short flickering trail, unmistakably beefier than a normal bullet. */
export function drawBigBullet(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, time: number) {
  const flicker = 0.75 + 0.25 * Math.sin(time / 45);
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 13);
  glow.addColorStop(0, `rgba(254,215,170,${0.8 * flicker})`);
  glow.addColorStop(1, "rgba(239,68,68,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (!drawRotatedSprite(ctx, "/tank/Retina/shotRed.png", x, y, angle, 26)) {
    ctx.fillStyle = "#b91c1c";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
