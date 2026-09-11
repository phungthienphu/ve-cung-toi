// Per-player per-tick resolution: respawn, ultimate regen, movement (with
// the tank/crate shove physics), pickup collection, trap triggers, and the
// two ticked damage-over-time sources (hazard tiles, burning).

import {
  AMMO_MAX_ROUNDS,
  AMMO_REGEN_PER_TICK,
  BOOST_REGEN_PER_TICK,
  BURN_DAMAGE_PER_TICK,
  BURN_TICK_INTERVAL_MS,
  DASH_DURATION_MS,
  DASH_KNOCKBACK_DIST,
  DASH_KNOCKBACK_RADIUS,
  HAZARD_DAMAGE,
  HAZARD_DAMAGE_INTERVAL_MS,
  HOOK_PULL_DURATION_MS,
  MAX_BOOST_ENERGY,
  MAX_HELD_ITEMS,
  MAX_HP,
  NEST_PUDDLE_RADIUS,
  PICKUP_HEAL_AMOUNT,
  PICKUP_SIZE,
  SNIPER_MAX_CHARGE_MS,
  SPAWN_MIN_DISTANCE_PX,
  TANK_SIZE,
  TRAP_DAMAGE,
  TRAP_SIZE,
  ULTIMATE_CONFIG,
  mapCols,
  skinForColor,
  type Bullet,
  type Crate,
  type Monster,
  type Pickup,
  type TankMapDef,
  type TankPlayer,
  type Trap,
} from "../../shared/tankTypes";
import { type TryEntityMove, stepSelfMovement, tankBlocked, tileAt } from "../../shared/tankMovement";
import { type CombatCtx, damagePlayer } from "./combat";
import { findOverlappingCrate, findOverlappingTank, makeId, pickSpawnTile, spawnPixel, tryPushCrate, tryPushTank, winsShovingContest } from "./geometry";
import { fireSniperShot, resetSkillState } from "./skills";
import type { InputState } from "./types";

export interface PlayersTickCtx extends CombatCtx {
  inputs: Map<string, InputState>;
  crates: Crate[];
  pickups: Pickup[];
  traps: Trap[];
  monsters: Monster[];
  bullets: Bullet[];
  lastHazardDamageAt: Map<string, number>;
  lastBurnDamageAt: Map<string, number>;
  lastDashHitAt: Map<string, number>;
}

