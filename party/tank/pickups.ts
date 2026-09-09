import { MAX_PICKUPS, PICKUP_SPAWN_INTERVAL_MS, type Pickup, type TankMapDef } from "../../shared/tankTypes";
import { makeId, randomOpenTile, randomPickupKind, spawnPixel } from "./geometry";

export interface PickupSpawnCtx {
  pickups: Pickup[];
  lastPickupSpawnAt: number;
}

/** Drops a new health/item pickup on a random open tile, at most one per
 * `PICKUP_SPAWN_INTERVAL_MS` and never past `MAX_PICKUPS` on the ground at
 * once. Returns the timestamp to store back on `lastPickupSpawnAt` (the ctx
 * itself isn't mutated for that field since it's a primitive read from the
 * room instance, not a reference). */
export function maybeSpawnPickup(ctx: PickupSpawnCtx, map: TankMapDef, now: number): number {
  if (ctx.pickups.length >= MAX_PICKUPS) return ctx.lastPickupSpawnAt;
  if (now - ctx.lastPickupSpawnAt < PICKUP_SPAWN_INTERVAL_MS) return ctx.lastPickupSpawnAt;
  const tile = randomOpenTile(map);
  if (!tile) return ctx.lastPickupSpawnAt;
  const px = spawnPixel(tile);
  ctx.pickups.push({ id: makeId(), x: px.x, y: px.y, kind: randomPickupKind() });
  return now;
}
