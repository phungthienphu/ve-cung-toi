// Shared types for the top-down tank battle mini-game. Kept fully separate
// from shared/types.ts (the drawing game) — different room shape, different
// PartyKit party ("tanks"), no coupling between the two games.

export const TILE_SIZE = 32;

export interface TankMapDef {
  id: string;
  name: string;
  // '#' = wall, '.' = empty floor, 'H' = natural hazard (spikes), 'B' = bush (hides tanks standing in it).
  layout: string[];
}

// Three fixed MVP arenas of increasing size/complexity. Swap these out later
// for player-drawn maps without touching any of the game logic below — the
// simulation only ever reads a chosen map's layout + TILE_SIZE.
export const TANK_MAPS: TankMapDef[] = [
  {
    id: "arena",
    name: "Đấu trường nhỏ",

    layout: [
      "###############################",
      "#B.B..........................#",
      "#.............................#",
      "#B.B.....#####................#",
      "#........#...#................#",
      "#........#...#####............#",
      "#....##..#.........##.........#",
      "#....##......HHH....##........#",
      "#..............H..............#",
      "#........####..H....#####.....#",
      "#........#...........#........#",
      "#..#####.#..###......#........#",
      "#..#.....#..#........#....##..#",
      "#..#.........#..####......##..#",
      "#..###.......#................#",
      "#...........#####.............#",
      "#.........H......###.......B.B#",
      "#.............................#",
      "#..........................B.B#",
      "###############################",
    ],
  },
  {
    id: "maze",
    name: "Mê cung",

    layout: [
      "#####################################",
      "#B.B..............#.................#",
      "#.....####........#......###........#",
      "#B.B...##.........#......###........#",
      "#..####...........#.................#",
      "#..####.....###...#####.............#",
      "#............#.........#............#",
      "#....###.....#..HHH....#....####....#",
      "#....#.......#....H....#....#.......#",
      "#....#..#####.....H....#....#.......#",
      "#....#..#..................###......#",
      "#.......#....#######.......###......#",
      "#..###..#....#.............#........#",
      "#..#....#....#....###......#........#",
      "#..#.........#....#........####.....#",
      "#..#####.....#....#.................#",
      "#.................#.................#",
      "#.....###.........#####.............#",
      "#.....###.........................#.#",
      "#..............H.............H...B.B#",
      "#...................................#",
      "#................................B.B#",
      "#####################################",
    ],
  },
  {
    id: "field",
    name: "Sa mạc mở",

    layout: [
      "#######################################",
      "#B.B..................................#",
      "#........######.......................#",
      "#B.B.....######....H..................#",
      "#..........................#####......#",
      "#....###...............H....#####.....#",
      "#....###....####.............#........#",
      "#.........H..####............#........#",
      "#...........#####.....................#",
      "#....................######...........#",
      "#..######............######...........#",
      "#..######..H..........................#",
      "#...............###...................#",
      "#.....#####.....###...................#",
      "#.....#####..............####.........#",
      "#...............H........####.........#",
      "#..###...................####.........#",
      "#..###......######....................#",
      "#.........H..######..............H....#",
      "#...........######....................#",
      "#.....................................#",
      "#..................................B.B#",
      "#.....................................#",
      "#..................................B.B#",
      "#######################################",
    ],
  },
];

export const DEFAULT_MAP_ID = TANK_MAPS[0].id;

export function getMap(mapId: string | null | undefined): TankMapDef {
  return TANK_MAPS.find((m) => m.id === mapId) ?? TANK_MAPS[0];
}

export function mapCols(map: TankMapDef): number {
  return map.layout[0].length;
}

export function mapRows(map: TankMapDef): number {
  return map.layout.length;
}

export function mapCanvasSize(map: TankMapDef): { w: number; h: number } {
  return { w: mapCols(map) * TILE_SIZE, h: mapRows(map) * TILE_SIZE };
}

// 8 spawn points clustered into two corner quadrants — indices 0-3 sit near
// the top-left corner, 4-7 near the bottom-right, so team A and team B land
// on opposite sides of the map instead of interleaved. FFA just cycles
// through all 8 in join order, same as before.
export function getSpawnPoints(map: TankMapDef): { x: number; y: number }[] {
  const cols = mapCols(map);
  const rows = mapRows(map);
  return [
    { x: 1, y: 1 },
    { x: 1, y: 3 },
    { x: 3, y: 1 },
    { x: 3, y: 3 },
    { x: cols - 2, y: rows - 2 },
    { x: cols - 2, y: rows - 4 },
    { x: cols - 4, y: rows - 2 },
    { x: cols - 4, y: rows - 4 },
  ];
}

export const TANK_COLORS = [
  "#3854ff", // blue
  "#e0453f", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#78350f", // brown
];

export type Team = "A" | "B";

