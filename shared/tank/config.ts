import type { TankMapDef, TankSkin, ItemKind, UltimateEnergyConfig, UltimateActivationMode, DamageCause, TankRoomMode } from "./models";

export const TILE_SIZE = 32;

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
      "#B.B....RRRRRRR...............#",
      "#......R......R....##.##......#",
      "#..####R......R....#...#......#",
      "#..#...RRRRR...R...#...#..C...#",
      "#..#.......R...R...#####......#",
      "#..#...###.R.HRR..............#",
      "#..#...#...RRRR....SSS........#",
      "#..#####.......####S.S####....#",
      "#.........C....#..SSS..#......#",
      "#.....RRRRRRRRRR.......#......#",
      "#...B.R.......#....C...#####..#",
      "#.....R..III..#..........C....#",
      "#.....RRRRRRRR#####...........#",
      "#...........H...#..RRRRRR.....#",
      "#..###........####R....#......#",
      "#..#.....HHH...........#......#",
      "#..B.......................B.B#",
      "###############################",
    ],
  },
  {
    id: "maze",
    name: "Mê cung",
    terrain: "grass",

    layout: [
      "#####################################",
      "#B.B..............#.................#",
      "#.R...####........#......###....N...#",
      "#BRB...##....C....#......###..NNNN..#",
      "#.RRRRRRRRRRRRR...#...........NNN...#",
      "#....#........R...#####.............#",
      "#....#..###...R.......#....###......#",
      "#....#..#.....R.HHH...#....#........#",
      "#....####.....R...H...#....#..III...#",
      "#.............R...H...#....#..III...#",
      "#..#####......RRRRRRR.#....#####....#",
      "#..#...#..C.........R.#.............#",
      "#..#...#######.......R....C.........#",
      "#..#.........#.......RRRRRRRRR......#",
      "#..#####.....#..SSSS....#...........#",
      "#.............#..SSSS....#..###.....#",
      "#....###......#....S.....#..###.....#",
      "#....#....HHH.#########..#..........#",
      "#....#..........C.......#####.......#",
      "#....#####RRRRRRRRRRRR...........B.B#",
      "#B...............R.....C.......B....#",
      "#..RRRRRRRRRRRRRRR....N......B.B....#",
      "#..............S..RRRRNNNN..........#",
      "#.................RRRRRR..........B.#",
      "#####################################",
    ],
  },
  {
    id: "field",
    name: "Sa mạc mở",
    terrain: "sand",

    layout: [
      "#######################################",
      "#B.B.TTTTTTTTTTTTTTTTTTTTT............#",
      "#.R..T..............C......T..........#",
      "#BRB.T..######......RRRRR..T..B.B.....#",
      "#.R..T..######..H...R...R..T..C.......#",
      "#.RRR...######......R.I.RRRRRRR###....#",
      "#...R..............RRRIIIR....####....#",
      "#...RRRRRRRRRRR....R...IR....####.....#",
      "#.........C...R....R...IR.............#",
      "#..SSS........RRRRRRR...IRRRR.........#",
      "#..S.S...####......R.....I...###......#",
      "#..SSS...####..H...RRRRRRRR..###......#",
      "#........####.........C....R..........#",
      "#....###..............RRRRRR..........#",
      "#....###....HHH...#####....R..........#",
      "#....###.........C...#.....R..........#",
      "#........#####......#....RRRRRRRR.....#",
      "#........#####...C..#.................#",
      "#....C..........H...#......HHH........#",
      "#..RRRRRRRRRRRRRRRRRRRR.....R.........#",
      "#..R..................R.....R..B.B....#",
      "#..R....#####.........RRRRRRRRRRR.....#",
      "#..R....#####.....C...............B.B.#",
      "#..RRRRRRRRRRRRRRRRRRRRRRRRR..........#",
      "#######################################",
    ],
  },
];

export const DEFAULT_MAP_ID = TANK_MAPS[0].id;

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

export const MAX_TANK_PLAYERS = 8;

export const MIN_TANK_PLAYERS = 2;

export const KILL_TARGET = 5;

export const MATCH_DURATION_MS = 4 * 60 * 1000;

