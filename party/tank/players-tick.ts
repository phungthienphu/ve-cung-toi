// Per-player per-tick resolution: respawn, ultimate regen, movement (with
// the tank/crate shove physics), pickup collection, trap triggers, and the
// two ticked damage-over-time sources (hazard tiles, burning).

import {
  BOOST_DRAIN_PER_TICK,
  BOOST_REGEN_PER_TICK,
  BOOST_SPEED_MULTIPLIER,
  BURN_DAMAGE_PER_TICK,
  BURN_TICK_INTERVAL_MS,
  HAZARD_DAMAGE,
  HAZARD_DAMAGE_INTERVAL_MS,
  MAX_BOOST_ENERGY,
  MAX_HELD_ITEMS,
  MAX_HP,
  NEST_PUDDLE_RADIUS,
  PICKUP_HEAL_AMOUNT,
  PICKUP_SIZE,
  SNIPER_MAX_CHARGE_MS,
  TANK_SIZE,
  TANK_SPEED,
  TRAP_DAMAGE,
  TRAP_SIZE,
  ULTIMATE_CONFIG,
  getSpawnPoints,
  skinForColor,
  type Bullet,
  type Crate,
  type Direction,
  type Monster,
  type Pickup,
  type TankMapDef,
  type TankPlayer,
  type Trap,
} from "../../shared/tankTypes";
import { type CombatCtx, damagePlayer } from "./combat";
import { DIR_VECTOR, findOverlappingCrate, findOverlappingTank, makeId, spawnPixel, tankBlocked, tileAt, tryPushCrate, tryPushTank, winsShovingContest } from "./geometry";
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
}

