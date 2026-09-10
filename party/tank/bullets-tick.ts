// Bullet advancement + collision resolution: walls, crates, tanks, and
// (unless it's a blind round) monsters. Rewrites `ctx.bullets` in place to
// just the survivors, same as the original inline tick logic did.

import {
  CRATE_SIZE,
  DAMAGE_CAUSES,
  MAX_BULLETS_TOTAL,
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
  // Safety net on top of per-player range/magazine limits — if bullets from
  // several sources still pile up past this, drop the oldest ones (front of
  // the array, since bullets are always appended) rather than let one tick's
  // broadcast keep growing unbounded.
  if (ctx.bullets.length > MAX_BULLETS_TOTAL) {
    ctx.bullets = ctx.bullets.slice(ctx.bullets.length - MAX_BULLETS_TOTAL);
  }
  const survivors: Bullet[] = [];
  for (const bullet of ctx.bullets) {
    bullet.x += Math.cos(bullet.angle) * bullet.speed;
    bullet.y += Math.sin(bullet.angle) * bullet.speed;

    bullet.ticksLeft -= 1;
    if (bullet.ticksLeft <= 0) continue; // out of range — same "just vanishes" path as hitting a wall

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
        applyHit(ctx, target, bullet.kind, bullet.ownerId, DAMAGE_CAUSES[bullet.causeCode]);
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
