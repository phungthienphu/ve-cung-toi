// Hải Chiến (Battleship) — types and pure board rules shared by the PartyKit
// room and the client. Ship positions are secret: only the owner (or owning
// team) ever receives them, everyone else only sees shots and sunk ships.

export type BattleshipMode = "solo" | "ffa" | "team";
export type BattleshipTeam = "A" | "B";
export type BattleshipPhase = "lobby" | "placement" | "battle" | "gameEnd";
export type BotLevel = "easy" | "normal";

export const MAX_BATTLESHIP_PLAYERS = 8;
export const MAX_TEAM_SIZE = 4;
export const PLACEMENT_SECONDS = 60;
export const RECONNECT_GRACE_MS = 30_000;
export const REVEAL_MS = 1800;
export const MID_GAME_JOIN_MESSAGE = "Trận đang diễn ra, chờ ván sau nhé ⚓";

export const MODE_LABELS: Record<BattleshipMode, string> = {
  solo: "Solo 1 vs 1",
  ffa: "Hỗn chiến",
  team: "Đồng đội",
};

export const TEAM_LABELS: Record<BattleshipTeam, string> = { A: "Xanh", B: "Đỏ" };

// ---------- fleet ----------

export type ShipKind = "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";

export const SHIP_SIZE: Record<ShipKind, number> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};

export const SHIP_LABEL: Record<ShipKind, string> = {
  carrier: "Tàu sân bay",
  battleship: "Thiết giáp hạm",
  cruiser: "Tuần dương hạm",
  submarine: "Tàu ngầm",
  destroyer: "Khu trục hạm",
};

export interface ShipPlacement {
  kind: ShipKind;
  x: number;
  y: number;
  vertical: boolean;
}

/** Hỗn chiến puts up to 8 boards on screen, so each is smaller with a lighter
 * fleet to keep the match short; 1v1 and team play the classic 10×10. */
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

function inBounds(ship: ShipPlacement, size: number): boolean {
  const length = SHIP_SIZE[ship.kind];
  if (!Number.isInteger(ship.x) || !Number.isInteger(ship.y) || ship.x < 0 || ship.y < 0) return false;
  return ship.vertical ? ship.y + length <= size && ship.x < size : ship.x + length <= size && ship.y < size;
}

/** Cells a ship occupies plus (when `noTouching`) the ring around it. */
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

// ---------- room state ----------

export interface BattleshipConfig {
  mode: BattleshipMode;
  /** Seconds per turn (solo) or per round (hỗn chiến / đồng đội). */
  turnSeconds: number;
  /** Ships may not touch each other, even diagonally. */
  noTouching: boolean;
  /** Solo: a hit earns another shot. */
  hitAgain: boolean;
  botCount: number;
  botLevel: BotLevel;
}

export const DEFAULT_BATTLESHIP_CONFIG: BattleshipConfig = {
  mode: "solo",
  turnSeconds: 15,
  noTouching: true,
  hitAgain: true,
  botCount: 0,
  botLevel: "normal",
};

export interface BattleshipPlayer {
  id: string;
  name: string;
  connected: boolean;
  disconnectedUntil: number | null;
  isHost: boolean;
  isBot: boolean;
  /** Lobby: "sẵn sàng". Placement: "đã xếp xong". */
  ready: boolean;
  team: BattleshipTeam | null;
  /** Round in which this player's fleet went down (hỗn chiến), or null. */
  eliminatedRound: number | null;
  shots: number;
  hits: number;
  sinks: number;
}

export interface PublicBoard {
  /** Player id in solo/hỗn chiến, "team-A" / "team-B" in đồng đội. */
  id: string;
  ownerIds: string[];
  team: BattleshipTeam | null;
  size: number;
  hits: number[];
  misses: number[];
  sunk: ShipPlacement[];
  shipsTotal: number;
  alive: boolean;
}

export interface ShotEvent {
  id: string;
  shooterId: string;
  boardId: string;
  cell: number;
  result: "miss" | "hit" | "sunk";
  sunkKind?: ShipKind;
}

export interface BattleshipChatEntry {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  sentAt: number;
  system?: boolean;
}

export interface BattleshipStanding {
  playerId: string;
  place: number;
}

export interface PublicBattleshipState {
  roomId: string;
  phase: BattleshipPhase;
  config: BattleshipConfig;
  hostId: string | null;
  players: BattleshipPlayer[];
  phaseEndsAt: number | null;
  boards: PublicBoard[];
  /** Solo: whose turn it is. */
  turnPlayerId: string | null;
  /** Hỗn chiến / đồng đội: round number and the post-round reveal pause. */
  round: number;
  revealUntil: number | null;
  /** Hỗn chiến: how many shots are aimed at each board this round (for the cap). */
  aimCounts: Record<string, number>;
  /** Max shots a single board can take per round (hỗn chiến). */
  aimCap: number;
  lockedPlayerIds: string[];
  lastShots: ShotEvent[];
  log: { id: string; text: string }[];
  chat: BattleshipChatEntry[];
  winnerIds: string[];
  winnerTeam: BattleshipTeam | null;
  standings: BattleshipStanding[];
  /** Every fleet, only once the game is over. */
  revealedFleets: Record<string, ShipPlacement[]> | null;
}

export interface PrivateBattleshipState {
  myBoardId: string | null;
  /** Your fleet (or your team's shared fleet). */
  ships: ShipPlacement[];
  /** This round's aims (your own). */
  aimBoardId: string | null;
  aimCells: number[];
  shotsAllowed: number;
  locked: boolean;
  /** Đồng đội: where teammates are aiming right now. */
  teamAims: Array<{ playerId: string; cells: number[] }>;
  teamChat: BattleshipChatEntry[];
  /** Knocked-out players watch with every fleet visible. */
  spectatorFleets: Record<string, ShipPlacement[]> | null;
}

export interface BattleshipRoomListing {
  roomId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  mode: BattleshipMode;
  status: "lobby" | "playing";
}

export type BattleshipClientMessage =
  | { type: "join"; playerId: string; name: string }
  | { type: "chat"; text: string; teamOnly?: boolean }
  | { type: "set_ready"; ready: boolean }
  | { type: "update_config"; config: BattleshipConfig }
  | { type: "choose_team"; team: BattleshipTeam }
  | { type: "shuffle_teams" }
  | { type: "start_game" }
  | { type: "place_ships"; ships: ShipPlacement[] }
  | { type: "random_ships" }
  | { type: "shoot"; cell: number }
  | { type: "aim"; boardId: string; cell: number }
  | { type: "lock_aim" }
  | { type: "play_again" }
  | { type: "leave_room" };

export type BattleshipServerMessage =
  | { type: "state"; state: PublicBattleshipState }
  | { type: "private_state"; state: PrivateBattleshipState }
  | { type: "error"; message: string };

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
