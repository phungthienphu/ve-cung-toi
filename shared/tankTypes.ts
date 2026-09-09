// Shared types for the top-down tank battle mini-game. Kept fully separate
// from shared/types.ts (the drawing game) — different room shape, different
// PartyKit party ("tanks"), no coupling between the two games.

export const TILE_SIZE = 32;

export interface TankMapDef {
  id: string;
  name: string;
  // Which real tile art to use for floor rendering — purely a client
  // concern, but kept on the map def so it travels with mapId.
  terrain: "grass" | "sand";
  // '#' = wall, '.' = empty floor, 'H' = natural hazard (spikes), 'B' = bush
  // (hides tanks standing in it), 'C' = wooden crate (blocks movement/bullets
  // until rammed — then it gets shoved like a tank being pushed), 'R' = road
  // (purely cosmetic — walkable exactly like '.', just rendered as a path
  // auto-tiled from its 'R' neighbors).
  layout: string[];
}

// Three fixed MVP arenas of increasing size/complexity. Swap these out later
// for player-drawn maps without touching any of the game logic below — the
// simulation only ever reads a chosen map's layout + TILE_SIZE.
export const TANK_MAPS: TankMapDef[] = [
  {
    id: "arena",
    name: "Đấu trường nhỏ",
    terrain: "grass",

    layout: [
      "###############################",
      "#B.B..........................#",
      "#...RRRRRRRR....C.........B...#",
      "#B.BR....#####.....#######....#",
      "#...R....#...#.....#######....#",
      "#...R....#...#.....#..........#",
      "#...RRRRR#...#.....#........C.#",
      "#....###R.......HHH#..........#",
      "#....###R........H....######..#",
      "#.......R........H....######..#",
      "#.......RRRRRRRR....RRRRRR....#",
      "#.......####...R....R....R....#",
      "#.....B.####RRRCRRRRR....R.R..#",
      "#.......####...R.......B.R.R..#",
      "#...####.......R###......R.R..#",
      "#..R#R##RRRRRRRR###RRRRRRR.R..#",
      "#..R#R##....HHH.###..C.....R..#",
      "#..RRRRRRRRRRRRR###.RRRRRRRR..#",
      "#.......C..................B.B#",
      "###############################",
    ],
  },
  {
    id: "maze",
    name: "Mê cung",
    terrain: "grass",

    layout: [
      "#####################################",
      "#B.B................................#",
      "#....####...####.....####....####...#",
      "#B.B.####...###RRRRRRR###....####...#",
      "#.RRRRRRRRRRR###.R.......C...####...#",
      "#...........R....R##RRRRRRRRR####...#",
      "#...###...##R#...R###.......R.C.....#",
      "#...###...##R#...R###.....##R#......#",
      "#...###.....R....RHHH.....##R#......#",
      "#...###.RRRRRRRRRR.H......##R#..###.#",
      "#.......R.....####.H........RRRRRRR.#",
      "#......#R##...####..........R..R##R.#",
      "#....C.#R##...####...###RRRRR..R##R.#",
      "#......#R##..........###R......R..R.#",
      "#......#R##..........###R.HHH..R##R.#",
      "#.......R..###.......###R......R##R.#",
      "#...####RRRRRRR.C.......R..####R##R.#",
      "#...#####..###R...##RRRRRRRRRRRR..R.#",
      "#...#####..HH#R...#####..C.####...R.#",
      "#..........###R..RRRRRRRRRR......BRB#",
      "#.....###RRRRRRRRRRRR...#####.....R.#",
      "#.........RRRRRRRRRRRRRRR####....B.B#",
      "#####################################",
    ],
  },
  {
    id: "field",
    name: "Sa mạc mở",
    terrain: "sand",

    layout: [
      "#######################################",
      "#B.B..................................#",
      "#.RRRRRRR######.........######........#",
      "#BRB....#######.........###R##........#",
      "#.R.....#######............R..C.......#",
      "#.R..........RR..HHH.......RRRRRR###..#",
      "#.RRRRRRRRRR..R###H#............####..#",
      "#...####...R...###H#............####..#",
      "#...####...R...#####...............RR.#",
      "#...####...R........RR...C..........R.#",
      "#...####...R.........R######........R.#",
      "#.........HHH.......R#######........R.#",
      "#..........RC.......R......RR....C..R.#",
      "#.....##RRRRRRRRRRRRR.......R######.R.#",
      "#.....######.......CR.......#######.R.#",
      "#.....######........R.......RRRRRRRRR.#",
      "#...................R.####..R.........#",
      "#............#####..R.####..R.HHH.....#",
      "#............###RRRRRRRRRRRRR..H......#",
      "#...####.....#####....####.....####...#",
      "#...####.....R####.............####...#",
      "#...###RRRRRRR...........HH....R###B.B#",
      "#.......C......................R###...#",
      "#............RRRRRRRRRRRRRRRRRRR...B.B#",
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

// Each entry pairs a swatch color with a real Kenney "Tanks" sprite skin
// (see public/Retina) — index-aligned with TANK_SKINS below. The 5 small
// skins (blue/dark/green/red/sand) have a separately-rotatable turret; the 3
// heavy skins (bigRed/darkLarge/huge) only ship a single fused body+turret
// sprite, so their whole tank rotates to face movement instead.
export const TANK_COLORS = [
  "#3b82f6", // blue
  "#475569", // dark
  "#22c55e", // green
  "#ef4444", // red
  "#d9b872", // sand
  "#b91c1c", // bigRed (heavy)
  "#1e293b", // darkLarge (heavy)
  "#78716c", // huge (heavy)
];

export const TANK_SKINS = ["blue", "dark", "green", "red", "sand", "bigRed", "darkLarge", "huge"] as const;
export type TankSkin = (typeof TANK_SKINS)[number];
export const TANK_SKIN_LABELS: Record<TankSkin, string> = {
  blue: "Xanh dương",
  dark: "Đen",
  green: "Lục",
  red: "Đỏ",
  sand: "Cát",
  bigRed: "Đỏ hạng nặng",
  darkLarge: "Đen hạng nặng",
  huge: "Khổng lồ",
};
// Only these 5 skins ship a separate barrel sprite that can aim independent
// of the body's facing; the rest render as one fixed fused sprite.
export const TANK_SKINS_WITH_TURRET: ReadonlySet<TankSkin> = new Set<TankSkin>(["blue", "dark", "green", "red", "sand"]);

/** A player's chosen tank skin is only ever stored as a swatch color
 * (`TankPlayer.color`) — this recovers the skin id from it. Shared between
 * client (rendering) and server (per-skin skill logic), so both always agree
 * on which skin a given color maps to. */
export function skinForColor(color: string): TankSkin {
  const idx = TANK_COLORS.indexOf(color);
  return TANK_SKINS[idx >= 0 ? idx : 0];
}

export type Team = "A" | "B";

export const MAX_TANK_PLAYERS = 8;
export const MIN_TANK_PLAYERS = 2;
export const KILL_TARGET = 5;
export const MATCH_DURATION_MS = 4 * 60 * 1000; // 4-minute match clock

export const TANK_SIZE = 22;
export const TANK_SPEED = 2.4; // px/tick
export const BULLET_SIZE = 6;
export const BULLET_SPEED = 6.5; // px/tick
export const FIRE_COOLDOWN_MS = 400;
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
// fills passively over time — separate from the boost meter. This is the
// fallback for any skin that doesn't (yet) have its own entry in
// ULTIMATE_CONFIG below.
export const MAX_ULTIMATE_ENERGY = 100;
export const ULTIMATE_REGEN_PER_TICK = 0.5; // ~10s to charge from empty at 20Hz
export const ULTIMATE_DAMAGE_MULTIPLIER = 2;

/** Per-skin "R" ultimate energy meter — every skin gets its own unique skill
 * built on this same slot/button, so a skill's power level is balanced by how
 * fast its meter fills rather than all 8 sharing one fixed cooldown. Skins
 * not yet redesigned fall back to the historical shared defaults above. */
export interface UltimateEnergyConfig {
  maxEnergy: number;
  regenPerTick: number;
}
export const ULTIMATE_CONFIG: Record<TankSkin, UltimateEnergyConfig> = {
  // Rapid fire is low-power/low-risk (no burst damage, no CC) — charges
  // faster than the shared baseline so it's worth using often.
  blue: { maxEnergy: 100, regenPerTick: 0.625 }, // ~8s to charge from empty
  dark: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: ULTIMATE_REGEN_PER_TICK },
  green: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: ULTIMATE_REGEN_PER_TICK },
  red: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: ULTIMATE_REGEN_PER_TICK },
  sand: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: ULTIMATE_REGEN_PER_TICK },
  bigRed: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: ULTIMATE_REGEN_PER_TICK },
  darkLarge: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: ULTIMATE_REGEN_PER_TICK },
  huge: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: ULTIMATE_REGEN_PER_TICK },
};

