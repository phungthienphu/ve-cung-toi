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
  // '#' = wall, '.' = empty floor, 'H' = natural hazard (spikes), 'B' = bush,
  // 'I' = slippery ice, 'S' = smoke cover
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
      "#...RRRRRRRR.IIIC.........B...#",
      "#B.BR....#####.....#######....#",
      "#...R....#...#.....#######....#",
      "#...R....#...#.....#..........#",
      "#...RRRRR#...#.....#........C.#",
      "#....###R.......HHH#..........#",
      "#....###R........H....######..#",
      "#.......R...SSS..H....######..#",
      "#.......RRRRRRRR....RRRRRR....#",
      "#.......####...R....R....R....#",
      "#.....B.####RRRCRRRRR....R.R..#",
      "#.......####IIIR.......B.R.R..#",
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
      "#....####...####..III####....####...#",
      "#B.B.####...###RRRRRRR###....####...#",
      "#.RRRRRRRRRRR###.R.......C...####...#",
      "#...........R....R##RRRRRRRRR####...#",
      "#...###...##R#...R###.......R.C.....#",
      "#...###...##R#...R###.....##R#......#",
      "#...###.....R....RHHH.....##R#......#",
      "#...###.RRRRRRRRRR.H......##R#..###.#",
      "#.......R..SSS####.H........RRRRRRR.#",
      "#......#R##...####..........R..R##R.#",
      "#....C.#R##...####...###RRRRR..R##R.#",
      "#......#R##....III...###R......R..R.#",
      "#......#R##..........###R.HHH..R##R.#",
      "#.......R..###.......###R......R##R.#",
      "#...####RRRRRRR.C.......R..####R##R.#",
      "#...#####..###R...##RRRRRRRRRRRR..R.#",
      "#...#####..HH#R...#####..C.####...R.#",
      "#.....SSS..###R..RRRRRRRRRR......BRB#",
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
      "#.R.....#######...SSS......R..C.......#",
      "#.R..........RR..HHH.......RRRRRR###..#",
      "#.RRRRRRRRRR..R###H#............####..#",
      "#...####...R...###H#............####..#",
      "#...####...R...#####...............RR.#",
      "#...####...R...IIII.RR...C..........R.#",
      "#...####...R.........R######........R.#",
      "#.........HHH.......R#######........R.#",
      "#...SSS....RC.......R......RR....C..R.#",
      "#.....##RRRRRRRRRRRRR.......R######.R.#",
      "#.....######.......CR.......#######.R.#",
      "#.....######........R.......RRRRRRRRR.#",
      "#.........IIII......R.####..R.........#",
      "#............#####..R.####..R.HHH.....#",
      "#............###RRRRRRRRRRRRR..H......#",
      "#...####.....#####....####.....####...#",
      "#...####.....R####.............####...#",
      "#...###RRRRRRR...........HH....R###B.B#",
      "#.......C........SSSS..........R###...#",
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

// Player spawn positions are picked fresh each time (see pickSpawnTile in
// party/tank/geometry.ts) instead of a fixed list of corner points — a
// random open tile, kept away from other players and monster nests, so
// tanks don't keep landing on top of each other or the same handful of
// spots every match/respawn.
// Applied uniformly against both other tanks placed in the same batch and
// every monster nest — a spawn is retried until it clears this distance
// from everything already claimed, falling back to whichever candidate got
// farthest if the map's too tight to fully satisfy it.
export const SPAWN_MIN_DISTANCE_PX = TILE_SIZE * 6;

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
// Ice keeps a tank's velocity between ticks. Input still turns the hull at
// once, but only gradually bends the actual travel vector toward that input.
export const ICE_ACCELERATION = 0.12;
export const ICE_FRICTION = 0.965;
export const ICE_STOP_SPEED = 0.08;
export const BULLET_SIZE = 6;
export const BULLET_SPEED = 6.5; // px/tick
export const FIRE_COOLDOWN_MS = 480; // was 400 — still felt spammable even with the spread penalty below, so slowed the base rate too
export const RESPAWN_DELAY_MS = 1500;
export const TICK_MS = 50; // 20Hz

// LoL/Bang Bang-style health pool: a big number with proportional damage per
// hit, instead of a fixed "3 hits and you're dead" counter — gives room for
// a gradient health bar and percentage-flavored effects (burns, shields).
export const MAX_HP = 100;
export const BULLET_DAMAGE = 20; // 5 clean hits to kill, same feel as before