// 4-minute match clock

export const TICK_MS = 1000 / 30;

export const SNAPSHOT_MS = TICK_MS * 2;

export const STEP_SCALE = TICK_MS / 65;

export const TANK_SIZE = 22;

export const TANK_SPEED = 2.4 * STEP_SCALE;

// px/tick
// Ice keeps a tank's velocity between ticks. Input still turns the hull at
// once, but only gradually bends the actual travel vector toward that input.
export const ICE_ACCELERATION = 1 - Math.pow(1 - 0.12, STEP_SCALE);

export const ICE_FRICTION = Math.pow(0.965, STEP_SCALE);

export const ICE_STOP_SPEED = .08 * STEP_SCALE;

export const BULLET_SIZE = 6;

export const BULLET_SPEED = 6.5 * STEP_SCALE;

// px/tick
export const FIRE_COOLDOWN_MS = 480;

// was 400 — still felt spammable even with the spread penalty below, so slowed the base rate too
export const RESPAWN_DELAY_MS = 1500;

// LoL/Bang Bang-style health pool: a big number with proportional damage per
// hit, instead of a fixed "3 hits and you're dead" counter — gives room for
// a gradient health bar and percentage-flavored effects (burns, shields).
export const MAX_HP = 100;

export const BULLET_DAMAGE = 20;

// 5 clean hits to kill, same feel as before

// A normal shot fired well within FIRE_COOLDOWN_MS of the previous one (i.e.
// holding the trigger down) gets progressively more spread — reset back to
// pinpoint after a short pause. Targets mindless spam specifically without
// touching raw damage/cooldown, which would punish deliberate, well-timed
// shots exactly the same as spam.
export const BULLET_SPREAD_RESET_MS = 500;

export const BULLET_SPREAD_PER_SHOT_DEG = 3.5;

// was 2.5 — ramps to max spread faster
export const BULLET_SPREAD_MAX_DEG = 30;

// was 14 — a harsher ceiling on sustained spam
export const PICKUP_SIZE = 16;

export const MAX_PICKUPS = 4;

export const PICKUP_SPAWN_INTERVAL_MS = 7000;

export const PICKUP_HEAL_AMOUNT = 35;

// Odds a freshly-spawned map pickup is each kind (must sum to 1). Shield is
// deliberately excluded here — it only ever drops from a killed monster, so
// its weight stays 0 for this general spawner.
export const PICKUP_WEIGHTS: Record<ItemKind, number> = { health: 0.3, trap: 0.175, blind: 0.175, fire: 0.175, emp: 0.175, shield: 0 };

// Odds a killed monster's drop is each kind (must sum to 1) — separate table
// from PICKUP_WEIGHTS since shield is only ever reachable this way, so it
// gets a real slice here instead of every monster kill dropping the exact
// same thing every time.
export const MONSTER_DROP_WEIGHTS: Record<ItemKind, number> = { health: 0.25, trap: 0.125, blind: 0.125, fire: 0.125, emp: 0.125, shield: 0.25 };

export const TRAP_DAMAGE = 30;

export const TRAP_SIZE = 18;

export const BLIND_DURATION_MS = 5000;

export const VISION_RADIUS = 110;

// px around the blinded player's own tank

// EMP item: the next hit jams the target's cannon instead of dealing damage
// — same "fire a special bullet, apply a status effect on hit" shape as
// blind, just disabling the weapon instead of vision. See TankPlayer's
// weaponJammedUntil and tank-server.ts's isWeaponJammed for where it's
// actually enforced (blocks every attack action, not just the plain shot
// trigger — see the doc there for why).
export const EMP_JAM_DURATION_MS = 3000;

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

export const MONSTER_HP_MIN = 2;

// each monster rolls its own max HP in this range at spawn —
export const MONSTER_HP_MAX = 4;

// not every one of the pack is equally tough.
export const MONSTER_SIZE = TANK_SIZE;

