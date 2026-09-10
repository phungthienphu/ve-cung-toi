// Green's ultimate: GREEN_BURST_VOLLEYS rings of bullets radiating outward
// from the tank, GREEN_BURST_INTERVAL_MS apart. Each volley reads the
// owner's live position at the moment it fires, so it still looks right
// even if the tank keeps moving between volleys — nothing here locks
// movement, unlike Sand/Huge/bigRed's ultimates.

import { BULLET_SPEED, GREEN_BURST_BULLET_COUNT, GREEN_BURST_INTERVAL_MS, type Bullet, type TankPlayer } from "../../shared/tankTypes";
import { makeId } from "./geometry";

export interface PendingGreenBurst {
  id: string;
  ownerId: string;
  volleysRemaining: number;
  nextFireAt: number;
}

export interface GreenBurstFieldCtx {
  players: Map<string, TankPlayer>;
  bullets: Bullet[];
}

/** One ring of GREEN_BURST_BULLET_COUNT plain bullets spaced evenly around a
 * full circle, spawned at the owner's current position. */
export function fireGreenVolley(ctx: GreenBurstFieldCtx, owner: TankPlayer) {
  for (let i = 0; i < GREEN_BURST_BULLET_COUNT; i++) {
    const angle = (i / GREEN_BURST_BULLET_COUNT) * Math.PI * 2;
    ctx.bullets.push({
      id: makeId(),
      ownerId: owner.id,
      x: owner.x,
      y: owner.y,
      angle,
      kind: "normal",
      cause: "Đạn thường",
      speed: BULLET_SPEED,
    });
  }
}

/** Fires the next scheduled volley for any burst whose timer has elapsed,
 * returning whatever's still pending. Called once per tick, same shape as
 * stepHooks/stepRedBarrages. */
export function stepGreenBursts(ctx: GreenBurstFieldCtx, pending: PendingGreenBurst[], now: number): PendingGreenBurst[] {
  const remaining: PendingGreenBurst[] = [];
  for (const burst of pending) {
    if (now < burst.nextFireAt) {
      remaining.push(burst);
      continue;
    }
    const owner = ctx.players.get(burst.ownerId);
    if (!owner || !owner.alive) continue; // owner died mid-sequence — drop the rest of the burst entirely, don't let it "wake up" if they respawn
    fireGreenVolley(ctx, owner);
    if (burst.volleysRemaining > 1) {
      remaining.push({ ...burst, volleysRemaining: burst.volleysRemaining - 1, nextFireAt: now + GREEN_BURST_INTERVAL_MS });
    }
  }
  return remaining;
}
