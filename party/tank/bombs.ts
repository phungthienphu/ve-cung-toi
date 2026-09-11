// Shared "delayed area bomb" resolution: any hazard/skill that's really just
// a list of {x, y, strikeAt, radius} entries waiting to go off uses this —
// currently the automatic airstrike and Red's barrage. Keeping it here means
// a third bomb-dropping mechanic later reuses the exact same damage/crate/
// impact behavior instead of re-deriving it.

import { findOverlappingCrate, makeId, randomPickupKind } from "./geometry";
import { damagePlayer, type CombatCtx } from "./combat";
import { MONSTER_DROP_WEIGHTS, MONSTER_RESPAWN_DELAY_MS, type AirstrikeBomb, type Crate, type DamageCause, type Monster, type Pickup } from "../../shared/tankTypes";

export interface BombFieldCtx extends CombatCtx {
  crates: Crate[];
  monsters: Monster[];
  pickups: Pickup[];
}

/** Resolves whichever of `bombs` have hit their `strikeAt`: damages any
 * overlapping player (crediting `ownerId`, or environmental if null), kills
 * an overlapping monster outright (its HP pool is tiny — a bomb blast isn't
 * something worth partial-damaging it for), destroys an overlapping crate,
 * and pushes a one-shot "bomb" impact for the client to play an explosion
 * at. Returns the bombs that haven't landed yet — callers should write that
 * back onto whatever list they came from. */
export function resolveBombs(
  ctx: BombFieldCtx,
  bombs: AirstrikeBomb[],
  damage: number,
  ownerId: string | null,
  cause: DamageCause,
  now: number
): AirstrikeBomb[] {
  const landed = bombs.filter((b) => now >= b.strikeAt);
  if (landed.length === 0) return bombs;
  for (const bomb of landed) {
    for (const player of ctx.players.values()) {
      if (!player.alive) continue;
      if (Math.hypot(player.x - bomb.x, player.y - bomb.y) < bomb.radius) {
        damagePlayer(ctx, player, damage, ownerId, cause);
      }
    }
    for (const monster of ctx.monsters) {
      if (!monster.alive) continue;
      if (Math.hypot(monster.x - bomb.x, monster.y - bomb.y) < bomb.radius) {
        monster.alive = false;
        monster.respawnAt = now + MONSTER_RESPAWN_DELAY_MS;
        monster.aggroPlayerId = null;
        ctx.pickups.push({ id: makeId(), x: monster.x, y: monster.y, kind: randomPickupKind(MONSTER_DROP_WEIGHTS) });
      }
    }
    const hitCrate = findOverlappingCrate(ctx.crates, bomb.x, bomb.y);
    if (hitCrate) ctx.crates = ctx.crates.filter((c) => c.id !== hitCrate.id);
    ctx.impacts.push({ id: makeId(), x: bomb.x, y: bomb.y, kind: "bomb", radius: bomb.radius });
  }
  return bombs.filter((b) => now < b.strikeAt);
}