export function stepPlayers(ctx: PlayersTickCtx, map: TankMapDef, now: number) {
  for (const player of ctx.players.values()) {
    if (!player.alive) {
      if (player.respawnAt !== null && now >= player.respawnAt) {
        // Same random-and-scattered placement as match start (see
        // handleStartGame's pickSpawnTile calls in tank-server.ts) — steers
        // clear of every monster nest and every other currently-alive tank,
        // so a respawn doesn't drop someone back into a crowd or next to
        // the pack that might have just killed them.
        const cols = mapCols(map);
        const avoidPx: { x: number; y: number }[] = ctx.monsters.map((m) => ({ x: m.nestX, y: m.nestY }));
        for (const other of ctx.players.values()) {
          if (other.id !== player.id && other.alive) avoidPx.push({ x: other.x, y: other.y });
        }
        const colRange =
          ctx.mode === "team" ? (player.team === "A" ? { min: 1, max: Math.floor(cols / 2) - 1 } : { min: Math.floor(cols / 2), max: cols - 2 }) : undefined;
        const spawn = spawnPixel(pickSpawnTile(map, avoidPx, SPAWN_MIN_DISTANCE_PX, colRange));
        player.x = spawn.x;
        player.y = spawn.y;
        player.alive = true;
        player.hp = MAX_HP;
        player.respawnAt = null;
        player.blindedUntil = null;
        player.weaponJammedUntil = null;
        player.stunnedUntil = null;
        player.hookedUntil = null;
        player.hookPullUntil = null;
        player.auraShieldUntil = null;
        player.boostEnergy = MAX_BOOST_ENERGY;
        player.isBoosting = false;
        player.shieldHitsLeft = 0;
        player.fireShotsLeft = 0;
        player.ammo = AMMO_MAX_ROUNDS;
        player.burningUntil = null;
        player.burnOwnerId = null;
        player.velocityX = 0;
        player.velocityY = 0;
        resetSkillState(player);
      }
      continue;
    }
    const ultimateConfig = ULTIMATE_CONFIG[skinForColor(player.color)];
    player.ultimateEnergy = Math.min(ultimateConfig.maxEnergy, player.ultimateEnergy + ultimateConfig.regenPerTick);
    player.ammo = Math.min(AMMO_MAX_ROUNDS, player.ammo + AMMO_REGEN_PER_TICK);
    if (player.rapidFireUntil !== null && now >= player.rapidFireUntil) {
      player.rapidFireUntil = null;
    }
    if (player.sniperChargingSince !== null && now - player.sniperChargingSince >= SNIPER_MAX_CHARGE_MS) {
      fireSniperShot(ctx, player);
    }
    if (player.stunnedUntil !== null && now >= player.stunnedUntil) {
      player.stunnedUntil = null;
    }
    if (player.hookedUntil !== null && now >= player.hookedUntil) {
      player.hookedUntil = null;
    }
    if (player.auraShieldUntil !== null && now >= player.auraShieldUntil) {
      player.auraShieldUntil = null;
    }

    if (player.dashUntil !== null && now >= player.dashUntil) {
      player.dashUntil = null;
    }
    const isDashing = player.dashUntil !== null;

    if (player.hookPullUntil !== null && now >= player.hookPullUntil) {
      player.x = player.hookPullToX;
      player.y = player.hookPullToY;
      player.hookPullUntil = null;
    }

    const input = ctx.inputs.get(player.id);
    if (player.hookPullUntil !== null) {
      // Eased travel from where the hook landed to where it's dragging the
      // target — a decelerating "yanked then settling" curve rather than a
      // linear slide, so the tug reads as physical rather than mechanical.
      // All normal input is ignored for the (short) remainder of the pull.
      const start = player.hookPullUntil - HOOK_PULL_DURATION_MS;
      const t = Math.max(0, Math.min(1, (now - start) / HOOK_PULL_DURATION_MS));
      const eased = 1 - Math.pow(1 - t, 3);
      player.x = player.hookPullFromX + (player.hookPullToX - player.hookPullFromX) * eased;
      player.y = player.hookPullFromY + (player.hookPullToY - player.hookPullFromY) * eased;
      player.moving = false;
      player.velocityX = 0;
      player.velocityY = 0;
      player.boostEnergy = Math.min(MAX_BOOST_ENERGY, player.boostEnergy + BOOST_REGEN_PER_TICK);
      player.isBoosting = false;
    } else {
      // Shove-resolution side effect for the "normal movement" branch below
      // — see TryEntityMove's doc. Not consulted at all while dashing
      // (stepSelfMovement passes straight through other tanks/crates for
      // that branch on its own, same as before this refactor).
      const tryEntityMove: TryEntityMove = (nx, ny, dx, dy, wantsBoost) => {
        const blocker = findOverlappingTank(ctx.players.values(), new Set([player.id]), nx, ny);
        if (blocker) {
          if (!winsShovingContest(player, wantsBoost, blocker)) return false;
          const impactX = blocker.x;
          const impactY = blocker.y;
          if (!tryPushTank(blocker, dx, dy, map, ctx.players, player.id)) return false;
          ctx.impacts.push({ id: makeId(), x: impactX, y: impactY, kind: "shove" });
          return true;
        }
        const crateBlocker = findOverlappingCrate(ctx.crates, nx, ny);
        if (crateBlocker) {
          const impactX = crateBlocker.x;
          const impactY = crateBlocker.y;
          if (!tryPushCrate(crateBlocker, dx, dy, map, ctx.crates, ctx.players)) return false;
          ctx.impacts.push({ id: makeId(), x: impactX, y: impactY, kind: "shove" });
          return true;
        }
        return true;
      };

      // The actual movement math (plain walking, boost, ice, and a dash's
      // forced slide) lives in shared/tankMovement.ts — the client's own
      // prediction of this same tank calls the exact same function, so the
      // two can never drift apart on tuning or bugs. See its doc.
      const moved = stepSelfMovement(
        player,
        input,
        {
          isShielded: player.shieldHitsLeft > 0,
          isStunned: player.stunnedUntil !== null && now < player.stunnedUntil,
          dashUntil: player.dashUntil,
          dashAngle: player.dashAngle,
        },
        map,
        tryEntityMove
      );
      player.x = moved.x;
      player.y = moved.y;
      player.dir = moved.dir;
      player.moving = moved.moving;
      player.velocityX = moved.velocityX;
      player.velocityY = moved.velocityY;
      player.isBoosting = moved.isBoosting;
      player.boostEnergy = moved.boostEnergy;

      if (isDashing) {
        // Bulldozer sweep: anyone caught nearby gets knocked out to whichever
        // side of the dash line they're already on — NOT straight away from
        // the tank's current position, which for anything hit head-on is
        // roughly the same as the dash direction itself and just leaves it
        // in front of the tank to get run over again a tick later. At most
        // once per target per dash (DASH_DURATION_MS as the debounce window
        // guarantees that, since a single dash never lasts longer than that).
        // This side effect only touches OTHER entities, never this player's
        // own movement, so it stays server-only — no prediction needed.
        const dashDirX = Math.cos(player.dashAngle);
        const dashDirY = Math.sin(player.dashAngle);
        const perpX = -dashDirY;
        const perpY = dashDirX;
        const sideOf = (tx: number, ty: number) => {
          const side = (tx - player.x) * perpX + (ty - player.y) * perpY;
          return side >= 0 ? 1 : -1;
        };
        for (const other of ctx.players.values()) {
          if (other.id === player.id || !other.alive) continue;
          if (Math.hypot(other.x - player.x, other.y - player.y) >= DASH_KNOCKBACK_RADIUS) continue;
          const key = `${player.id}:${other.id}`;
          const lastHit = ctx.lastDashHitAt.get(key) ?? 0;
          if (now - lastHit < DASH_DURATION_MS) continue;
          ctx.lastDashHitAt.set(key, now);
          const sign = sideOf(other.x, other.y);
          const kx = other.x + perpX * sign * DASH_KNOCKBACK_DIST;
          const ky = other.y + perpY * sign * DASH_KNOCKBACK_DIST;
          if (!tankBlocked(map, kx, other.y)) other.x = kx;
          if (!tankBlocked(map, other.x, ky)) other.y = ky;
          ctx.impacts.push({ id: makeId(), x: other.x, y: other.y, kind: "shove" });
        }
        // Monsters are just as much "in the way" as another tank — bulldoze
        // them aside too, same debounce so a lingering dash doesn't machine-
        // gun the same monster with knockback every tick.
        for (const monster of ctx.monsters) {
          if (!monster.alive) continue;
          if (Math.hypot(monster.x - player.x, monster.y - player.y) >= DASH_KNOCKBACK_RADIUS) continue;
          const key = `${player.id}:monster:${monster.id}`;
          const lastHit = ctx.lastDashHitAt.get(key) ?? 0;
          if (now - lastHit < DASH_DURATION_MS) continue;
          ctx.lastDashHitAt.set(key, now);
          const sign = sideOf(monster.x, monster.y);
          const kx = monster.x + perpX * sign * DASH_KNOCKBACK_DIST;
          const ky = monster.y + perpY * sign * DASH_KNOCKBACK_DIST;
          if (!tankBlocked(map, kx, monster.y)) monster.x = kx;
          if (!tankBlocked(map, monster.x, ky)) monster.y = ky;
          ctx.impacts.push({ id: makeId(), x: monster.x, y: monster.y, kind: "shove" });
        }
      }
    }

    // Health/item pickups.
    for (let i = ctx.pickups.length - 1; i >= 0; i--) {
      const pickup = ctx.pickups[i];
      const dist = Math.hypot(player.x - pickup.x, player.y - pickup.y);
      if (dist >= TANK_SIZE / 2 + PICKUP_SIZE / 2) continue;
      if (pickup.kind === "health") {
        if (player.hp < MAX_HP) {
          player.hp = Math.min(MAX_HP, player.hp + PICKUP_HEAL_AMOUNT);
          ctx.pickups.splice(i, 1);
        }
      } else if (player.items.length < MAX_HELD_ITEMS && !player.items.includes(pickup.kind)) {
        // Reassigns rather than mutating in place — the per-tick delta diff
        // (diffPlayer in geometry.ts) keeps the last-broadcast player object
        // around to compare against; if this array were mutated in place
        // instead, that "previous" snapshot's `items` would be the exact
        // same array reference as the current one, so the diff would never
        // see a change. See tank-server.ts's handleUseItem for the same fix.
        player.items = [...player.items, pickup.kind];
        ctx.pickups.splice(i, 1);
      }
    }

    // Traps: only trigger against non-owners.
    for (let i = ctx.traps.length - 1; i >= 0; i--) {
      const trap = ctx.traps[i];
      if (trap.ownerId === player.id) continue;
      const dist = Math.hypot(player.x - trap.x, player.y - trap.y);
      if (dist < TANK_SIZE / 2 + TRAP_SIZE / 2) {
        ctx.traps.splice(i, 1);
        damagePlayer(ctx, player, TRAP_DAMAGE, trap.ownerId, "Bẫy");
        ctx.impacts.push({ id: makeId(), x: trap.x, y: trap.y, kind: "trap" });
      }
    }

    // Natural terrain hazards ('H' tiles) — ticked damage while standing on
    // one, whether the tank walked in itself or got shoved there.
    if (player.alive && tileAt(map, player.x, player.y) === "H") {
      const last = ctx.lastHazardDamageAt.get(player.id) ?? 0;
      if (now - last >= HAZARD_DAMAGE_INTERVAL_MS) {
        ctx.lastHazardDamageAt.set(player.id, now);
        damagePlayer(ctx, player, HAZARD_DAMAGE, null, "Chông");
      }
    }

    // Burning: ticked damage from a fire bullet until it lapses — unless
    // doused early by stepping into a monster nest's puddle.
    if (player.alive && player.burningUntil !== null) {
      const inPuddle = ctx.monsters.some((m) => Math.hypot(player.x - m.nestX, player.y - m.nestY) < NEST_PUDDLE_RADIUS);
      if (inPuddle) {
        player.burningUntil = null;
        player.burnOwnerId = null;
      } else if (now >= player.burningUntil) {
        player.burningUntil = null;
        player.burnOwnerId = null;
      } else {
        const last = ctx.lastBurnDamageAt.get(player.id) ?? 0;
        if (now - last >= BURN_TICK_INTERVAL_MS) {
          ctx.lastBurnDamageAt.set(player.id, now);
          damagePlayer(ctx, player, BURN_DAMAGE_PER_TICK, player.burnOwnerId, "Thiêu đốt");
        }
      }
    }
  }
}
