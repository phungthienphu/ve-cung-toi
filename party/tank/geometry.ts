// Pure spatial helpers shared across the tick subsystems: tile lookups,
// AABB-ish blocking checks, and the tank/crate shove physics. None of these
// touch room state directly — every input they need is passed in — so
// they're trivial to unit-reason about in isolation from the room class.

import {
  CRATE_SIZE,
  PICKUP_WEIGHTS,
  TANK_SIZE,
  TILE_SIZE,
  mapCols,
  mapRows,
  type Crate,
  type Direction,
  type ItemKind,
  type TankMapDef,
  type TankPlayer,
} from "../../shared/tankTypes";

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function tileAt(map: TankMapDef, px: number, py: number): string {
  const col = Math.floor(px / TILE_SIZE);
  const row = Math.floor(py / TILE_SIZE);
  if (row < 0 || row >= mapRows(map) || col < 0 || col >= mapCols(map)) return "#";
  return map.layout[row][col] ?? "#";
}

export function spawnPixel(tile: { x: number; y: number }) {
  return { x: tile.x * TILE_SIZE + TILE_SIZE / 2, y: tile.y * TILE_SIZE + TILE_SIZE / 2 };
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

export function findOverlappingTank(
  players: IterableIterator<TankPlayer>,
  excludeIds: ReadonlySet<string>,
  x: number,
  y: number
): TankPlayer | null {
  for (const other of players) {
    if (excludeIds.has(other.id) || !other.alive) continue;
    if (Math.hypot(x - other.x, y - other.y) < TANK_SIZE) return other;
  }
  return null;
}

/**
 * Attempts to shove `other` by (dx, dy). Fails if that would put it inside a
 * wall or a third tank. Ramming a tank into a hazard/trap tile is the whole
 * point — hazard tiles are walkable, so the push itself is never blocked by
 * them, only by walls and other tanks.
 */
export function tryPushTank(
  other: TankPlayer,
  dx: number,
  dy: number,
  map: TankMapDef,
  players: Map<string, TankPlayer>,
  pusherId: string
): boolean {
  if (other.shieldHitsLeft > 0) return false; // a standing shield holds its ground like a wall
  const nx = other.x + dx;
  const ny = other.y + dy;
  if (tankBlocked(map, nx, ny)) return false;
  if (findOverlappingTank(players.values(), new Set([other.id, pusherId]), nx, ny)) return false;
  other.x = nx;
  other.y = ny;
  return true;
}

/** Higher current speed wins a head-on shove; ties break on leftover boost energy. */
export function winsShovingContest(mover: TankPlayer, moverBoosting: boolean, blocker: TankPlayer): boolean {
  if (moverBoosting !== blocker.isBoosting) return moverBoosting;
  return mover.boostEnergy >= blocker.boostEnergy;
}

export function crateBlocked(map: TankMapDef, x: number, y: number): boolean {
  const half = CRATE_SIZE / 2;
  return (
    tileAt(map, x - half, y - half) === "#" ||
    tileAt(map, x + half, y - half) === "#" ||
    tileAt(map, x - half, y + half) === "#" ||
    tileAt(map, x + half, y + half) === "#"
  );
}

export function findOverlappingCrate(crates: Crate[], x: number, y: number): Crate | null {
  for (const c of crates) {
    if (Math.hypot(x - c.x, y - c.y) < (TANK_SIZE + CRATE_SIZE) / 2) return c;
  }
  return null;
}

/** Same idea as tryPushTank — a crate rammed by a tank slides in that
 * direction unless it would land in a wall, another crate, or another tank. */
export function tryPushCrate(crate: Crate, dx: number, dy: number, map: TankMapDef, crates: Crate[], players: Map<string, TankPlayer>): boolean {
  const nx = crate.x + dx;
  const ny = crate.y + dy;
  if (crateBlocked(map, nx, ny)) return false;
  for (const other of crates) {
    if (other === crate) continue;
    if (Math.hypot(nx - other.x, ny - other.y) < CRATE_SIZE) return false;
  }
  if (findOverlappingTank(players.values(), new Set(), nx, ny)) return false;
  crate.x = nx;
  crate.y = ny;
  return true;
}

export function randomPickupKind(): ItemKind {
  const r = Math.random();
  let acc = 0;
  for (const [kind, weight] of Object.entries(PICKUP_WEIGHTS) as [ItemKind, number][]) {
    acc += weight;
    if (r <= acc) return kind;
  }
  return "health";
}

/** Finds a random open ('.') floor tile — used both for pickup spawns and
 * monster nests. Gives up (returns null) after enough failed attempts
 * instead of scanning the whole map, since maps are mostly open anyway. */
export function randomOpenTile(map: TankMapDef): { x: number; y: number } | null {
  const cols = mapCols(map);
  const rows = mapRows(map);
  for (let attempt = 0; attempt < 30; attempt++) {
    const col = 1 + Math.floor(Math.random() * (cols - 2));
    const row = 1 + Math.floor(Math.random() * (rows - 2));
    if (map.layout[row]?.[col] === ".") return { x: col, y: row };
  }
  return null;
}

export const DIR_VECTOR: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const DIR_ANGLE: Record<Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

/** Where a shot from this player should travel: the desktop mouse-aim angle
 * if the client is sending one, otherwise whichever of the 4 movement
 * directions the tank is currently facing. */
export function aimAngleOf(player: TankPlayer): number {
  return player.aimAngle ?? DIR_ANGLE[player.dir];
}