export function stepPlayers(ctx: PlayersTickCtx, map: TankMapDef, now: number) {
  for (const player of ctx.players.values()) {
    if (!player.alive) {
      if (player.respawnAt !== null && now >= player.respawnAt) {
        const idx = [...ctx.players.values()].indexOf(player);
        const spawns = getSpawnPoints(map);
        const spawnPoint = ctx.mode === "team" ? spawns[(player.team === "A" ? 0 : 4) + (idx % 4)] : spawns[idx % spawns.length];
        const spawn = spawnPixel(spawnPoint);
        player.x = spawn.x;
        player.y = spawn.y;
        player.alive = true;
        player.hp = MAX_HP;
        player.respawnAt = null;
        player.blindedUntil = null;
        player.boostEnergy = MAX_BOOST_ENERGY;
        player.isBoosting = false;
        player.shieldHitsLeft = 0;
        player.fireShotsLeft = 0;
        player.burningUntil = null;
        player.burnOwnerId = null;
        resetSkillState(player);
      }
      continue;
    }
    const ultimateConfig = ULTIMATE_CONFIG[skinForColor(player.color)];
    player.ultimateEnergy = Math.min(ultimateConfig.maxEnergy, player.ultimateEnergy + ultimateConfig.regenPerTick);
    if (player.rapidFireUntil !== null && now >= player.rapidFireUntil) {
      player.rapidFireUntil = null;
    }
    if (player.sniperChargingSince !== null && now - player.sniperChargingSince >= SNIPER_MAX_CHARGE_MS) {
      fireSniperShot(ctx, player);
    }

    const input = ctx.inputs.get(player.id);
    if (!input) {
      player.moving = false;
      player.boostEnergy = Math.min(MAX_BOOST_ENERGY, player.boostEnergy + BOOST_REGEN_PER_TICK);
      player.isBoosting = false;
    } else {
      let dir: Direction | null = null;
      if (input.up) dir = "up";
      else if (input.down) dir = "down";
      else if (input.left) dir = "left";
      else if (input.right) dir = "right";

      const isShielded = player.shieldHitsLeft > 0;
      player.moving = dir !== null && !isShielded;
      // The shield is a "turtle" tool — it holds position entirely while
      // active. You can still turn to face/shoot, just not relocate.
      const wantsBoost = dir !== null && input.boost && player.boostEnergy > 0 && !isShielded;
      if (dir) {
        player.dir = dir;
      }
      if (dir && !isShielded) {
        const speed = wantsBoost ? TANK_SPEED * BOOST_SPEED_MULTIPLIER : TANK_SPEED;
        const v = DIR_VECTOR[dir];
        const nx = player.x + v.dx * speed;
        const ny = player.y + v.dy * speed;

        if (!tankBlocked(map, nx, player.y)) {
          const blocker = findOverlappingTank(ctx.players.values(), new Set([player.id]), nx, player.y);
          const crateBlocker = !blocker ? findOverlappingCrate(ctx.crates, nx, player.y) : null;
          if (!blocker && !crateBlocker) {
            player.x = nx;
          } else if (blocker && winsShovingContest(player, wantsBoost, blocker)) {
            const impactX = blocker.x;
            const impactY = blocker.y;
            if (tryPushTank(blocker, v.dx * speed, v.dy * speed, map, ctx.players, player.id)) {
              player.x = nx;
              ctx.impacts.push({ id: makeId(), x: impactX, y: impactY, kind: "shove" });
            }
          } else if (crateBlocker) {
            const impactX = crateBlocker.x;
            const impactY = crateBlocker.y;
            if (tryPushCrate(crateBlocker, v.dx * speed, v.dy * speed, map, ctx.crates, ctx.players)) {
              player.x = nx;
              ctx.impacts.push({ id: makeId(), x: impactX, y: impactY, kind: "shove" });
            }
          }
        }
        if (!tankBlocked(map, player.x, ny)) {
          const blocker = findOverlappingTank(ctx.players.values(), new Set([player.id]), player.x, ny);
          const crateBlocker = !blocker ? findOverlappingCrate(ctx.crates, player.x, ny) : null;
          if (!blocker && !crateBlocker) {
            player.y = ny;
          } else if (blocker && winsShovingContest(player, wantsBoost, blocker)) {
            const impactX = blocker.x;
            const impactY = blocker.y;
            if (tryPushTank(blocker, v.dx * speed, v.dy * speed, map, ctx.players, player.id)) {
              player.y = ny;
              ctx.impacts.push({ id: makeId(), x: impactX, y: impactY, kind: "shove" });
            }
          } else if (crateBlocker) {
            const impactX = crateBlocker.x;
            const impactY = crateBlocker.y;
            if (tryPushCrate(crateBlocker, v.dx * speed, v.dy * speed, map, ctx.crates, ctx.players)) {
              player.y = ny;
              ctx.impacts.push({ id: makeId(), x: impactX, y: impactY, kind: "shove" });
            }
          }
        }
      }
      if (wantsBoost) {
        player.boostEnergy = Math.max(0, player.boostEnergy - BOOST_DRAIN_PER_TICK);
        player.isBoosting = true;
      } else {
        player.boostEnergy = Math.min(MAX_BOOST_ENERGY, player.boostEnergy + BOOST_REGEN_PER_TICK);
        player.isBoosting = false;
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
        player.items.push(pickup.kind);
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
        damagePlayer(ctx, player, TRAP_DAMAGE, trap.ownerId);
        ctx.impacts.push({ id: makeId(), x: trap.x, y: trap.y, kind: "trap" });
      }
    }

    // Natural terrain hazards ('H' tiles) — ticked damage while standing on
    // one, whether the tank walked in itself or got shoved there.
    if (player.alive && tileAt(map, player.x, player.y) === "H") {
      const last = ctx.lastHazardDamageAt.get(player.id) ?? 0;
      if (now - last >= HAZARD_DAMAGE_INTERVAL_MS) {
        ctx.lastHazardDamageAt.set(player.id, now);
        damagePlayer(ctx, player, HAZARD_DAMAGE, null);
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
          damagePlayer(ctx, player, BURN_DAMAGE_PER_TICK, player.burnOwnerId);
        }
      }
    }
  }
}