// A normal shot fired well within FIRE_COOLDOWN_MS of the previous one (i.e.
// holding the trigger down) gets progressively more spread — reset back to
// pinpoint after a short pause. Targets mindless spam specifically without
// touching raw damage/cooldown, which would punish deliberate, well-timed
// shots exactly the same as spam.
export const BULLET_SPREAD_RESET_MS = 500;
export const BULLET_SPREAD_PER_SHOT_DEG = 3.5; // was 2.5 — ramps to max spread faster
export const BULLET_SPREAD_MAX_DEG = 30; // was 14 — a harsher ceiling on sustained spam
export const PICKUP_SIZE = 16;
export const MAX_PICKUPS = 4;
export const PICKUP_SPAWN_INTERVAL_MS = 7000;
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
// Monsters spawn as one pack sharing a single nest (see pickNestCluster in
// monsters-tick.ts) rather than each wandering off completely independently.
export const MONSTER_PACK_SIZE = 4;
// How many separate packs (separate nests) populate one map — more packs
// means monsters spread across the map instead of one single crowded spot.
export const MONSTER_PACK_COUNT = 2;
export const MONSTER_HP_MIN = 2; // each monster rolls its own max HP in this range at spawn —
export const MONSTER_HP_MAX = 4; // not every one of the pack is equally tough.
export const MONSTER_SIZE = TANK_SIZE;
// A pack's members all share one nest anchor and move in lockstep while
// wandering (see the pack-sync pre-pass in monsters-tick.ts) — without this,
// they'd sit exactly on top of each other forever and read as a single
// monster. Each member gets a small fixed offset from the shared nest point
// (applied at spawn and respawn, not to the shared nestX/nestY itself, so
// pack-grouping/puddle-healing logic still treats them as one pack).
export const MONSTER_SPAWN_SPREAD_RADIUS = TILE_SIZE * 0.4;
export const MONSTER_SPEED = 1.3;
export const MONSTER_CHASE_SPEED_MULTIPLIER = 1.4;
// Lowered (and the cooldown lengthened) once monsters started traveling in
// packs of 4 — several of them touching the same tank at once no longer
// stacks into a near-instant kill.
export const MONSTER_DAMAGE = 6;
export const MONSTER_CONTACT_COOLDOWN_MS = 1100;
export const MONSTER_DIR_CHANGE_MS = 1800;
export const MONSTER_RESPAWN_DELAY_MS = 6000;
export const MONSTER_NEST_RADIUS = 90; // wander leash while passive
export const MONSTER_CHASE_LEASH_RADIUS = 170; // gives up the chase past this from its nest
export const MONSTER_REST_CHANCE = 0.4; // odds it pauses instead of picking a new direction
export const MONSTER_REST_DURATION_MS = 2500;

// A monster's nest is marked on the ground by a mud/water puddle — stepping
// into it douses a burning tank, and a monster resting in its own puddle (or
// hiding in any bush) slowly heals back up.
export const NEST_PUDDLE_RADIUS = 34; // a proper pond, not a puddle — also the douse/heal radius
export const MONSTER_AGGRO_TIMEOUT_MS = 4000; // must be refreshed by another hit or it drops
// A monster's max HP is small (2-4) — a per-tick fractional regen wouldn't
// read as anything, so it heals in whole-HP steps on an interval instead.
export const MONSTER_HEAL_INTERVAL_MS = 4000;

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
  // Stun is strong utility even at low damage — charges noticeably slower
  // than the shared baseline to compensate (~14s instead of ~10s).
  sand: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: 0.36 },
  bigRed: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: ULTIMATE_REGEN_PER_TICK },
  // A team-wide 8s full damage immunity is much stronger than Sand's 1s
  // single-target stun (which already got a slower regen than default) —
  // scaled down further so it reads as a cooldown-gated team defensive
  // move, not something that's up most of the fight.
  darkLarge: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: 0.2 },
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
export const RAPID_FIRE_COOLDOWN_MS = 140; // vs. the normal FIRE_COOLDOWN_MS

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
  damageDealt: number;
  damageTaken: number;
  deaths: number;
  velocityX: number;
  velocityY: number;
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
  // Sand's ultimate (and generically, anyone stunned in the future): can't
  // move or act until this timestamp passes. Unlike the per-skin fields
  // above, this is a status effect inflicted by someone else, so it's reset
  // alongside blindedUntil/burningUntil rather than via resetSkillState.
  stunnedUntil: number | null;
  // Huge's ultimate: non-null while dashing (the timestamp it ends) — while
  // set, movement is forced along `dashAngle` regardless of input. Reset via
  // resetSkillState like the other per-skin fields above.
  dashUntil: number | null;
  dashAngle: number;
  // bigRed's hook: set alongside stunnedUntil to the same timestamp whenever
  // the stun came from being hooked, purely so the client can draw the
  // electric-arcs-and-barrel "pinned" look instead of the generic dizzy-stars
  // stun overlay — doesn't gate anything server-side beyond what stunnedUntil
  // already does. Reset alongside stunnedUntil/blindedUntil/burningUntil.
  hookedUntil: number | null;
  // bigRed's hook, the actual yank: non-null while the pull's eased travel
  // (see HOOK_PULL_DURATION_MS) is still underway — players-tick.ts
  // interpolates x/y from hookPullFrom* to hookPullTo* every tick while set,
  // instead of teleporting the target there in one frame. Reset alongside
  // stunnedUntil/blindedUntil/burningUntil.
  hookPullUntil: number | null;
  hookPullFromX: number;
  hookPullFromY: number;
  hookPullToX: number;
  hookPullToY: number;
  // darkLarge's ultimate, the caster's own side: non-null while this
  // player's shield aura is currently emitting (see stepShieldAuras in
  // skills.ts). Reset via resetSkillState like the other per-skin fields.
  shieldAuraUntil: number | null;
  // darkLarge's ultimate, the beneficiary side: non-null while this player
  // (an ally, or darkLarge itself) is currently standing inside someone's
  // active aura — refreshed every tick they stay in range, checked in
  // combat.ts's damagePlayer to block damage outright. Unlike shieldHitsLeft,
  // being under this never locks movement. Reset alongside
  // stunnedUntil/blindedUntil/burningUntil.
  auraShieldUntil: number | null;
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
  cause: DamageCause;
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

