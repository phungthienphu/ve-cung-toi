import type { TANK_SKINS, TANK_TIME_OF_DAY } from "./config";
import type { causeCode } from "./rules";

export interface TankMapDef {
  id: string;
  name: string;
  // Which real tile art to use for floor rendering — purely a client
  // concern, but kept on the map def so it travels with mapId.
  terrain: "grass" | "sand";
  // '#' = wall, '.' = empty floor, 'H' = natural hazard (spikes), 'B' = bush,
  // 'I' = slippery ice, 'S' = smoke cover, 'N' = snow ground (purely a visual
  // floor variant for now, no gameplay effect — same "walkable, cosmetic"
  // category as 'R' below until it gets its own mechanic),
  // 'C' = wooden crate (blocks movement/bullets
  // until rammed — then it gets shoved like a tank being pushed), 'R' = road
  // (purely cosmetic — walkable exactly like '.', just rendered as a path
  // auto-tiled from its 'R' neighbors), 'T' = rail track (purely cosmetic
  // for now — walkable ground art, laid down ahead of a future moving-train
  // hazard that would travel along it).
  layout: string[];
}

export type TankSkin = (typeof TANK_SKINS)[number];

export type Team = "A" | "B";

/** Per-skin "R" ultimate energy meter — every skin gets its own unique skill
 * built on this same slot/button, so a skill's power level is balanced by how
 * fast its meter fills rather than all 8 sharing one fixed cooldown. Skins
 * not yet redesigned fall back to the historical shared defaults above. */
export interface UltimateEnergyConfig {
  maxEnergy: number;
  regenPerTick: number;
}

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

export type Direction = "up" | "down" | "left" | "right";

export type ItemKind = "health" | "trap" | "blind" | "shield" | "fire" | "emp";

export type BulletKind = "normal" | "blind" | "big" | "fire" | "emp";

export interface TankPlayer {
  inputAck?: number;
  bot?: boolean;
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
  // EMP item: non-null while the cannon is jammed — see EMP_JAM_DURATION_MS
  // and tank-server.ts's isWeaponJammed. Reset alongside
  // stunnedUntil/blindedUntil/burningUntil.
  weaponJammedUntil: number | null;
  boostEnergy: number;
  isBoosting: boolean;
  ultimateEnergy: number;
  shieldHitsLeft: number;
  fireShotsLeft: number;
  // Normal-shot magazine — see AMMO_MAX_ROUNDS. Regenerates passively every
  // tick (players-tick.ts), consumed one at a time in handleShoot.
  ammo: number;
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

/** What actually goes out over the wire for a player every tick — omits
 * fields that only matter to the server's own physics/easing math (ice's
 * velocity accumulator, the hook pull's from/to/until bookkeeping — the
 * client only ever needs the *result* the server already baked into x/y
 * every tick, not how it got there — and burn's damage-attribution owner
 * id), plus `name`/`color`/`team`, which barely ever change during a match
 * (join, a lobby re-pick, or a team switch) but would otherwise get
 * re-sent unchanged on every single tick. Those three travel instead on the
 * separate, only-sent-on-change "roster" message — see PlayerRosterEntry —
 * and the client re-merges them locally. Broadcast every tick for every
 * player, so trimming this is a standing bandwidth/CPU saving rather than
 * only mattering during a combat spike. */
export type PublicTankPlayer = Omit<
  TankPlayer,
  | "hookPullUntil"
  | "hookPullFromX"
  | "hookPullFromY"
  | "hookPullToX"
  | "hookPullToY"
  | "burnOwnerId"
  | "name"
  | "color"
  | "team"
>;

/** The part of a player that's essentially static for the whole match —
 * broadcast only when it actually changes (join, a lobby name/color
 * re-pick, a team switch), not every tick. The client keeps its own map of
 * these by id and merges them onto the per-tick PublicTankPlayer rows
 * itself; see useTankRoom.ts. */
export interface PlayerRosterEntry {
  id: string;
  name: string;
  color: string;
  team: Team;
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
  // Index into DAMAGE_CAUSES — see there for why this isn't the readable
  // string directly.
  causeCode: number;
  // Per-bullet travel speed (px/tick) — lets a skill's own bullet (e.g.
  // Dark's sniper round) fly faster than the shared BULLET_SPEED default
  // without needing a whole separate bullet kind.
  speed: number;
  // Ticks left before this bullet despawns on its own even if it never hits
  // anything — computed once at creation from BULLET_MAX_RANGE_PX (or
  // BULLET_BIG_MAX_RANGE_PX for a "big"/ultimate shot) divided by speed, so
  // every bullet has roughly the same real-world range regardless of how
  // fast it travels. Without this, a shot fired into open space (or a big
  // volley like Green's) would keep flying until it happened to reach a
  // wall, which on a large map meant a lot of simultaneously-live bullets
  // padding out every tick's broadcast for no gameplay reason.
  ticksLeft: number;
}

/** What a bullet actually needs to be over the wire — no client ever reads
 * causeCode/speed/ticksLeft (those are pure server-side damage-attribution
 * and physics bookkeeping). With up to MAX_BULLETS_TOTAL bullets re-sent in
 * full every tick (see TankStateDelta's doc — unlike players/monsters,
 * bullets aren't diffed since x/y change every tick anyway), trimming these
 * 3 of 9 fields meaningfully cuts the JSON size of the busiest broadcasts,
 * which is exactly the case that scales with how many players are shooting
 * at once. See toPublicBullet in party/tank/geometry.ts. */
export type PublicBullet = Pick<Bullet, "id" | "ownerId" | "x" | "y" | "angle" | "kind">;

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

// ~3 shots to blow one apart

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

// buffer so one tick of latency doesn't flicker the buff off right at the edge

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

/** Same idea as PublicTankPlayer — the client only needs where a monster
 * ended up (x/y, already eased server-side), not the bookkeeping behind it. */
export type PublicMonster = Omit<Monster, "spawnOffsetX" | "spawnOffsetY" | "hookPullUntil" | "hookPullFromX" | "hookPullFromY" | "hookPullToX" | "hookPullToY">;

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

export type TankTimeOfDay = (typeof TANK_TIME_OF_DAY)[number];

export type TankRoomStatus = "lobby" | "playing" | "ended";

export type TankRoomMode = "ffa" | "team" | "practice";

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
  players: PublicTankPlayer[];
  bullets: PublicBullet[];
  pickups: Pickup[];
  traps: Trap[];
  crates: Crate[];
  monsters: PublicMonster[];
  airstrikes: Airstrike[];
  redBarrages: RedBarrage[];
  impacts: TankImpact[];
  kills: TankKillEvent[];
  mapId: string;
  timeOfDay: TankTimeOfDay;
  killTarget: number;
  teamScores: Record<Team, number>;
  winnerId: string | null;
  winningTeam: Team | null;
  matchEndsAt: number | null;
  serverNow: number;
  botDifficulty?: "easy" | "normal" | "hard";
}

