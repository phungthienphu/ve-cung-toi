// Forest monster spawning + AI: passive wanderers tied to their own nest
// (spawn spot), which only give chase after a tank collides with or shoots
// them, and give up — back to wandering near the nest — once the target
// escapes the leash range, dies, or the aggro timer lapses unrefreshed.

import {
  MONSTER_AGGRO_TIMEOUT_MS,
  MONSTER_CHASE_LEASH_RADIUS,
  MONSTER_CHASE_SPEED_MULTIPLIER,
  MONSTER_CONTACT_COOLDOWN_MS,
  MONSTER_DAMAGE,
  MONSTER_DIR_CHANGE_MS,
  MONSTER_HEAL_INTERVAL_MS,
  MONSTER_HP,
  MONSTER_NEST_RADIUS,
  MONSTER_REST_CHANCE,
  MONSTER_REST_DURATION_MS,
  MONSTER_SIZE,
  MONSTER_SPEED,
  NEST_PUDDLE_RADIUS,
  TANK_SIZE,
  type Direction,
  type Monster,
  type TankMapDef,
} from "../../shared/tankTypes";
import { type CombatCtx, damageThroughShield } from "./combat";
import { DIR_VECTOR, makeId, randomOpenTile, spawnPixel, tankBlocked, tileAt } from "./geometry";

export function spawnMonster(map: TankMapDef): Monster {
  const tile = randomOpenTile(map);
  const pos = spawnPixel(tile ?? { x: 1, y: 1 });
  const dirs: Direction[] = ["up", "down", "left", "right"];
  return {
    id: makeId(),
    x: pos.x,
    y: pos.y,
    dir: dirs[Math.floor(Math.random() * dirs.length)],
    alive: true,
    hp: MONSTER_HP,
    respawnAt: null,
    nestX: pos.x,
    nestY: pos.y,
    aggroPlayerId: null,
  };
}

export interface MonstersTickCtx extends CombatCtx {
  monsters: Monster[];
  lastMonsterDirChangeAt: Map<string, number>;
  lastMonsterContactAt: Map<string, number>;
  lastMonsterHealAt: Map<string, number>;
  monsterAggroUntil: Map<string, number>;
  monsterRestUntil: Map<string, number>;
}

export function stepMonsters(ctx: MonstersTickCtx, map: TankMapDef, now: number) {
  for (const monster of ctx.monsters) {
    if (!monster.alive) {
      if (monster.respawnAt !== null && now >= monster.respawnAt) {
        // Respawns at its own nest, not a fresh random spot — the nest is
        // a fixed lair for the whole match (marked on the ground for players).
        monster.x = monster.nestX;
        monster.y = monster.nestY;
        monster.alive = true;
        monster.hp = MONSTER_HP;
        monster.respawnAt = null;
        monster.aggroPlayerId = null;
        ctx.monsterAggroUntil.delete(monster.id);
        ctx.monsterRestUntil.delete(monster.id);
      }
      continue;
    }

    if (monster.aggroPlayerId) {
      const target = ctx.players.get(monster.aggroPlayerId);
      const aggroUntil = ctx.monsterAggroUntil.get(monster.id) ?? 0;
      const targetGone = !target || !target.alive || !target.connected;
      const tooFar = !targetGone && target ? Math.hypot(target.x - monster.nestX, target.y - monster.nestY) > MONSTER_CHASE_LEASH_RADIUS : true;
      if (targetGone || tooFar || now >= aggroUntil) {
        monster.aggroPlayerId = null;
        ctx.monsterAggroUntil.delete(monster.id);
      }
    }

    let dir: Direction | null;
    const speed = monster.aggroPlayerId ? MONSTER_SPEED * MONSTER_CHASE_SPEED_MULTIPLIER : MONSTER_SPEED;
    if (monster.aggroPlayerId) {
      const target = ctx.players.get(monster.aggroPlayerId)!;
      const dx = target.x - monster.x;
      const dy = target.y - monster.y;
      dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    } else {
      // Passive wandering alternates between short walks and standing
      // around at the nest — it doesn't just run in circles forever.
      const restUntil = ctx.monsterRestUntil.get(monster.id) ?? 0;
      if (now >= restUntil) {
        const lastChange = ctx.lastMonsterDirChangeAt.get(monster.id) ?? 0;
        if (now - lastChange >= MONSTER_DIR_CHANGE_MS) {
          ctx.lastMonsterDirChangeAt.set(monster.id, now);
          const strayedFromNest = Math.hypot(monster.x - monster.nestX, monster.y - monster.nestY) > MONSTER_NEST_RADIUS;
          if (strayedFromNest) {
            const dx = monster.nestX - monster.x;
            const dy = monster.nestY - monster.y;
            monster.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
          } else if (Math.random() < MONSTER_REST_CHANCE) {
            ctx.monsterRestUntil.set(monster.id, now + MONSTER_REST_DURATION_MS);
          } else {
            const dirs: Direction[] = ["up", "down", "left", "right"];
            monster.dir = dirs[Math.floor(Math.random() * dirs.length)];
          }
        }
      }
      dir = now < (ctx.monsterRestUntil.get(monster.id) ?? 0) ? null : monster.dir;
    }

    if (dir) {
      monster.dir = dir;
      const v = DIR_VECTOR[dir];
      const nx = monster.x + v.dx * speed;
      const ny = monster.y + v.dy * speed;
      let blockedAxis = false;
      if (!tankBlocked(map, nx, monster.y)) monster.x = nx;
      else blockedAxis = true;
      if (!tankBlocked(map, monster.x, ny)) monster.y = ny;
      else blockedAxis = true;
      if (blockedAxis && !monster.aggroPlayerId) ctx.lastMonsterDirChangeAt.set(monster.id, 0); // bounced off a wall — pick a new direction next tick
    }

    for (const player of ctx.players.values()) {
      if (!player.alive) continue;
      const dist = Math.hypot(player.x - monster.x, player.y - monster.y);
      if (dist >= TANK_SIZE / 2 + MONSTER_SIZE / 2) continue;
      const key = `${player.id}:${monster.id}`;
      const last = ctx.lastMonsterContactAt.get(key) ?? 0;
      if (now - last >= MONSTER_CONTACT_COOLDOWN_MS) {
        ctx.lastMonsterContactAt.set(key, now);
        damageThroughShield(ctx, player, MONSTER_DAMAGE, null);
        monster.aggroPlayerId = player.id;
        ctx.monsterAggroUntil.set(monster.id, now + MONSTER_AGGRO_TIMEOUT_MS);
      }
    }

    // Resting in its own puddle or hiding in any bush slowly heals a
    // monster back up — whole-HP steps on an interval, since MONSTER_HP is
    // too small for a per-tick fractional regen to read as anything.
    if (monster.hp < MONSTER_HP) {
      const inNest = Math.hypot(monster.x - monster.nestX, monster.y - monster.nestY) < NEST_PUDDLE_RADIUS;
      const inBush = tileAt(map, monster.x, monster.y) === "B";
      if (inNest || inBush) {
        const lastHeal = ctx.lastMonsterHealAt.get(monster.id) ?? 0;
        if (now - lastHeal >= MONSTER_HEAL_INTERVAL_MS) {
          ctx.lastMonsterHealAt.set(monster.id, now);
          monster.hp = Math.min(MONSTER_HP, monster.hp + 1);
        }
      }
    }
  }
}