/** How pressing "R" behaves for each skin:
 * - "instant" fires/activates the moment the button is pressed (a single
 *   `shoot: {big: true}` message).
 * - "charge" toggles a scope on with one tap (`charge_ultimate`, no holding
 *   required) and the shot itself fires later through the *normal* shoot
 *   trigger (Space/left click/the touch fire button) while scoped, which
 *   client input code checks and upgrades to `shoot: {big: true}` — see
 *   useTankInput.ts's `sendShot`. The server tracks the charging state (so
 *   it can broadcast a fair telegraph to every player) between the two
 *   messages.
 * - "target" also toggles on with one tap, but entirely client-side — no
 *   message is sent for the tap itself, since the point being picked (by
 *   moving the mouse) has no reason to be visible to anyone before it's
 *   actually committed. Only the eventual `throw_bomb` (again sent by
 *   whichever the normal shoot trigger is) reaches the server, at which
 *   point the resulting hazard *is* broadcast like anything else — see
 *   RedBarrage. Contrast with "charge", where the aiming itself is the
 *   telegraph and must be networked from the moment it starts.
 *
 * Both client input code and the server consult this table instead of
 * hardcoding which skin(s) currently work which way, so adding another
 * charge/target-based skill later is a one-line table edit, not a new
 * `skin === "..."` check scattered across input/HUD/server files. */