// Sand's ultimate: an instant sinking-sand shockwave fanned out from the
// tank along its current aim — a rectangle SAND_WAVE_RANGE long by
// SAND_WAVE_WIDTH wide (roughly 3 bullets' worth of lane), low damage but
// knocks anyone caught in it back and stuns them, both cheap to land and
// cheap to eat since the payoff is control, not raw damage.
export const SAND_WAVE_DAMAGE = 10;
export const SAND_WAVE_RANGE = TILE_SIZE * 5.5;
export const SAND_WAVE_WIDTH = TILE_SIZE * 3;
export const SAND_WAVE_KNOCKBACK_DIST = TILE_SIZE * 2;
export const SAND_WAVE_STUN_MS = 1000;

// Huge's ultimate: a forced-movement dash along the current aim, passing
// straight through other tanks (not blocked by them, unlike normal
// movement) but still stopped by walls. No direct damage — purely a
// mobility/disruption tool, the payoff is scattering an enemy formation and
// closing distance fast, not raw damage (its high HP pool is what pays for
// diving in). Anyone caught within DASH_KNOCKBACK_RADIUS while it's underway
// gets knocked outward, at most once per dash.
export const DASH_DURATION_MS = 400;
export const DASH_SPEED = 11; // px/tick — vs. TANK_SPEED's 2.4
export const DASH_KNOCKBACK_RADIUS = TANK_SIZE * 2.4;
export const DASH_KNOCKBACK_DIST = TILE_SIZE * 2;

// bigRed's ultimate: an instant hook skillshot along the current aim — a
// narrow HOOK_RANGE-long by HOOK_WIDTH-wide corridor (a precision pick, not
// an AoE like Sand's wave). The closest target caught in it gets yanked to
// HOOK_PULL_DISTANCE in front of bigRed, takes a flat hit of damage, and is
// stunned — long enough for bigRed's follow-up shots to land before the
// target can react or flee.
export const HOOK_RANGE = TILE_SIZE * 6.5;
export const HOOK_WIDTH = TANK_SIZE * 1.1;
export const HOOK_PULL_DISTANCE = TANK_SIZE * 1.2;
export const HOOK_DAMAGE = 8;
export const HOOK_STUN_MS = 900;
// Full flow: chain snaps out (HOOK_THROW_MS) — nothing happens to the target
// until it actually lands — then damage/stun kick in the instant it lands,
// then it reels back in over HOOK_PULL_DURATION_MS (eased, not linear) with
// the target in tow, instead of the whole thing resolving and snapping the
// target to its final spot in a single instant. Both stages together are
// well inside HOOK_STUN_MS, so the target is already stunned and stays
// stopped for the rest of it once the reel finishes.
export const HOOK_THROW_MS = 160;
export const HOOK_PULL_DURATION_MS = 220;

// Green's ultimate: GREEN_BURST_VOLLEYS rings of GREEN_BURST_BULLET_COUNT
// bullets each, spaced evenly around a full circle and fired
// GREEN_BURST_INTERVAL_MS apart — each pellet does plain normal-bullet
// damage, the payoff is area coverage over 3 waves rather than one
// overtuned hit. Doesn't lock movement, unlike Sand/Huge/bigRed's ultimates.
export const GREEN_BURST_BULLET_COUNT = 12;
export const GREEN_BURST_VOLLEYS = 3;
export const GREEN_BURST_INTERVAL_MS = 220;