// A pack's members all share one nest anchor and move in lockstep while
// wandering (see the pack-sync pre-pass in monsters-tick.ts) — without this,
// they'd sit exactly on top of each other forever and read as a single
// monster. Each member gets a small fixed offset from the shared nest point
// (applied at spawn and respawn, not to the shared nestX/nestY itself, so
// pack-grouping/puddle-healing logic still treats them as one pack).
export const MONSTER_SPAWN_SPREAD_RADIUS = TILE_SIZE * 0.4;

export const MONSTER_SPEED = 1.3 * STEP_SCALE;

export const MONSTER_CHASE_SPEED_MULTIPLIER = 1.4;

// Lowered (and the cooldown lengthened) once monsters started traveling in
// packs of 4 — several of them touching the same tank at once no longer
// stacks into a near-instant kill.
export const MONSTER_DAMAGE = 6;

export const MONSTER_CONTACT_COOLDOWN_MS = 1100;

export const MONSTER_DIR_CHANGE_MS = 1800;

export const MONSTER_RESPAWN_DELAY_MS = 6000;

export const MONSTER_NEST_RADIUS = 90;

// wander leash while passive
export const MONSTER_CHASE_LEASH_RADIUS = 170;

// gives up the chase past this from its nest
export const MONSTER_REST_CHANCE = 0.4;

// odds it pauses instead of picking a new direction
export const MONSTER_REST_DURATION_MS = 2500;

// A monster's nest is marked on the ground by a mud/water puddle — stepping
// into it douses a burning tank, and a monster resting in its own puddle (or
// hiding in any bush) slowly heals back up.
export const NEST_PUDDLE_RADIUS = 34;

// a proper pond, not a puddle — also the douse/heal radius
export const MONSTER_AGGRO_TIMEOUT_MS = 4000;

// must be refreshed by another hit or it drops
// A monster's max HP is small (2-4) — a per-tick fractional regen wouldn't
// read as anything, so it heals in whole-HP steps on an interval instead.
export const MONSTER_HEAL_INTERVAL_MS = 4000;

// Boost is a built-in ability every tank has (hold to sprint), gated by an
// energy meter rather than a pickup — drains while boosting, regenerates
// on its own once you let go.
export const MAX_BOOST_ENERGY = 100;

export const BOOST_DRAIN_PER_TICK = 1.6 * STEP_SCALE;

// ~3s of sprint on a full bar at 20Hz
export const BOOST_REGEN_PER_TICK = .5 * STEP_SCALE;

// ~10s to refill from empty
export const BOOST_SPEED_MULTIPLIER = 1.8;

// A plain normal shot draws from a small magazine instead of firing forever
// on cooldown alone — on top of the spread-on-spam penalty above, this puts
// a hard ceiling on a burst before the player is forced to actually wait,
// then trickles back one round at a time rather than an instant full
// refill. Doesn't apply to a "big"/ultimate shot, fire ammo (already its
// own limited resource), or Blue's rapid-fire window (going fast on purpose
// is that skill's whole point) — same exemptions as BULLET_SPREAD above.
export const AMMO_MAX_ROUNDS = 4;

export const AMMO_REGEN_MS_PER_ROUND = 2000;

// time to regen one round from empty
export const AMMO_REGEN_PER_TICK = TICK_MS / AMMO_REGEN_MS_PER_ROUND;

// Inventory: up to 3 different pickup kinds held at once, each consumed the
// moment it's used (no stacking, no duplicates of the same kind).
export const MAX_HELD_ITEMS = 3;

// Default built-in skill every tank has regardless of pickups: a heavy shot
// worth double normal bullet damage, gated by its own energy meter that only
// fills passively over time — separate from the boost meter. This is the
// fallback for any skin that doesn't (yet) have its own entry in
// ULTIMATE_CONFIG below.
export const MAX_ULTIMATE_ENERGY = 100;

export const ULTIMATE_REGEN_PER_TICK = .5 * STEP_SCALE;

// ~10s to charge from empty at 20Hz
export const ULTIMATE_DAMAGE_MULTIPLIER = 3;