export type UltimateActivationMode = "instant" | "charge" | "target";
export const ULTIMATE_ACTIVATION_MODE: Record<TankSkin, UltimateActivationMode> = {
  blue: "instant",
  dark: "charge",
  green: "instant",
  red: "target",
  sand: "instant",
  bigRed: "instant",
  darkLarge: "instant",
  huge: "instant",
};

// Blue's ultimate: hold-to-fire cooldown drops sharply for a short window
// instead of firing one heavy shot.
export const RAPID_FIRE_DURATION_MS = 2000;
export const RAPID_FIRE_COOLDOWN_MS = 140; // vs. the normal FIRE_COOLDOWN_MS (350ms)

// Dark's ultimate: press R to toggle on a scope (shows a telegraphed line
// everyone can see and react to, following the mouse freely — no need to
// hold anything down), then fire with the normal shoot trigger (Space/left
// click/the touch fire button) to release the shot at the current aim.
// Damage stays the same as a normal ultimate (ULTIMATE_DAMAGE_MULTIPLIER),
// but the round travels much faster than any other bullet.
export const SNIPER_BULLET_SPEED = 12; // vs. the normal BULLET_SPEED (6.5)
export const SNIPER_MAX_CHARGE_MS = 6000; // auto-fires if left scoped this long without firing
export const SNIPER_SCOPE_RANGE = 600; // px — how far the telegraph line reaches if it hits no wall first

// Follow-camera viewport (MOBA-style zoomed-in view) — the client only ever
// renders this many pixels around the local player; the rest of the map is
// only visible through the minimap. Purely a client rendering concern (the
// server always simulates/broadcasts full map state), but kept here so the
// tile-size math stays in one place.
export const VIEWPORT_COLS = 19;
export const VIEWPORT_ROWS = 16;
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
  // Blue's ultimate: non-null while its rapid-fire buff is active (the
  // timestamp it expires at) — shortens the normal shot cooldown and drives
  // the client's glow effect.
  rapidFireUntil: number | null;
  // Dark's ultimate: non-null while the scope is toggled on (the timestamp
  // it was toggled on) — drives the client's telegraphed scope-line effect,
  // visible to every player, and auto-fires past SNIPER_MAX_CHARGE_MS if the
  // player never pulls the trigger themselves.
  sniperChargingSince: number | null;
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
  // Per-bullet travel speed (px/tick) — lets a skill's own bullet (e.g.
  // Dark's sniper round) fly faster than the shared BULLET_SPEED default
  // without needing a whole separate bullet kind.
  speed: number;
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

/** A wooden crate baked into a map's layout ('C') — blocks movement and
 * bullets like a wall until a tank rams it, at which point it gets shoved
 * exactly like a tank pushing another tank (same physics, different sprite). */
export interface Crate {
  id: string;
  x: number;
  y: number;
  kind: "wood";
  hp: number;
}
export const CRATE_SIZE = 24;
export const CRATE_MAX_HP = 3; // ~3 shots to blow one apart

/** One bomb of a carpet-bombing airstrike, targeting a single tile's pixel
 * center. Removed server-side the instant it lands (`strikeAt` passes). */
export interface AirstrikeBomb {
  x: number;
  y: number;
  strikeAt: number;
  // Blast radius in px — grows the longer the match runs (see
  // AIRSTRIKE_RAMP_MS), so late-match airstrikes hit noticeably harder to
  // stay threatening. Sent to the client so its warning marker/explosion
  // visuals scale to match the real hitbox instead of always looking the
  // same size.
  radius: number;
}

