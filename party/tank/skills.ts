// Per-skin ultimate implementations — every tank's unique "R" skill gets its
// own function here, named after the skin it belongs to, so tank-server.ts's
// handleShoot/handleChargeUltimate stay thin dispatchers instead of growing
// a pile of inline per-skin logic as more skins get their own skill. Which
// input mode (instant vs. charge) a skin uses lives in shared/tankTypes.ts's
// ULTIMATE_ACTIVATION_MODE table, not here — this file only cares about what
// each skill actually does once triggered.

import { BULLET_SIZE, RAPID_FIRE_DURATION_MS, SNIPER_BULLET_SPEED, TANK_SIZE, type Bullet, type TankPlayer } from "../../shared/tankTypes";
import { aimAngleOf, makeId } from "./geometry";

/** Blue: a short window of much faster fire-rate instead of a projectile —
 * see tank-server.ts's handleShoot for where the shortened cooldown is
 * actually applied while this is active. */
export function activateRapidFire(player: TankPlayer, now: number) {
  player.ultimateEnergy = 0;
  player.rapidFireUntil = now + RAPID_FIRE_DURATION_MS;
}

export interface SniperCtx {
  bullets: Bullet[];
}

/** Dark: resolves the scoped sniper shot — called both when the player pulls
 * the normal fire trigger while scoped and when the tick loop auto-fires it
 * past SNIPER_MAX_CHARGE_MS. Fires at the tank's current aim (not whatever
 * angle it was when the scope toggled on), same damage as a normal ultimate
 * but much faster travel. */
export function fireSniperShot(ctx: SniperCtx, player: TankPlayer) {
  const angle = aimAngleOf(player);
  const offset = TANK_SIZE / 2 + BULLET_SIZE;
  ctx.bullets.push({
    id: makeId(),
    ownerId: player.id,
    x: player.x + Math.cos(angle) * offset,
    y: player.y + Math.sin(angle) * offset,
    angle,
    kind: "big",
    speed: SNIPER_BULLET_SPEED,
  });
  player.ultimateEnergy = 0;
  player.sniperChargingSince = null;
}
