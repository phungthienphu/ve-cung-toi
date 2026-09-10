// Red's ultimate: a player-aimed artillery barrage. Committing (see
// skills.ts's throwRedBomb) scatters a handful of AirstrikeBomb-shaped
// impacts around the target point, staggered across RED_BARRAGE_DURATION_MS
// after RED_BARRAGE_WARN_MS — this file just owns the resulting hazard's
// shape and its per-tick resolution, mirroring how airstrike.ts owns the
// automatic airstrike hazard.

import {
  RED_BARRAGE_BOMB_COUNT,
  RED_BARRAGE_BOMB_DAMAGE,
  RED_BARRAGE_BOMB_RADIUS,
  RED_BARRAGE_DURATION_MS,
  RED_BARRAGE_SPREAD_RADIUS,
  RED_BARRAGE_WARN_MS,
  type RedBarrage,
} from "../../shared/tankTypes";
import { type BombFieldCtx, resolveBombs } from "./bombs";
import { makeId } from "./geometry";

export function createRedBarrage(ownerId: string, targetX: number, targetY: number, now: number): RedBarrage {
  const bombs = [];
  for (let i = 0; i < RED_BARRAGE_BOMB_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * RED_BARRAGE_SPREAD_RADIUS;
    bombs.push({
      x: targetX + Math.cos(angle) * dist,
      y: targetY + Math.sin(angle) * dist,
      strikeAt: now + RED_BARRAGE_WARN_MS + Math.random() * RED_BARRAGE_DURATION_MS,
      radius: RED_BARRAGE_BOMB_RADIUS,
    });
  }
  return { id: makeId(), ownerId, bombs };
}

export interface RedBarrageTickCtx extends BombFieldCtx {
  redBarrages: RedBarrage[];
}

/** Resolves any of each barrage's bombs whose timer has elapsed, crediting
 * the throwing player as the killer, and drops any barrage once every one
 * of its bombs has gone off. */
export function stepRedBarrages(ctx: RedBarrageTickCtx, now: number) {
  for (const barrage of ctx.redBarrages) {
    barrage.bombs = resolveBombs(ctx, barrage.bombs, RED_BARRAGE_BOMB_DAMAGE, barrage.ownerId, "Pháo kích", now);
  }
  ctx.redBarrages = ctx.redBarrages.filter((b) => b.bombs.length > 0);
}
