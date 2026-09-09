// The carpet-bombing hazard: picking a target + flight line, and resolving
// bombs as they land. Grass-terrain maps only (see tank-server.ts's tick) —
// the desert map is reserved for a future train hazard instead.

import {
  AIRSTRIKE_AIM_MAX_TILES,
  AIRSTRIKE_AIM_MIN_TILES,
  AIRSTRIKE_FLIGHT_MS,
  AIRSTRIKE_MAX_INTERVAL_MS,
  AIRSTRIKE_MIN_INTERVAL_MS,
  AIRSTRIKE_RAMP_MS,
  AIRSTRIKE_WARN_MS,
  BOMB_DAMAGE,
  BOMB_RADIUS,
  BOMB_RADIUS_MAX,
  TILE_SIZE,
  mapCols,
  mapRows,
  type Airstrike,
  type TankMapDef,
  type TankPlayer,
} from "../../shared/tankTypes";
import { type BombFieldCtx, resolveBombs } from "./bombs";
import { makeId, spawnPixel } from "./geometry";

export function randomAirstrikeDelay(): number {
  return AIRSTRIKE_MIN_INTERVAL_MS + Math.random() * (AIRSTRIKE_MAX_INTERVAL_MS - AIRSTRIKE_MIN_INTERVAL_MS);
}

/** Picks a 3x3 target patch and a straight bomber flight line through it.
 * The plane's from/to points and timestamps are precomputed so the client
 * can place it purely by lerping — no per-frame server chatter.
 *
 * Both the aim and the blast radius ramp up over `AIRSTRIKE_RAMP_MS` of
 * wall-clock match time: early strikes land almost anywhere and hit a
 * modest area, late strikes are aimed tightly around a random live player
 * and hit a much bigger area — otherwise a razor-precise, huge-radius bomb
 * from the very first strike would just feel like unavoidable bad luck. */
export function spawnAirstrike(map: TankMapDef, players: Map<string, TankPlayer>, matchStartAt: number | null, now: number): Airstrike | null {
  const cols = mapCols(map);
  const rows = mapRows(map);
  if (cols < 7 || rows < 7) return null;

  const ramp = matchStartAt === null ? 0 : Math.max(0, Math.min(1, (now - matchStartAt) / AIRSTRIKE_RAMP_MS));
  const aimTiles = AIRSTRIKE_AIM_MAX_TILES - (AIRSTRIKE_AIM_MAX_TILES - AIRSTRIKE_AIM_MIN_TILES) * ramp;
  const radius = BOMB_RADIUS + (BOMB_RADIUS_MAX - BOMB_RADIUS) * ramp;
  const targets = [...players.values()].filter((p) => p.connected && p.alive);
  const target = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)] : null;

  let centerCol = -1;
  let centerRow = -1;
  for (let attempt = 0; attempt < 20; attempt++) {
    let c: number;
    let r: number;
    if (target) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * aimTiles;
      c = Math.round(target.x / TILE_SIZE + Math.cos(angle) * dist);
      r = Math.round(target.y / TILE_SIZE + Math.sin(angle) * dist);
    } else {
      c = 2 + Math.floor(Math.random() * (cols - 4));
      r = 2 + Math.floor(Math.random() * (rows - 4));
    }
    c = Math.max(2, Math.min(cols - 3, c));
    r = Math.max(2, Math.min(rows - 3, r));
    const tile = map.layout[r]?.[c];
    if (tile === "." || tile === "R") {
      centerCol = c;
      centerRow = r;
      break;
    }
  }
  if (centerCol < 0) return null;

  const strikeAt = now + AIRSTRIKE_WARN_MS;
  const bombs = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const pos = spawnPixel({ x: centerCol + dc, y: centerRow + dr });
      bombs.push({ x: pos.x, y: pos.y, strikeAt, radius });
    }
  }

  // Flight is always axis-aligned (matches the plane sprite's rotation
  // convention) — pick horizontal vs. vertical and a random direction,
  // then place the plane so it's exactly over the target at `strikeAt`
  // and keeps flying an equal "lead" distance beyond before despawning.
  // Kept deliberately slow (px/ms) — a fast blur read as a glitch, not a
  // bomber making a run.
  const planeSpeed = 0.24; // px/ms
  const horizontal = Math.random() < 0.5;
  const forward = Math.random() < 0.5;
  const ux = horizontal ? (forward ? 1 : -1) : 0;
  const uy = horizontal ? 0 : forward ? 1 : -1;
  const center = spawnPixel({ x: centerCol, y: centerRow });
  const leadDist = planeSpeed * AIRSTRIKE_WARN_MS;
  const tailDist = planeSpeed * (AIRSTRIKE_FLIGHT_MS - AIRSTRIKE_WARN_MS);

  return {
    id: makeId(),
    bombs,
    warnAt: now,
    strikeAt,
    planeFromX: center.x - ux * leadDist,
    planeFromY: center.y - uy * leadDist,
    planeToX: center.x + ux * tailDist,
    planeToY: center.y + uy * tailDist,
    planeDepartAt: now,
    planeArriveAt: now + AIRSTRIKE_FLIGHT_MS,
  };
}

export interface AirstrikeTickCtx extends BombFieldCtx {
  airstrikes: Airstrike[];
  nextAirstrikeAt: number | null;
  matchStartAt: number | null;
}

/** Spawns a new strike if one is due, then resolves any bombs whose timer
 * has elapsed (damage + crate destruction + a one-shot "bomb" impact for the
 * client to play an explosion at), and prunes strikes whose plane has fully
 * flown off-screen. Only called for grass-terrain maps. */
export function stepAirstrikes(ctx: AirstrikeTickCtx, map: TankMapDef, now: number) {
  if (ctx.nextAirstrikeAt !== null && now >= ctx.nextAirstrikeAt) {
    const strike = spawnAirstrike(map, ctx.players, ctx.matchStartAt, now);
    if (strike) ctx.airstrikes.push(strike);
    ctx.nextAirstrikeAt = now + randomAirstrikeDelay();
  }
  for (const strike of ctx.airstrikes) {
    strike.bombs = resolveBombs(ctx, strike.bombs, BOMB_DAMAGE, null, now);
  }
  ctx.airstrikes = ctx.airstrikes.filter((s) => now < s.planeArriveAt);
}