/** A grass-terrain-only hazard: a 3x3 patch of ground gets marked, then a
 * bomber plane flies a straight line across the map and the marked tiles
 * detonate as it passes overhead. `plane*` fields describe that flight line
 * in pixel coordinates so the client can smoothly place the plane sprite
 * purely from timestamps, with no extra network chatter. */
export interface Airstrike {
  id: string;
  bombs: AirstrikeBomb[];
  warnAt: number;
  // Same value as every bomb's own `strikeAt` (the whole 3x3 volley lands
  // together) — kept here too so the client can still compute "how far
  // through the flight is the drop moment" after the bombs array has
  // already emptied out (each bomb is removed the instant it lands).
  strikeAt: number;
  planeFromX: number;
  planeFromY: number;
  planeToX: number;
  planeToY: number;
  planeDepartAt: number;
  planeArriveAt: number;
}

export const AIRSTRIKE_WARN_MS = 2200;
export const AIRSTRIKE_FLIGHT_MS = 5200;
export const AIRSTRIKE_MIN_INTERVAL_MS = 14000;
export const AIRSTRIKE_MAX_INTERVAL_MS = 24000;
export const BOMB_DAMAGE = 45;
export const BOMB_RADIUS = TILE_SIZE * 0.65;
export const BOMB_RADIUS_MAX = TILE_SIZE * 1.35;
// How long (wall-clock, since the match started) it takes airstrikes to ramp
// up from "mostly random, small blast" to "aimed at you, big blast" — a
// fixed ramp rather than tied to the match timer so it also applies to
// practice rooms, which have no timer at all.
export const AIRSTRIKE_RAMP_MS = 90_000;
// How many tiles away from a targeted player an airstrike's center can land
// at minimum (late-match) vs. maximum (start-of-match) intensity.
export const AIRSTRIKE_AIM_MIN_TILES = 1;
export const AIRSTRIKE_AIM_MAX_TILES = 9;

/** Red's ultimate: a player-aimed artillery barrage. Reuses AirstrikeBomb for
 * each individual impact (same shape: a delayed, radius-damage explosion),
 * just scattered around wherever Red targeted instead of a fixed 3x3 grid
 * with a plane flying over. Unlike the automatic airstrike, there's no
 * server-visible warning before the player commits — see
 * ULTIMATE_ACTIVATION_MODE's "target" mode doc for why. */
export interface RedBarrage {
  id: string;
  ownerId: string;
  bombs: AirstrikeBomb[];
}

export const RED_BOMB_MAX_RANGE = 600; // px — how far from the tank the target point can be
export const RED_BARRAGE_WARN_MS = 1500; // delay from commit to the first impact
export const RED_BARRAGE_DURATION_MS = 2000; // spread of impact times after the warning
export const RED_BARRAGE_BOMB_COUNT = 5;
export const RED_BARRAGE_BOMB_RADIUS = TILE_SIZE * 0.75;
export const RED_BARRAGE_BOMB_DAMAGE = 22; // all 5 landing on a stationary target is ~lethal
export const RED_BARRAGE_SPREAD_RADIUS = TILE_SIZE * 1.8; // how scattered the impacts are around the aim point

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
  kind: "shove" | "trap" | "shield" | "crate" | "bomb";
  // Only set for "bomb" — the blast radius that hit, so the client's
  // explosion visual scales to match instead of always looking the same size.
  radius?: number;
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

export type TankRoomMode = "ffa" | "team" | "practice";

export interface TankPublicState {
  roomId: string;
  status: TankRoomStatus;
  mode: TankRoomMode;
  hostId: string | null;
  players: TankPlayer[];
  bullets: Bullet[];
  pickups: Pickup[];
  traps: Trap[];
  crates: Crate[];
  monsters: Monster[];
  airstrikes: Airstrike[];
  redBarrages: RedBarrage[];
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
  | { type: "end_game" }
  | { type: "input"; up: boolean; down: boolean; left: boolean; right: boolean; boost: boolean; aimAngle?: number }
  | { type: "shoot"; big?: boolean }
  // Starts charging a hold-then-release ultimate (currently just Dark's
  // sniper) — releasing sends the existing "shoot" message with big: true.
  | { type: "charge_ultimate" }
  // Commits a "target" skin's ultimate (currently just Red's barrage) at a
  // world point the client picked entirely on its own — see
  // ULTIMATE_ACTIVATION_MODE's "target" mode doc for why there's no
  // separate "start aiming" message the way charge-mode skins have one.
  | { type: "throw_bomb"; x: number; y: number }
  | { type: "use_item"; kind: ItemKind }
  | { type: "leave_room" };

export type TankServerMessage =
  | { type: "state"; state: TankPublicState }
  | { type: "kicked" }
  | { type: "error"; message: string };
