// The tank movement step, shared verbatim between the server (the real
// simulation, in party/tank/players-tick.ts) and the client (local
// prediction of the player's own tank, in src/components/tank/predictSelf.ts)
// — see stepSelfMovement's doc for why this needs to be one piece of code
// instead of two hand-written copies.

import {
  BOOST_DRAIN_PER_TICK,
  BOOST_REGEN_PER_TICK,
  BOOST_SPEED_MULTIPLIER,
  DASH_SPEED,
  ICE_ACCELERATION,
  ICE_FRICTION,
  ICE_STOP_SPEED,
  MAX_BOOST_ENERGY,
  TANK_SIZE,
  TANK_SPEED,
  TILE_SIZE,
  mapCols,
  mapRows,
  type Direction,
  type TankMapDef,
} from "./tankTypes";

export function tileAt(map: TankMapDef, px: number, py: number): string {
  const col = Math.floor(px / TILE_SIZE);
  const row = Math.floor(py / TILE_SIZE);
  if (row < 0 || row >= mapRows(map) || col < 0 || col >= mapCols(map)) return "#";
  return map.layout[row][col] ?? "#";
}

export function tankBlocked(map: TankMapDef, x: number, y: number): boolean {
  const half = TANK_SIZE / 2;
  return (
    tileAt(map, x - half, y - half) === "#" ||
    tileAt(map, x + half, y - half) === "#" ||
    tileAt(map, x - half, y + half) === "#" ||
    tileAt(map, x + half, y + half) === "#"
  );
}

export const DIR_VECTOR: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export interface SelfMovementState {
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
  velocityX: number;
  velocityY: number;
  isBoosting: boolean;
  boostEnergy: number;
}

export interface SelfMovementInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
}

export interface SelfMovementFlags {
  isShielded: boolean;
  isStunned: boolean;
  dashUntil: number | null;
  dashAngle: number;
}

/** Resolves whether a move to (nx, ny) — already known to clear the wall
 * check — also clears whatever else occupies that spot, applying any
 * side effect (shoving a tank/crate) as a side effect. The server's version
 * checks/pushes real tanks and crates; the client's prediction just returns
 * true unconditionally (it only has a stale view of other entities, so it
 * doesn't attempt to predict this kind of collision — see the doc on
 * PredictedSelf). Not consulted at all while dashing, which always passes
 * straight through other tanks/crates. */
export type TryEntityMove = (nx: number, ny: number, dx: number, dy: number, wantsBoost: boolean) => boolean;

/**
 * One tick of movement for a single tank, covering every self-contained case
 * — i.e. every case whose outcome depends only on the tank's own state, its
 * own input, and the (static) map, never on another entity's live position.
 * That set is: plain directional movement, boost, ice acceleration/friction,
 * and a dash's forced slide. It deliberately excludes being shoved by
 * another tank (via TryEntityMove, injected instead of hardcoded) and the
 * hook-pull eased yank (handled separately in players-tick.ts, since it
 * needs fields — hookPullFrom/To — that are stripped from what the client
 * ever receives; see PublicTankPlayer).
 *
 * This exists as ONE function, not a server copy plus a hand-written client
 * copy, specifically so the two can never quietly drift apart (different
 * tuning constant changed on one side, a bug fixed in only one file, ...).
 * The server calls it with a TryEntityMove that actually resolves shoves;
 * the client calls it with one that always succeeds, to predict its own
 * tank's movement ahead of the server's next confirmation. See
 * src/components/tank/predictSelf.ts for the client side and
 * party/tank/players-tick.ts for the server side.
 */
export function stepSelfMovement(
  state: SelfMovementState,
  input: SelfMovementInput | undefined,
  flags: SelfMovementFlags,
  map: TankMapDef,
  tryEntityMove: TryEntityMove
): SelfMovementState {
  const next: SelfMovementState = { ...state };

  if (flags.dashUntil !== null) {
    // Forced movement along the locked-in dash angle — normal input is
    // ignored entirely for the duration. A dash passes straight through
    // other tanks/crates (not blocked by them) but still can't cross a wall.
    const dx = Math.cos(flags.dashAngle) * DASH_SPEED;
    const dy = Math.sin(flags.dashAngle) * DASH_SPEED;
    const nx = next.x + dx;
    const ny = next.y + dy;
    if (!tankBlocked(map, nx, next.y)) next.x = nx;
    if (!tankBlocked(map, next.x, ny)) next.y = ny;
    next.moving = true;
    next.velocityX = 0;
    next.velocityY = 0;
    next.isBoosting = false;
    next.boostEnergy = Math.min(MAX_BOOST_ENERGY, next.boostEnergy + BOOST_REGEN_PER_TICK);
    return next;
  }

  let dir: Direction | null = null;
  if (input?.up) dir = "up";
  else if (input?.down) dir = "down";
  else if (input?.left) dir = "left";
  else if (input?.right) dir = "right";

  const isImmobilized = flags.isShielded || flags.isStunned;
  // The shield is a "turtle" tool — it holds position entirely while
  // active. Stunned is the same "can't relocate" effect, just inflicted by
  // someone else. You can still turn to face/shoot while shielded (not
  // stunned), just not relocate.
  const wantsBoost = dir !== null && !!input?.boost && next.boostEnergy > 0 && !isImmobilized;
  if (dir && !flags.isStunned) next.dir = dir;

  const speed = wantsBoost ? TANK_SPEED * BOOST_SPEED_MULTIPLIER : TANK_SPEED;
  const desired = dir ? DIR_VECTOR[dir] : { dx: 0, dy: 0 };
  const onIce = tileAt(map, next.x, next.y) === "I";

  if (isImmobilized) {
    next.velocityX = 0;
    next.velocityY = 0;
  } else if (onIce) {
    if (dir) {
      next.velocityX += (desired.dx * speed - next.velocityX) * ICE_ACCELERATION;
      next.velocityY += (desired.dy * speed - next.velocityY) * ICE_ACCELERATION;
    } else {
      next.velocityX *= ICE_FRICTION;
      next.velocityY *= ICE_FRICTION;
      if (Math.hypot(next.velocityX, next.velocityY) < ICE_STOP_SPEED) {
        next.velocityX = 0;
        next.velocityY = 0;
      }
    }
  } else {
    next.velocityX = desired.dx * speed;
    next.velocityY = desired.dy * speed;
  }

  const moveDx = next.velocityX;
  const moveDy = next.velocityY;
  next.moving = !isImmobilized && Math.hypot(moveDx, moveDy) >= ICE_STOP_SPEED;
  if (next.moving) {
    const nx = next.x + moveDx;
    if (!tankBlocked(map, nx, next.y)) {
      if (tryEntityMove(nx, next.y, moveDx, 0, wantsBoost)) next.x = nx;
    } else {
      next.velocityX = 0;
    }
    const ny = next.y + moveDy;
    if (!tankBlocked(map, next.x, ny)) {
      if (tryEntityMove(next.x, ny, 0, moveDy, wantsBoost)) next.y = ny;
    } else {
      next.velocityY = 0;
    }
  }

  if (wantsBoost) {
    next.boostEnergy = Math.max(0, next.boostEnergy - BOOST_DRAIN_PER_TICK);
    next.isBoosting = true;
  } else {
    next.boostEnergy = Math.min(MAX_BOOST_ENERGY, next.boostEnergy + BOOST_REGEN_PER_TICK);
    next.isBoosting = false;
  }

  return next;
}