export const MAX_TANK_PLAYERS = 8;
export const MIN_TANK_PLAYERS = 2;
export const KILL_TARGET = 5;
export const MATCH_DURATION_MS = 4 * 60 * 1000; // 4-minute match clock

export const TANK_SIZE = 22;
export const TANK_SPEED = 2.4; // px/tick
export const BULLET_SIZE = 6;
export const BULLET_SPEED = 6.5; // px/tick
export const FIRE_COOLDOWN_MS = 350;
export const RESPAWN_DELAY_MS = 1500;
export const TICK_MS = 50; // 20Hz

// LoL/Bang Bang-style health pool: a big number with proportional damage per
// hit, instead of a fixed "3 hits and you're dead" counter — gives room for
// a gradient health bar and percentage-flavored effects (burns, shields).
export const MAX_HP = 100;
export const BULLET_DAMAGE = 20; // 5 clean hits to kill, same feel as before
export const PICKUP_SIZE = 16;
export const MAX_PICKUPS = 2;
export const PICKUP_SPAWN_INTERVAL_MS = 9000;
export const PICKUP_HEAL_AMOUNT = 35;

// Odds a freshly-spawned map pickup is each kind (must sum to 1). Shield is
// deliberately excluded here — it only ever drops from a killed monster, so
// its weight stays 0 for this general spawner.
export const PICKUP_WEIGHTS: Record<ItemKind, number> = { health: 0.4, trap: 0.2, blind: 0.2, fire: 0.2, shield: 0 };

export const TRAP_DAMAGE = 30;
export const TRAP_SIZE = 18;
export const BLIND_DURATION_MS = 5000;
export const VISION_RADIUS = 110; // px around the blinded player's own tank

// Shield item: a standing barrier that blocks a fixed number of incoming
// bullets (any kind) instead of the player taking the hit. While active the
// tank can't move (or be shoved) at all — a "hold this spot" tool for
// stalling until backup arrives, not something you can shield-and-run with.
export const SHIELD_MAX_HITS = 5;

// Fire item: the next few normal shots become flaming rounds that ignite
// whoever they hit for a few seconds of damage-over-time on top of the
// direct hit.
export const FIRE_SHOTS_PER_ITEM = 3;
export const BURN_DURATION_MS = 3000;
export const BURN_TICK_INTERVAL_MS = 600;
export const BURN_DAMAGE_PER_TICK = 8;

// Natural terrain hazard ('H' tiles baked into a map's layout) — walkable,
// so tanks (and pushes) can enter them, but they tick damage while stood on.
export const HAZARD_DAMAGE = 6;
export const HAZARD_DAMAGE_INTERVAL_MS = 700;

// Bush tiles ('B') hide whichever tank is standing in them from everyone
// else's screen, unless a viewer is close enough to spot it anyway. Same
// "server sends full state, client chooses not to render it" pattern as the
// blind item's fog-of-war — no server-side visibility filtering needed.
export const BUSH_REVEAL_RADIUS = 50;

// Forest monsters (PvE): server-simulated, each tied to a "nest" — its own
// spawn point. Passive by default, wandering only near its nest; a monster
// only gives chase after a tank collides with it or shoots it, and gives up
// (returns to wandering) once the target escapes the leash range, dies, or
// the aggro timer lapses without being refreshed by another hit.
export const MONSTER_COUNT = 2;
export const MONSTER_HP = 2;
export const MONSTER_SIZE = TANK_SIZE;
export const MONSTER_SPEED = 1.3;
export const MONSTER_CHASE_SPEED_MULTIPLIER = 1.4;
export const MONSTER_DAMAGE = 10;
export const MONSTER_CONTACT_COOLDOWN_MS = 900;
export const MONSTER_DIR_CHANGE_MS = 1800;
export const MONSTER_RESPAWN_DELAY_MS = 6000;
export const MONSTER_NEST_RADIUS = 90; // wander leash while passive
export const MONSTER_CHASE_LEASH_RADIUS = 170; // gives up the chase past this from its nest
export const MONSTER_REST_CHANCE = 0.4; // odds it pauses instead of picking a new direction
export const MONSTER_REST_DURATION_MS = 2500;

// A monster's nest is marked on the ground by a mud/water puddle — purely
// visual, except stepping into it also douses a burning tank.
export const NEST_PUDDLE_RADIUS = 26;
export const MONSTER_AGGRO_TIMEOUT_MS = 4000; // must be refreshed by another hit or it drops

// Boost is a built-in ability every tank has (hold to sprint), gated by an
// energy meter rather than a pickup — drains while boosting, regenerates
// on its own once you let go.
export const MAX_BOOST_ENERGY = 100;
export const BOOST_DRAIN_PER_TICK = 1.6; // ~3s of sprint on a full bar at 20Hz
export const BOOST_REGEN_PER_TICK = 0.5; // ~10s to refill from empty
export const BOOST_SPEED_MULTIPLIER = 1.8;