// darkLarge's ultimate: a mobile damage-immunity bubble around the tank
// itself, refreshed onto any ally still inside DARKLARGE_AURA_RADIUS every
// tick while the channel (DARKLARGE_AURA_DURATION_MS) is up. Unlike the item
// shield (shieldHitsLeft), this blocks damage outright while it's active
// instead of a fixed number of hits, and never locks movement — darkLarge
// and its allies keep fighting/repositioning normally. See damagePlayer in
// combat.ts for where it actually blocks damage.
export const DARKLARGE_AURA_DURATION_MS = 8000;
export const DARKLARGE_AURA_RADIUS = TILE_SIZE * 3.5;
export const DARKLARGE_AURA_GRACE_MS = 200; // buffer so one tick of latency doesn't flicker the buff off right at the edge

export interface Monster {
  id: string;
  x: number;
  y: number;
  dir: Direction;
  alive: boolean;
  hp: number;
  // Rolled once at spawn (MONSTER_HP_MIN..MONSTER_HP_MAX) — not every
  // monster in a pack is equally tough.
  maxHp: number;
  respawnAt: number | null;
  nestX: number;
  nestY: number;
  aggroPlayerId: string | null;
  // Fixed per-monster offset from the pack's shared nestX/nestY — see
  // MONSTER_SPAWN_SPREAD_RADIUS. Applied at spawn and respawn so pack
  // members never land exactly on top of each other or each other's own
  // respawn point, while nestX/nestY itself stays the shared pack anchor.
  spawnOffsetX: number;
  spawnOffsetY: number;
  // Same eased-yank mechanism as TankPlayer's hookPull* fields — see there.
  hookPullUntil: number | null;
  hookPullFromX: number;
  hookPullFromY: number;
  hookPullToX: number;
  hookPullToY: number;
}

/** A single-tick "something happened here" event — purely cosmetic, consumed
 * client-side to spawn a spark/skid-mark ("shove") or a trap-triggered burst
 * ("trap") effect at (x, y). */
export interface TankImpact {
  id: string;
  x: number;
  y: number;
  kind: "shove" | "trap" | "shield" | "crate" | "bomb" | "sand_wave" | "hook";
  // Only set for "bomb" — the blast radius that hit, so the client's
  // explosion visual scales to match instead of always looking the same size.
  radius?: number;
  // Only set for "sand_wave" — the direction it fanned out in, so the client
  // can draw the same cone shape the server used to resolve hits.
  angle?: number;
  // Only set for "hook" — where the chain's far end landed (the target's
  // position at the moment it got hit, before any pull was applied, or the
  // hook's max range on a whiff). (x, y) is the near end (bigRed's own
  // position), carried by the impact's own x/y fields as usual.
  x2?: number;
  y2?: number;
  // Only set for "hook" — how long this particular chain visual should play
  // (the throw-out and reel-in stages have different durations); falls back
  // to a sane default on the client if absent.
  durationMs?: number;
}

/** A single-tick elimination event — consumed client-side to show a
 * PUBG-style kill-feed line for a few seconds. `killerName` is null for
 * environmental deaths; `cause` is declared at each damage source. */
export interface TankKillEvent {
  id: string;
  killerName: string | null;
  victimName: string;
  cause: DamageCause;
}

export type DamageCause =
  | "Đạn thường"
  | "Đạn lớn"
  | "Bắn tỉa"
  | "Đạn lửa"
  | "Thiêu đốt"
  | "Bẫy"
  | "Móc câu"
  | "Sóng cát"
  | "Quái vật"
  | "Chông"
  | "Không kích"
  | "Pháo kích";

export type TankRoomStatus = "lobby" | "playing" | "ended";

export type TankRoomMode = "ffa" | "team" | "practice";
export const TANK_ROOM_MODE_LABELS: Record<TankRoomMode, string> = {
  ffa: "Đấu tự do",
  team: "Đấu đội",
  practice: "Luyện tập",
};

/** One entry in the public room list (tank-directory party) — what the
 * tank-game home screen shows for each open lobby, so people can join
 * without knowing a room code in advance. Deliberately excludes anything
 * player-identifying (names, colors) since this is fetched by anyone who
 * loads the home page, not just people already in the room. */
export interface TankRoomListing {
  roomId: string;
  playerCount: number;
  mode: TankRoomMode;
  status: TankRoomStatus;
}

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
  | { type: "choose_color"; color: string }
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
