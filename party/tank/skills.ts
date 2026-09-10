// Per-skin ultimate implementations — every tank's unique "R" skill gets its
// own function here, named after the skin it belongs to, so tank-server.ts's
// handleShoot/handleChargeUltimate stay thin dispatchers instead of growing
// a pile of inline per-skin logic as more skins get their own skill. Which
// input mode (instant vs. charge) a skin uses lives in shared/tankTypes.ts's
// ULTIMATE_ACTIVATION_MODE table, not here — this file only cares about what
// each skill actually does once triggered.

import {
  BULLET_SIZE,
  causeCode,
  DARKLARGE_AURA_DURATION_MS,
  DARKLARGE_AURA_RADIUS,
  DARKLARGE_AURA_GRACE_MS,
  DASH_DURATION_MS,
  GREEN_BURST_INTERVAL_MS,
  GREEN_BURST_VOLLEYS,
  HOOK_RANGE,
  HOOK_THROW_MS,
  HOOK_WIDTH,
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
  type TankRoomMode,
} from "../../shared/tankTypes";
import { type CombatCtx, damagePlayer } from "./combat";
import { fireGreenVolley, type GreenBurstFieldCtx, type PendingGreenBurst } from "./greenBurst";
import { aimAngleOf, bulletTicksLeft, makeId, tankBlocked } from "./geometry";
import type { PendingHook } from "./hook";
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
export function initialSkillState(): Pick<TankPlayer, "rapidFireUntil" | "sniperChargingSince" | "dashUntil" | "dashAngle" | "shieldAuraUntil"> {
  return {
    rapidFireUntil: null,
    sniperChargingSince: null,
    dashUntil: null,
    dashAngle: 0,
    shieldAuraUntil: null,
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
    causeCode: causeCode("Bắn tỉa"),
    speed: SNIPER_BULLET_SPEED,
    ticksLeft: bulletTicksLeft("big", SNIPER_BULLET_SPEED),
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
    damagePlayer(ctx, target, SAND_WAVE_DAMAGE, player.id, "Sóng cát");
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

export interface HookCastCtx extends CombatCtx {
  monsters: Monster[];
  pendingHooks: PendingHook[];
}

/** bigRed: a hook skillshot along a narrow HOOK_RANGE-long corridor on the
 * tank's current aim. Firing only picks the target and launches the visible
 * throw — the actual grab (damage/stun) and the reel-in pull happen later,
 * once the throw lands (see stepHooks in ./hook.ts and HOOK_THROW_MS), so
 * the whole thing reads as "throw the chain, hit, then drag it in" instead
 * of resolving in one instant. */
export function activateHook(ctx: HookCastCtx, player: TankPlayer, now: number) {
  const angle = aimAngleOf(player);
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  player.ultimateEnergy = 0;

  const inCorridor = (x: number, y: number) => {
    const dx = x - player.x;
    const dy = y - player.y;
    const forward = dx * ux + dy * uy;
    const perp = -dx * uy + dy * ux;
    return forward >= 0 && forward <= HOOK_RANGE && Math.abs(perp) <= HOOK_WIDTH / 2;
  };

  let bestPlayer: TankPlayer | null = null;
  let bestMonster: Monster | null = null;
  let bestDist = Infinity;

  for (const target of ctx.players.values()) {
    if (target.id === player.id || !target.alive || !inCorridor(target.x, target.y)) continue;
    const d = Math.hypot(target.x - player.x, target.y - player.y);
    if (d < bestDist) {
      bestDist = d;
      bestPlayer = target;
      bestMonster = null;
    }
  }
  for (const monster of ctx.monsters) {
    if (!monster.alive || !inCorridor(monster.x, monster.y)) continue;
    const d = Math.hypot(monster.x - player.x, monster.y - player.y);
    if (d < bestDist) {
      bestDist = d;
      bestMonster = monster;
      bestPlayer = null;
    }
  }

  if (!bestPlayer && !bestMonster) {
    ctx.impacts.push({ id: makeId(), x: player.x, y: player.y, kind: "hook", x2: player.x + ux * HOOK_RANGE, y2: player.y + uy * HOOK_RANGE });
    return;
  }

  const target = bestPlayer ?? bestMonster!;
  ctx.impacts.push({ id: makeId(), x: player.x, y: player.y, kind: "hook", x2: target.x, y2: target.y, durationMs: HOOK_THROW_MS });
  ctx.pendingHooks.push({
    id: makeId(),
    casterId: player.id,
    targetKind: bestPlayer ? "player" : "monster",
    targetId: target.id,
    angle,
    resolveAt: now + HOOK_THROW_MS,
  });
}

export interface GreenBurstCastCtx extends GreenBurstFieldCtx {
  pendingGreenBursts: PendingGreenBurst[];
}

/** Green: fires the first ring immediately, then schedules the remaining
 * GREEN_BURST_VOLLEYS - 1 rings (see stepGreenBursts in ./greenBurst.ts). */
export function activateGreenBurst(ctx: GreenBurstCastCtx, player: TankPlayer, now: number) {
  player.ultimateEnergy = 0;
  fireGreenVolley(ctx, player);
  if (GREEN_BURST_VOLLEYS > 1) {
    ctx.pendingGreenBursts.push({ id: makeId(), ownerId: player.id, volleysRemaining: GREEN_BURST_VOLLEYS - 1, nextFireAt: now + GREEN_BURST_INTERVAL_MS });
  }
}

/** darkLarge: starts (or refreshes) the mobile damage-immunity aura — see
 * stepShieldAuras below for the actual per-tick application to nearby
 * allies. */
export function activateShieldAura(player: TankPlayer, now: number) {
  player.ultimateEnergy = 0;
  player.shieldAuraUntil = now + DARKLARGE_AURA_DURATION_MS;
}

export interface ShieldAuraCtx {
  players: Map<string, TankPlayer>;
  mode: TankRoomMode;
}

/** Every tick, any darkLarge with an active aura refreshes auraShieldUntil
 * on itself and (in team mode) any teammate within DARKLARGE_AURA_RADIUS —
 * a small per-tick grace window (DARKLARGE_AURA_GRACE_MS) so the buff
 * doesn't flicker off the instant someone drifts a step out of range, but
 * still decays quickly once they actually leave. Unlike the item shield
 * (shieldHitsLeft), this never blocks movement — see damagePlayer in
 * combat.ts for where it actually blocks damage. */
export function stepShieldAuras(ctx: ShieldAuraCtx, now: number) {
  for (const caster of ctx.players.values()) {
    if (!caster.alive || caster.shieldAuraUntil === null) continue;
    if (now >= caster.shieldAuraUntil) {
      caster.shieldAuraUntil = null;
      continue;
    }
    for (const ally of ctx.players.values()) {
      if (ally.id !== caster.id && (ctx.mode !== "team" || ally.team !== caster.team)) continue;
      if (!ally.alive) continue;
      const dist = Math.hypot(ally.x - caster.x, ally.y - caster.y);
      if (dist > DARKLARGE_AURA_RADIUS) continue;
      ally.auraShieldUntil = now + DARKLARGE_AURA_GRACE_MS;
    }
  }
}