/** A per-tick patch for one player/monster: `id` plus only the fields that
 * actually changed since the last thing broadcast (full or delta) — see
 * diffPlayer/diffMonster in party/tank/geometry.ts. Unchanged fields are
 * simply absent, not `undefined`, so the client's merge (Object.assign-style
 * spread) leaves them exactly as they were. */
export type PlayerDelta = { id: string } & Partial<Omit<PublicTankPlayer, "id">>;

export type MonsterDelta = { id: string } & Partial<Omit<PublicMonster, "id">>;

/** The per-tick "what changed" message sent while a match is in progress,
 * instead of the full TankPublicState — see broadcastStateDelta in
 * tank-server.ts. Only players/monsters are actually diffed (they're the
 * only rows that are frequently *unchanged* tick-to-tick); the remaining
 * arrays (pickups, traps, ...) are small and/or change membership every
 * tick anyway, so they're just sent in full here too. Bullets are the one
 * exception worth noting (up to MAX_BULLETS_TOTAL of them under heavy fire)
 * — not diffed either, since x/y move every tick regardless, but trimmed to
 * PublicBullet's smaller field set for exactly that reason. Anything NOT present
 * on this type (roomId, status, mode, hostId, mapId, killTarget) can only
 * change through an event that already triggers a full "state" broadcast
 * (join/leave, start/end game, ...), so the client keeps whatever it last
 * had for those. */
export interface TankStateDelta {
  players: PlayerDelta[];
  removedPlayerIds: string[];
  monsters: MonsterDelta[];
  removedMonsterIds: string[];
  bullets: PublicBullet[];
  pickups: Pickup[];
  traps: Trap[];
  crates: Crate[];
  airstrikes: Airstrike[];
  redBarrages: RedBarrage[];
  impacts: TankImpact[];
  kills: TankKillEvent[];
  timeOfDay: TankTimeOfDay;
  teamScores: Record<Team, number>;
  winnerId: string | null;
  winningTeam: Team | null;
  matchEndsAt: number | null;
  serverNow: number;
  botDifficulty?: "easy" | "normal" | "hard";
}

export type TankClientMessage =
  | { type: "join"; playerId: string; name: string; color: string }
  | { type: "choose_team"; team: Team }
  | { type: "choose_color"; color: string }
  | { type: "set_mode"; mode: TankRoomMode }
  | { type: "set_bots"; count: number; difficulty: "easy" | "normal" | "hard" }
  | { type: "start_game"; mapId: string }
  | { type: "play_again" }
  | { type: "end_game" }
  | { type: "input"; up: boolean; down: boolean; left: boolean; right: boolean; boost: boolean; aimAngle?: number; seq?: number }
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
  // The per-tick "what changed" message sent while a match is ticking — see
  // TankStateDelta. Only ever follows a "state" message the recipient has
  // already seen; never sent to a connection that hasn't gotten one yet.
  | { type: "state_delta"; delta: TankStateDelta }
  // Sent whenever the roster actually changes (join, rename/recolor, team
  // switch, leave) instead of every tick — see PlayerRosterEntry.
  | { type: "roster"; players: PlayerRosterEntry[] }
  | { type: "kicked" }
  | { type: "error"; message: string };
