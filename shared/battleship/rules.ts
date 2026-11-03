import type { BattleshipMode, ShipKind, ShipPlacement, PublicBoard, BotLevel } from "./models";
import { SHIP_SIZE } from "./config";

export function boardSizeFor(mode: BattleshipMode): number {
  return mode === "ffa" ? 8 : 10;
}

export function fleetFor(mode: BattleshipMode): ShipKind[] {
  return mode === "ffa"
    ? ["battleship", "cruiser", "submarine", "destroyer"]
    : ["carrier", "battleship", "cruiser", "submarine", "destroyer"];
}

export function cellIndex(x: number, y: number, size: number): number {
  return y * size + x;
}

export function cellXY(cell: number, size: number): { x: number; y: number } {
  return { x: cell % size, y: Math.floor(cell / size) };
}

export function shipCells(ship: ShipPlacement, size: number): number[] {
  const cells: number[] = [];
  for (let i = 0; i < SHIP_SIZE[ship.kind]; i++) {
    const x = ship.x + (ship.vertical ? 0 : i);
    const y = ship.y + (ship.vertical ? i : 0);
    cells.push(cellIndex(x, y, size));
  }
  return cells;
}

export function inBounds(ship: ShipPlacement, size: number): boolean {
  const length = SHIP_SIZE[ship.kind];
  if (!Number.isInteger(ship.x) || !Number.isInteger(ship.y) || ship.x < 0 || ship.y < 0) return false;
  return ship.vertical ? ship.y + length <= size && ship.x < size : ship.x + length <= size && ship.y < size;
}

export /** Cells a ship occupies plus (when `noTouching`) the ring around it. */
function footprint(ship: ShipPlacement, size: number, noTouching: boolean): number[] {
  if (!noTouching) return shipCells(ship, size);
  const cells: number[] = [];
  const length = SHIP_SIZE[ship.kind];
  const w = ship.vertical ? 1 : length;
  const h = ship.vertical ? length : 1;
  for (let y = ship.y - 1; y <= ship.y + h; y++) {
    for (let x = ship.x - 1; x <= ship.x + w; x++) {
      if (x >= 0 && y >= 0 && x < size && y < size) cells.push(cellIndex(x, y, size));
    }
  }
  return cells;
}

/** Every ship of `fleet` exactly once, on the board, not overlapping — and not
 * touching (even diagonally) when the room's rule says so. */
export function isValidFleet(ships: ShipPlacement[], fleet: ShipKind[], size: number, noTouching: boolean): boolean {
  if (!Array.isArray(ships) || ships.length !== fleet.length) return false;
  const wanted = [...fleet].sort().join(",");
  if (ships.map((ship) => ship.kind).sort().join(",") !== wanted) return false;
  const occupied = new Set<number>();
  for (const ship of ships) {
    if (!SHIP_SIZE[ship.kind] || !inBounds(ship, size)) return false;
    for (const cell of shipCells(ship, size)) if (occupied.has(cell)) return false;
    for (const cell of footprint(ship, size, noTouching)) occupied.add(cell);
  }
  return true;
}

/** True if `ship` can be dropped where it is next to `others` (placement editor). */
export function canPlace(ship: ShipPlacement, others: ShipPlacement[], size: number, noTouching: boolean): boolean {
  if (!inBounds(ship, size)) return false;
  const blocked = new Set<number>();
  for (const other of others) for (const cell of footprint(other, size, noTouching)) blocked.add(cell);
  return shipCells(ship, size).every((cell) => !blocked.has(cell));
}

export function randomFleet(fleet: ShipKind[], size: number, noTouching: boolean): ShipPlacement[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const placed: ShipPlacement[] = [];
    let ok = true;
    for (const kind of fleet) {
      let done = false;
      for (let tries = 0; tries < 300 && !done; tries++) {
        const vertical = Math.random() < 0.5;
        const length = SHIP_SIZE[kind];
        const ship: ShipPlacement = {
          kind,
          vertical,
          x: Math.floor(Math.random() * (vertical ? size : size - length + 1)),
          y: Math.floor(Math.random() * (vertical ? size - length + 1 : size)),
        };
        if (canPlace(ship, placed, size, noTouching)) {
          placed.push(ship);
          done = true;
        }
      }
      if (!done) {
        ok = false;
        break;
      }
    }
    if (ok) return placed;
  }
  // Touching allowed always fits; only reachable with an impossible rule set.
  return randomFleet(fleet, size, false);
}

// ---------- bot targeting (pure, public info only) ----------

/** Picks a cell to fire at on a board, using only what everyone can see. */
export function pickBotCell(board: PublicBoard, level: BotLevel, noTouching: boolean, avoid: number[] = []): number | null {
  const size = board.size;
  const shot = new Set([...board.hits, ...board.misses, ...avoid]);
  const sunkCells = new Set(board.sunk.flatMap((ship) => shipCells(ship, size)));
  const blocked = new Set<number>(shot);
  if (noTouching) {
    for (const ship of board.sunk) {
      for (const cell of shipCells(ship, size)) {
        const { x, y } = cellXY(cell, size);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < size && ny < size) blocked.add(cellIndex(nx, ny, size));
        }
      }
    }
  }
  const open: number[] = [];
  for (let cell = 0; cell < size * size; cell++) if (!blocked.has(cell)) open.push(cell);
  if (open.length === 0) {
    const any = Array.from({ length: size * size }, (_, cell) => cell).filter((cell) => !shot.has(cell));
    return any.length ? any[Math.floor(Math.random() * any.length)] : null;
  }
  const random = (cells: number[]) => cells[Math.floor(Math.random() * cells.length)];
  if (level === "easy") return random(open);

  // Target mode: finish ships that were hit but haven't sunk yet.
  const openHits = board.hits.filter((cell) => !sunkCells.has(cell));
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && !blocked.has(cellIndex(x, y, size));
  for (const hit of openHits) {
    const { x, y } = cellXY(hit, size);
    const line: number[] = [];
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      const neighbour = openHits.includes(cellIndex(x + dx, y + dy, size)) && x + dx < size;
      if (!neighbour) continue;
      // Extend the line of hits both ways.
      let fx = x + dx;
      let fy = y + dy;
      while (openHits.includes(cellIndex(fx, fy, size)) && fx < size && fy < size) {
        fx += dx;
        fy += dy;
      }
      let bx = x - dx;
      let by = y - dy;
      while (bx >= 0 && by >= 0 && openHits.includes(cellIndex(bx, by, size))) {
        bx -= dx;
        by -= dy;
      }
      if (free(fx, fy)) line.push(cellIndex(fx, fy, size));
      if (free(bx, by)) line.push(cellIndex(bx, by, size));
    }
    if (line.length) return random(line);
  }
  const around: number[] = [];
  for (const hit of openHits) {
    const { x, y } = cellXY(hit, size);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (free(x + dx, y + dy)) around.push(cellIndex(x + dx, y + dy, size));
    }
  }
  if (around.length) return random(around);

  // Hunt mode: checkerboard, since every ship is at least 2 long.
  const parity = open.filter((cell) => {
    const { x, y } = cellXY(cell, size);
    return (x + y) % 2 === 0;
  });
  return random(parity.length ? parity : open);
}
