// Per-skin ultimate implementations — every tank's unique "R" skill gets its
// own function here, named after the skin it belongs to, so tank-server.ts's
// handleShoot/handleChargeUltimate stay thin dispatchers instead of growing
// a pile of inline per-skin logic as more skins get their own skill. Which
// input mode (instant vs. charge) a skin uses lives in shared/tankTypes.ts's
// ULTIMATE_ACTIVATION_MODE table, not here — this file only cares about what
// each skill actually does once triggered.

import {
  BULLET_SIZE,
  DASH_DURATION_MS,
  MONSTER_AGGRO_TIMEOUT_MS,
  MONSTER_RESPAWN_DELAY_MS,
  RAPID_FIRE_DURATION_MS,
  RED_BOMB_MAX_RANGE,
  SAND_WAVE_DAMAGE,
  SAND_WAVE_KNOCKBACK_DIST,
  SAND_WAVE_RANGE,
  SAND_WAVE_STUN_MS,
  SAND_WAVE_WIDTH,
  SNIPER_BULLET_SPEED,
  TANK_SIZE,
  type Bullet,
  type Monster,
  type Pickup,
  type RedBarrage,
  type TankMapDef,
  type TankPlayer,
} from "../../shared/tankTypes";
import { type CombatCtx, damagePlayer } from "./combat";
import { aimAngleOf, makeId, tankBlocked } from "./geometry";
import { createRedBarrage } from "./redBarrage";

/**
 * Every skin's own transient "mid-skill" state, in one place. A "target"
 * skin (see ULTIMATE_ACTIVATION_MODE) like Red never needs an entry here —
 * its whole pre-commit phase is local-only client state (see
 * useTankInput.ts's isTargetingRef) that never touches TankPlayer at all.
 *
 * Adding the next skill's own charging/channeling field is then a one-line
 * addition here, instead of a new line to remember at every one of the
 * several places a player's state gets reset (join, match start, respawn) —
 * miss one of those by hand and a player can end up permanently stuck
 * "mid-skill" until they leave the room.
 */
export function initialSkillState(): Pick<TankPlayer, "rapidFireUntil" | "sniperChargingSince" | "dashUntil" | "dashAngle"> {
  return {
    rapidFireUntil: null,
    sniperChargingSince: null,
    dashUntil: null,
    dashAngle: 0,
  };
}

/** Same fields as initialSkillState, applied to an existing player in place.
 * Called from tank-server.ts (match start) and players-tick.ts (respawn);
 * a freshly-joined player instead spreads `...initialSkillState()` straight
 * into their initial object, since it doesn't exist yet to mutate. */
export function resetSkillState(player: TankPlayer) {
  Object.assign(player, initialSkillState());
}

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

/** Red: commits a barrage at a client-picked world point. Clamped to
 * RED_BOMB_MAX_RANGE from the tank so a stray/malicious click far outside
 * the tank's reach doesn't do anything — the client keeps its own aim
 * inside this range for a well-behaved player, this is just the
 * server-authoritative backstop. */
export function throwRedBomb(player: TankPlayer, x: number, y: number, now: number): RedBarrage {
  let tx = x;
  let ty = y;
  const dist = Math.hypot(x - player.x, y - player.y);
  if (dist > RED_BOMB_MAX_RANGE) {
    const scale = RED_BOMB_MAX_RANGE / dist;
    tx = player.x + (x - player.x) * scale;
    ty = player.y + (y - player.y) * scale;
  }
  player.ultimateEnergy = 0;
  return createRedBarrage(player.id, tx, ty, now);
}

/** Huge: locks in a dash direction and duration — the actual forced
 * movement + bulldozer knockback happens every tick while it's active, in
 * players-tick.ts (kept there rather than here since it needs to run
 * alongside/instead of normal per-tick movement resolution, not as a
 * one-shot call). */
export function activateDash(player: TankPlayer, now: number) {
  player.ultimateEnergy = 0;
  player.dashAngle = aimAngleOf(player);
  player.dashUntil = now + DASH_DURATION_MS;
}

export interface SandWaveCtx extends CombatCtx {
  monsters: Monster[];
  monsterAggroUntil: Map<string, number>;
  pickups: Pickup[];
}

/** Sand: an instant shockwave fanned out along the tank's current aim — a
 * SAND_WAVE_RANGE-long by SAND_WAVE_WIDTH-wide rectangle, resolved the
 * moment it's triggered (no travel time, unlike a bullet). Anyone caught in
 * it takes light damage, gets knocked back along the same direction (capped
 * by walls, same as any other push in this game); a tank is also stunned —
 * a monster instead just gets bumped and aggroed, the same way a bullet hit
 * would, since a monster has no inputs of its own to lock out. */
export function activateSandWave(ctx: SandWaveCtx, player: TankPlayer, map: TankMapDef, now: number) {
  const angle = aimAngleOf(player);
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  player.ultimateEnergy = 0;
  ctx.impacts.push({ id: makeId(), x: player.x, y: player.y, kind: "sand_wave", angle });

  const inCone = (x: number, y: number) => {
    const dx = x - player.x;
    const dy = y - player.y;
    const forward = dx * ux + dy * uy; // distance along the wave's direction
    const perp = -dx * uy + dy * ux; // perpendicular distance off the centerline
    return forward >= 0 && forward <= SAND_WAVE_RANGE && Math.abs(perp) <= SAND_WAVE_WIDTH / 2;
  };
  const knockBack = (target: { x: number; y: number }) => {
    const nx = target.x + ux * SAND_WAVE_KNOCKBACK_DIST;
    const ny = target.y + uy * SAND_WAVE_KNOCKBACK_DIST;
    if (!tankBlocked(map, nx, target.y)) target.x = nx;
    if (!tankBlocked(map, target.x, ny)) target.y = ny;
  };

  for (const target of ctx.players.values()) {
    if (target.id === player.id || !target.alive || !inCone(target.x, target.y)) continue;
    damagePlayer(ctx, target, SAND_WAVE_DAMAGE, player.id);
    target.stunnedUntil = now + SAND_WAVE_STUN_MS;
    knockBack(target);
  }

  for (const monster of ctx.monsters) {
    if (!monster.alive || !inCone(monster.x, monster.y)) continue;
    monster.hp -= 1;
    if (monster.hp <= 0) {
      monster.alive = false;
      monster.respawnAt = now + MONSTER_RESPAWN_DELAY_MS;
      monster.aggroPlayerId = null;
      ctx.pickups.push({ id: makeId(), x: monster.x, y: monster.y, kind: "shield" });
    } else {
      monster.aggroPlayerId = player.id;
      ctx.monsterAggroUntil.set(monster.id, now + MONSTER_AGGRO_TIMEOUT_MS);
      knockBack(monster);
    }
  }
}