export const ULTIMATE_CONFIG: Record<TankSkin, UltimateEnergyConfig> = {
  // Rapid fire is low-power/low-risk (no burst damage, no CC) — charges
  // faster than the shared baseline so it's worth using often.
  blue: { maxEnergy: 100, regenPerTick: 0.625 * STEP_SCALE }, // ~8s to charge from empty
  dark: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: ULTIMATE_REGEN_PER_TICK },
  green: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: ULTIMATE_REGEN_PER_TICK },
  red: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: ULTIMATE_REGEN_PER_TICK },
  // Stun is strong utility even at low damage — charges noticeably slower
  // than the shared baseline to compensate (~14s instead of ~10s).
  sand: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: 0.36 * STEP_SCALE },
  bigRed: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: ULTIMATE_REGEN_PER_TICK },
  // A team-wide 8s full damage immunity is much stronger than Sand's 1s
  // single-target stun (which already got a slower regen than default) —
  // scaled down further so it reads as a cooldown-gated team defensive
  // move, not something that's up most of the fight.
  darkLarge: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: 0.2 * STEP_SCALE },
  huge: { maxEnergy: MAX_ULTIMATE_ENERGY, regenPerTick: ULTIMATE_REGEN_PER_TICK },
};

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
export const RAPID_FIRE_DURATION_MS = 3000;

export const RAPID_FIRE_COOLDOWN_MS = 140;

// vs. the normal FIRE_COOLDOWN_MS

// Dark's ultimate: press R to toggle on a scope (shows a telegraphed line
// everyone can see and react to, following the mouse freely — no need to
// hold anything down), then fire with the normal shoot trigger (Space/left
// click/the touch fire button) to release the shot at the current aim.
// Damage stays the same as a normal ultimate (ULTIMATE_DAMAGE_MULTIPLIER),
// but the round travels much faster than any other bullet.
export const SNIPER_BULLET_SPEED = 12 * STEP_SCALE;

// vs. the normal BULLET_SPEED (6.5)
export const SNIPER_MAX_CHARGE_MS = 6000;

// auto-fires if left scoped this long without firing
export const SNIPER_SCOPE_RANGE = 700;

// px — how far the telegraph line reaches if it hits no wall first

// Follow-camera viewport (MOBA-style zoomed-in view) — the client only ever
// renders this many pixels around the local player; the rest of the map is
// only visible through the minimap. Purely a client rendering concern (the
// server always simulates/broadcasts full map state), but kept here so the
// tile-size math stays in one place.
export const VIEWPORT_COLS = 19;

export const VIEWPORT_ROWS = 16;

export const VIEWPORT_W = VIEWPORT_COLS * TILE_SIZE;

export const VIEWPORT_H = VIEWPORT_ROWS * TILE_SIZE;

export const BULLET_MAX_RANGE_PX = TILE_SIZE * 4;

// A skill/ultimate shot is a deliberate, energy-gated commitment — it should
// reach noticeably farther than a free-to-spam normal shot.
export const BULLET_BIG_MAX_RANGE_PX = TILE_SIZE * 8;

// Safety net on top of per-player range/magazine limits — if several
// players' bullets still pile up at once (e.g. multiple Green ultimates),
// this caps the total broadcast every tick regardless of source. Oldest
// bullets get dropped first once over the cap.
export const MAX_BULLETS_TOTAL = 180;

export const CRATE_SIZE = 24;

export const CRATE_MAX_HP = 3;

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

export const RED_BOMB_MAX_RANGE = 600;

// px — how far from the tank the target point can be
export const RED_BARRAGE_WARN_MS = 1500;

// delay from commit to the first impact
export const RED_BARRAGE_DURATION_MS = 2000;

// spread of impact times after the warning
export const RED_BARRAGE_BOMB_COUNT = 5;

export const RED_BARRAGE_BOMB_RADIUS = TILE_SIZE * 0.75;

export const RED_BARRAGE_BOMB_DAMAGE = 22;

// all 5 landing on a stationary target is ~lethal
export const RED_BARRAGE_SPREAD_RADIUS = TILE_SIZE * 3;

// how scattered the impacts are around the aim point — was 1.8