// Inventory: up to 3 different pickup kinds held at once, each consumed the
// moment it's used (no stacking, no duplicates of the same kind).
export const MAX_HELD_ITEMS = 3;

// Default built-in skill every tank has regardless of pickups: a heavy shot
// worth double normal bullet damage, gated by its own energy meter that only
// fills passively over time — separate from the boost meter.
export const MAX_ULTIMATE_ENERGY = 100;
export const ULTIMATE_REGEN_PER_TICK = 0.5; // ~10s to charge from empty at 20Hz
export const ULTIMATE_DAMAGE_MULTIPLIER = 2;

// Follow-camera viewport (MOBA-style zoomed-in view) — the client only ever
// renders this many pixels around the local player; the rest of the map is
// only visible through the minimap. Purely a client rendering concern (the
// server always simulates/broadcasts full map state), but kept here so the
// tile-size math stays in one place.
export const VIEWPORT_COLS = 11;
export const VIEWPORT_ROWS = 8;
export const VIEWPORT_W = VIEWPORT_COLS * TILE_SIZE;
export const VIEWPORT_H = VIEWPORT_ROWS * TILE_SIZE;

export type Direction = "up" | "down" | "left" | "right";
export type ItemKind = "health" | "trap" | "blind" | "shield" | "fire";
export type BulletKind = "normal" | "blind" | "big" | "fire";

export interface TankPlayer {
  id: string;
  name: string;
  color: string;
  team: Team;
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
  alive: boolean;
  hp: number;
  score: number;
  connected: boolean;
  isHost: boolean;
  respawnAt: number | null;
  items: ItemKind[];
  blindedUntil: number | null;
  boostEnergy: number;
  isBoosting: boolean;
  ultimateEnergy: number;
  shieldHitsLeft: number;
  fireShotsLeft: number;
  burningUntil: number | null;
  burnOwnerId: string | null;
  // Mouse-aim angle in radians, sent only by desktop clients tracking the
  // cursor; null falls back to firing along the 4-directional `dir`.
  aimAngle: number | null;
}

export interface Bullet {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  // Free-angle travel direction in radians (0 = right, increasing clockwise
  // in screen space) — lets desktop players aim at the mouse instead of
  // being locked to the 4-directional movement grid.
  angle: number;
  kind: BulletKind;
}

export interface Pickup {
  id: string;
  x: number;
  y: number;
  kind: ItemKind;
}

export interface Trap {
  id: string;
  ownerId: string;
  x: number;
  y: number;
}

export interface Monster {
  id: string;
  x: number;
  y: number;
  dir: Direction;
  alive: boolean;
  hp: number;
  respawnAt: number | null;
  nestX: number;
  nestY: number;
  aggroPlayerId: string | null;
}

/** A single-tick "something happened here" event — purely cosmetic, consumed
 * client-side to spawn a spark/skid-mark ("shove") or a trap-triggered burst
 * ("trap") effect at (x, y). */
export interface TankImpact {
  id: string;
  x: number;
  y: number;
  kind: "shove" | "trap" | "shield";
}

/** A single-tick elimination event — consumed client-side to show a
 * PUBG-style kill-feed line for a few seconds. `killerName` is null for
 * environmental deaths (hazard tiles, forest monsters). */
export interface TankKillEvent {
  id: string;
  killerName: string | null;
  victimName: string;
}

export type TankRoomStatus = "lobby" | "playing" | "ended";

export type TankRoomMode = "ffa" | "team";

export interface TankPublicState {
  roomId: string;
  status: TankRoomStatus;
  mode: TankRoomMode;
  hostId: string | null;
  players: TankPlayer[];
  bullets: Bullet[];
  pickups: Pickup[];
  traps: Trap[];
  monsters: Monster[];
  impacts: TankImpact[];
  kills: TankKillEvent[];
  mapId: string;
  killTarget: number;
  teamScores: Record<Team, number>;
  winnerId: string | null;
  winningTeam: Team | null;
  matchEndsAt: number | null;
  serverNow: number;
}

export type TankClientMessage =
  | { type: "join"; playerId: string; name: string; color: string }
  | { type: "choose_team"; team: Team }
  | { type: "set_mode"; mode: TankRoomMode }
  | { type: "start_game"; mapId: string }
  | { type: "play_again" }
  | { type: "input"; up: boolean; down: boolean; left: boolean; right: boolean; boost: boolean; aimAngle?: number }
  | { type: "shoot"; big?: boolean }
  | { type: "use_item"; kind: ItemKind }
  | { type: "leave_room" };

export type TankServerMessage =
  | { type: "state"; state: TankPublicState }
  | { type: "kicked" }
  | { type: "error"; message: string };
