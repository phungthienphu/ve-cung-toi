// Bullet advancement + collision resolution: walls, crates, tanks, and
// (unless it's a blind round) monsters. Rewrites `ctx.bullets` in place to
// just the survivors, same as the original inline tick logic did.

import {
  BULLET_SPEED,
  CRATE_SIZE,
  MONSTER_AGGRO_TIMEOUT_MS,
  MONSTER_RESPAWN_DELAY_MS,
  MONSTER_SIZE,
  TANK_SIZE,
  ULTIMATE_DAMAGE_MULTIPLIER,
  type Bullet,
  type Crate,
  type Monster,
  type Pickup,
  type TankMapDef,
} from "../../shared/tankTypes";
import { applyHit, type CombatCtx } from "./combat";
import { makeId, tileAt } from "./geometry";

export interface BulletsTickCtx extends CombatCtx {
  bullets: Bullet[];
  crates: Crate[];
  monsters: Monster[];
  pickups: Pickup[];
  monsterAggroUntil: Map<string, number>;
}

export function stepBullets(ctx: BulletsTickCtx, map: TankMapDef, now: number) {
  const survivors: Bullet[] = [];
  for (const bullet of ctx.bullets) {
    bullet.x += Math.cos(bullet.angle) * BULLET_SPEED;
    bullet.y += Math.sin(bullet.angle) * BULLET_SPEED;

    if (tileAt(map, bullet.x, bullet.y) === "#") continue; // hit a wall

    const hitCrate = ctx.crates.find((c) => Math.hypot(bullet.x - c.x, bullet.y - c.y) < CRATE_SIZE / 2);
    if (hitCrate) {
      hitCrate.hp -= 1;
      if (hitCrate.hp <= 0) {
        ctx.crates = ctx.crates.filter((c) => c.id !== hitCrate.id);
      }
      ctx.impacts.push({ id: makeId(), x: hitCrate.x, y: hitCrate.y, kind: "crate" });
      continue;
    }

    let hit = false;
    for (const target of ctx.players.values()) {
      if (!target.alive || target.id === bullet.ownerId) continue;
      const dx = target.x - bullet.x;
      const dy = target.y - bullet.y;
      if (Math.hypot(dx, dy) < TANK_SIZE / 2) {
        hit = true;
        applyHit(ctx, target, bullet.kind, bullet.ownerId);
        break;
      }
    }
    if (!hit && bullet.kind !== "blind") {
      for (const monster of ctx.monsters) {
        if (!monster.alive) continue;
        const dx = monster.x - bullet.x;
        const dy = monster.y - bullet.y;
        if (Math.hypot(dx, dy) < MONSTER_SIZE / 2) {
          hit = true;
          monster.hp -= bullet.kind === "big" ? ULTIMATE_DAMAGE_MULTIPLIER : 1;
          if (monster.hp <= 0) {
            monster.alive = false;
            monster.respawnAt = now + MONSTER_RESPAWN_DELAY_MS;
            monster.aggroPlayerId = null;
            ctx.monsterAggroUntil.delete(monster.id);
            ctx.pickups.push({ id: makeId(), x: monster.x, y: monster.y, kind: "shield" });
          } else {
            monster.aggroPlayerId = bullet.ownerId;
            ctx.monsterAggroUntil.set(monster.id, now + MONSTER_AGGRO_TIMEOUT_MS);
          }
          break;
        }
      }
    }
    if (!hit) survivors.push(bullet);
  }
  ctx.bullets = survivors;
}