// Sand's ultimate: an instant sinking-sand shockwave fanned out from the
// tank along its current aim — a rectangle SAND_WAVE_RANGE long by
// SAND_WAVE_WIDTH wide (roughly 3 bullets' worth of lane), low damage but
// knocks anyone caught in it back and stuns them, both cheap to land and
// cheap to eat since the payoff is control, not raw damage.
export const SAND_WAVE_DAMAGE = 10;

export const SAND_WAVE_RANGE = TILE_SIZE * 6;

export const SAND_WAVE_WIDTH = TILE_SIZE * 5;

export const SAND_WAVE_KNOCKBACK_DIST = TILE_SIZE * 2;

export const SAND_WAVE_STUN_MS = 3000;

// Huge's ultimate: a forced-movement dash along the current aim, passing
// straight through other tanks (not blocked by them, unlike normal
// movement) but still stopped by walls. No direct damage — purely a
// mobility/disruption tool, the payoff is scattering an enemy formation and
// closing distance fast, not raw damage (its high HP pool is what pays for
// diving in). Anyone caught within DASH_KNOCKBACK_RADIUS while it's underway
// gets knocked outward, at most once per dash.
export const DASH_DURATION_MS = 400;

export const DASH_SPEED = 11 * STEP_SCALE;

// px/tick — vs. TANK_SPEED's 2.4
export const DASH_KNOCKBACK_RADIUS = TANK_SIZE * 2.4;

export const DASH_KNOCKBACK_DIST = TILE_SIZE * 2;

// bigRed's ultimate: an instant hook skillshot along the current aim — a
// narrow HOOK_RANGE-long by HOOK_WIDTH-wide corridor (a precision pick, not
// an AoE like Sand's wave). The closest target caught in it gets yanked to
// HOOK_PULL_DISTANCE in front of bigRed, takes a flat hit of damage, and is
// stunned — long enough for bigRed's follow-up shots to land before the
// target can react or flee.
export const HOOK_RANGE = TILE_SIZE * 7.5;

export const HOOK_WIDTH = TANK_SIZE * 1.1;

export const HOOK_PULL_DISTANCE = TANK_SIZE * 1.2;

export const HOOK_DAMAGE = 8;

export const HOOK_STUN_MS = 2000;

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

export const GREEN_BURST_INTERVAL_MS = 330;

// darkLarge's ultimate: a mobile damage-immunity bubble around the tank
// itself, refreshed onto any ally still inside DARKLARGE_AURA_RADIUS every
// tick while the channel (DARKLARGE_AURA_DURATION_MS) is up. Unlike the item
// shield (shieldHitsLeft), this blocks damage outright while it's active
// instead of a fixed number of hits, and never locks movement — darkLarge
// and its allies keep fighting/repositioning normally. See damagePlayer in
// combat.ts for where it actually blocks damage.
export const DARKLARGE_AURA_DURATION_MS = 8000;

export const DARKLARGE_AURA_RADIUS = TILE_SIZE * 3.5;

export const DARKLARGE_AURA_GRACE_MS = 200;

// Every DamageCause, in a fixed order — lets a bullet (broadcast every tick,
// up to MAX_BULLETS_TOTAL of them) carry a 1-2 digit index instead of
// repeating the full Vietnamese label on every single one. TankKillEvent
// (a handful of rows per tick at most) isn't worth the same treatment and
// keeps the readable string.
export const DAMAGE_CAUSES: DamageCause[] = [
  "Đạn thường",
  "Đạn lớn",
  "Bắn tỉa",
  "Đạn lửa",
  "Thiêu đốt",
  "Bẫy",
  "Móc câu",
  "Sóng cát",
  "Quái vật",
  "Chông",
  "Không kích",
  "Pháo kích",
];

// Purely cosmetic — rolled once per match (see tank-server.ts's
// handleStartGame) and broadcast so everyone sees the same lighting rather
// than each client picking its own. The actual tint colors are a client
// rendering concern (see TankCanvas.tsx), not something the simulation
// itself needs to know about.
export const TANK_TIME_OF_DAY = ["day", "sunset", "night"] as const;

export const TANK_ROOM_MODE_LABELS: Record<TankRoomMode, string> = {
  ffa: "Đấu tự do",
  team: "Đấu đội",
  practice: "Luyện tập",
};
