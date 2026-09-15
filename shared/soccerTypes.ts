// Shared types/constants for the 2-team soccer game — mirrors the split
// between shared/tankTypes.ts (data + tuning knobs) and party/tank-server.ts
// (behavior) that the tank game uses. Kept in one file for now: unlike tank,
// this game has no per-skin variation and a much smaller entity count (at
// most 8 players + 1 ball), so there's no equivalent of TANK_SKIN_LABELS/
// ULTIMATE_CONFIG-style per-variant tables to split out yet.

export type SoccerTeam = "A" | "B";
export type SoccerRoomStatus = "lobby" | "playing" | "ended";
export type SoccerTeamSize = 1 | 2 | 3 | 4;

export const SOCCER_TEAM_SIZES: SoccerTeamSize[] = [1, 2, 3, 4];

// Fixed jersey color per team (from the 4 colors in public/soccer/) rather
// than a free per-player pick — with only 2 teams, letting players choose
// freely risks two teammates (or worse, opponents) ending up in the same
// color, which defeats the entire point of a jersey color: telling teams
// apart at a glance. Green/White sit unused for now; a future "away kit"
// pass could offer them as alternates when A vs B color-clashes.
export const SOCCER_TEAM_COLOR: Record<SoccerTeam, string> = { A: "Blue", B: "Red" };

// ---------- field ----------

// The whole pitch is always on screen at once (fixed camera, no scrolling —
// see the design discussion: sprites are tiny top-down figures, same idea as
// classic arcade soccer games), so this doubles as the canvas viewport size.
export const SOCCER_FIELD_W = 900;
export const SOCCER_FIELD_H = 540;

// Height of the goal mouth, centered on each short edge — the only part of
// the edge a ball can cross without bouncing back.
export const SOCCER_GOAL_OPENING = 110;
export const SOCCER_GOAL_TOP = (SOCCER_FIELD_H - SOCCER_GOAL_OPENING) / 2;
export const SOCCER_GOAL_BOTTOM = SOCCER_GOAL_TOP + SOCCER_GOAL_OPENING;
// Purely cosmetic depth for drawing a net behind the goal line.
export const SOCCER_GOAL_DEPTH = 22;

export const SOCCER_PLAYER_RADIUS = 13;
export const SOCCER_BALL_RADIUS = 9;

// ---------- timing ----------

export const SOCCER_TICK_MS = 65; // same tick rate as tank — see its doc
export const SOCCER_MATCH_DURATION_MS = 3 * 60 * 1000;
// Frozen beat after kickoff/a goal: nobody can move/kick/tackle, mirrors the
// tank end-game transition's "let it land" pause rather than snapping
// straight into live play the instant positions reset.
export const SOCCER_KICKOFF_FREEZE_MS = 1500;

// ---------- movement ----------

export const SOCCER_PLAYER_SPEED = 2.6; // px/tick, plain 8-directional

// ---------- sprint ----------

export const SOCCER_BOOST_MAX_ENERGY = 100;
export const SOCCER_BOOST_SPEED_MULTIPLIER = 1.6;
export const SOCCER_BOOST_DRAIN_PER_TICK = 2.2;
export const SOCCER_BOOST_REGEN_PER_TICK = 1;

// ---------- ball ----------

export const SOCCER_BALL_FRICTION = 0.985; // velocity multiplier applied every tick
export const SOCCER_BALL_STOP_SPEED = 0.05; // below this, snap to fully stopped
export const SOCCER_BALL_WALL_BOUNCE = 0.7; // velocity retained after bouncing off a side wall
// How close a player needs to be to "have" the ball — either to start
// dribbling a loose ball or to kick/tackle one they already control.
export const SOCCER_DRIBBLE_RADIUS = SOCCER_PLAYER_RADIUS + SOCCER_BALL_RADIUS + 6;
// Where the ball sits, relative to the controller, while dribbled — just
// ahead of them in their facing direction, not glued to their center.
export const SOCCER_DRIBBLE_LEAD_PX = SOCCER_PLAYER_RADIUS + SOCCER_BALL_RADIUS + 2;
// How fast the ball catches up to that ideal spot each tick, as a fraction
// of the remaining gap — not snapped there outright. A hard set (ball.x =
// target.x) looked like the ball teleporting onto the player's feet the
// instant they picked it up, and snapping to the opposite side the instant
// they turned around. Easing it closes ~95% of the gap in under half a
// second (at SOCCER_TICK_MS) while staying responsive enough not to read as
// the ball lagging behind a fast-moving player.
export const SOCCER_DRIBBLE_EASE = 0.35;
// A loose ball moving slower than this can be trapped cleanly on contact
// (a gentle pass, a slow rolling ball, anything already close to a stop).
// Anything faster — most shots, a hard pass — deflects off the first player
// it touches instead of sticking (see the deflection branch in stepBall):
// real first touches on a hit ball almost never trap it dead the instant it
// arrives, it caroms off and has to be chased down. SOCCER_KICK_MIN_SPEED
// (4) sits comfortably under this so a soft pass still receives cleanly.
export const SOCCER_BALL_CONTROL_MAX_SPEED = 7;
// Fraction of speed kept after a deflection (an imperfect first touch, not
// a real bounce off a rigid surface — most of the ball's energy is
// absorbed rather than reflected).
export const SOCCER_DEFLECT_DAMPING = 0.5;
// Random angle added on top of the physical reflection angle, so a
// deflection doesn't look like a perfectly calculated billiard-ball bounce
// every time — an imperfect touch, not a wall.
export const SOCCER_DEFLECT_SPREAD_RAD = (22 * Math.PI) / 180;

// ---------- kicking ----------

export const SOCCER_KICK_CHARGE_MAX_MS = 900;
export const SOCCER_KICK_MIN_SPEED = 4;
export const SOCCER_KICK_MAX_SPEED = 11;

// ---------- tackling ----------

export const SOCCER_TACKLE_RANGE = SOCCER_PLAYER_RADIUS * 2 + 6;
export const SOCCER_TACKLE_COOLDOWN_MS = 900;
// A tackle that finds nobody in range still goes on cooldown (above) AND
// leaves the tackler slowed for a bit — the "stumble" that discourages
// spamming it as a free ability with no downside.
export const SOCCER_TACKLE_MISS_SLOW_MS = 500;
export const SOCCER_TACKLE_MISS_SLOW_MULTIPLIER = 0.5;
export const SOCCER_TACKLE_KNOCK_SPEED = 6.5;
// The lunge itself: every tackle press (hit or miss) commits the tackler to
// sliding forward along their current facing for a short forced window —
// normal input is ignored for its duration, same idea as a dash.
export const SOCCER_TACKLE_LUNGE_SPEED = 5.5; // px/tick while lunging
export const SOCCER_TACKLE_LUNGE_MS = 220;
// Whoever gets hit (a clean steal or a foul — both are real contact) gets
// shoved this far away from the tackler, instantly. Two jobs at once: it's
// the "hất đối thủ về phía khác" the tackle should visibly do, and it also
// clears them out of ball-pickup range so they don't just instantly
// re-collect the ball they were standing right next to (the same class of
// bug SoccerBall.touchImmuneIds fixes for the tackler's own side of it).
export const SOCCER_TACKLE_KNOCKBACK_DIST = 30;

// ---------- free kicks ----------

// How far the fouling team's nearby players get pushed back from the foul
// spot before play resumes — a "wall", same idea as the real 9.15m rule,
// scaled down to this pitch's size.
export const SOCCER_FREE_KICK_WALL_DIST = 70;
// Setup pause before the fouled team can act — the referee's whistle beat.
// Extends matchEndsAt by the same amount (see startFreeKick's doc), which
// is the "bù giờ hoặc tạm ngưng" the stoppage needed — pausing the clock
// outright was the simpler of the two to get right.
export const SOCCER_FREE_KICK_FREEZE_MS = 1800;

// ---------- fouls / cards ----------

// A tackle (Space) that connects with an opposing player who is NOT the
// current ball carrier is a foul, not a clean steal — checking someone off
// the ball. First foul: yellow card, warning only. Second foul from the same
// player: red card — sent off for the rest of the match (no bot fill-in,
// their team just plays down a player, same "no AI substitutes" rule as
// team sizes generally).
export type SoccerCardStatus = "none" | "yellow" | "red";

export interface SoccerCardEvent {
  id: string;
  playerName: string;
  card: SoccerCardStatus;
}

// `scorerId`/`scorerName` come from SoccerBall.lastToucherId at the moment
// it crossed the line — null if nobody had touched it since the last
// kickoff (e.g. it trickled in off a wall bounce with no clear toucher).
// `ownGoal` is true when that last toucher was on the team being scored
// against — real match convention: an own goal counts for the scoring team
// but isn't credited to the player as a "goal" (see checkGoal's doc).
export interface SoccerGoalEvent {
  id: string;
  scoringTeam: SoccerTeam;
  scoreA: number;
  scoreB: number;
  scorerId: string | null;
  scorerName: string | null;
  ownGoal: boolean;
}

// Announces how a foul got resolved — either a real stoppage (the fouled
// team gets a free kick from the spot, the fouling team's nearby players
// pushed back — see startFreeKick) or advantage (the fouled team's already
// got the ball elsewhere via a teammate mid-attack, so play never stops;
// the card above still applies, just without interrupting the run).
export interface SoccerFreeKickEvent {
  id: string;
  team: SoccerTeam;
  advantage: boolean;
}

// A lunge attempt — every press of Space, whether it connects or not. The
// client uses this to spawn the dirt-kick-up visual at the tackler's spot;
// `hit: true` (a clean steal or a foul, both real contact) gets the full
// effect, a miss gets a smaller puff — see SoccerCanvas's drawTackleFx.
export interface SoccerTackleEvent {
  id: string;
  x: number;
  y: number;
  angle: number;
  hit: boolean;
}

// Every kick/pass/shot/volley release that actually strikes the ball — the
// client uses this to spawn a quick impact puff at the strike point,
// scaled by `power` (0..1, the charge fraction — see handleKickRelease).
export interface SoccerKickEvent {
  id: string;
  x: number;
  y: number;
  angle: number;
  power: number;
}

// ---------- entities ----------

export interface SoccerPlayer {
  id: string;
  name: string;
  team: SoccerTeam;
  connected: boolean;
  x: number;
  y: number;
  // Facing direction in radians — driven by mouse aim while the cursor is
  // over the canvas (see useSoccerInput's handleAimMove), falling back to
  // the held-movement direction when there's no mouse (touch controls).
  // Drives kick/tackle direction, sprite rotation, and where the ball sits
  // while dribbled — all in one field, same as tank's separate `dir`
  // (movement) vs `aimAngle` (shooting) but unified since soccer never
  // needs to move one way while facing another.
  angle: number;
  moving: boolean;
  // Wall-clock timestamp the player started charging a kick, or null if not
  // currently charging — the server measures power from this on release
  // rather than trusting a client-reported duration.
  kickChargeStartedAt: number | null;
  tackleCooldownUntil: number;
  tackleSlowUntil: number;
  // Forced-slide window from a tackle press — see SOCCER_TACKLE_LUNGE_MS.
  // `tackleDashAngle` freezes the direction at the moment of the press
  // (rather than continuing to track live mouse aim mid-slide, which would
  // let a mouse flick steer an already-committed lunge).
  tackleDashUntil: number | null;
  tackleDashAngle: number;
  boostEnergy: number;
  isBoosting: boolean;
  fouls: number;
  cardStatus: SoccerCardStatus;
  // True once a 2nd foul earns a red card — ignored by movement/kick/tackle
  // handlers and by the loose-ball pickup search for the rest of the match.
  sentOff: boolean;
  // Match stats — shown on the post-match scoreboard and fed into the MVP
  // pick (see computeMvp), same spirit as tank's score/damageDealt/deaths.
  goals: number;
  shots: number;
  tacklesWon: number;
}

export interface SoccerBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Whoever's currently dribbling it, or null if it's loose/flying free.
  controllerId: string | null;
  // Whoever just kicked/tackled the ball loose, excluded from the "closest
  // player in dribble range" pickup check below until touchCooldownUntil —
  // without this, the instant a kick sets controllerId to null the ball is
  // still sitting right where it was last tick (it hasn't traveled yet),
  // so the very next tick's pickup check would just hand it straight back
  // to whoever's still standing there before SOCCER_BALL_FRICTION-driven
  // movement (or SOCCER_TACKLE_KNOCKBACK_DIST, for a tackle) ever gets a
  // chance to carry it/them away. A successful tackle excludes both the
  // tackler AND the player they stole it from — either one could otherwise
  // reclaim it on the next tick. Doesn't affect anyone else picking it up
  // (e.g. a pass to a teammate works immediately).
  touchImmuneIds: string[];
  touchCooldownUntil: number;
  // Whoever most recently kicked, volleyed, deflected off, or dribbled this
  // ball — unlike touchImmuneIds this never expires on its own (only reset
  // at kickoff), since it's purely for goal-scorer attribution: the ball
  // can bounce around for a while after a touch before it actually crosses
  // the line, well past touchCooldownUntil.
  lastToucherId: string | null;
}

// How long touched players stay excluded from re-picking-up the ball after
// their own kick/tackle — see SoccerBall.touchImmuneIds's doc. Only needs to
// outlast the couple of ticks it takes even a minimum-power kick to clear
// SOCCER_DRIBBLE_RADIUS from a standing start.
export const SOCCER_TOUCH_COOLDOWN_MS = 300;

export interface SoccerRoomListing {
  roomId: string;
  playerCount: number;
  teamSize: SoccerTeamSize;
  status: SoccerRoomStatus;
}

// Nothing here needs stripping before going out over the wire (unlike
// TankPlayer's hookPull*/velocity* server-only fields) — every field is
// already something the client legitimately needs to render or predict
// with, so there's no PublicSoccerPlayer/toPublicPlayer split like tank's.
// With only up to 8 players + 1 ball, the full state is also small enough
// to just broadcast whole every tick — no delta compression like tank's
// broadcastStateDelta either. Revisit both if this game ever grows the kind
// of per-entity server-only bookkeeping or entity count tank has.
export interface SoccerPublicState {
  roomId: string;
  status: SoccerRoomStatus;
  hostId: string | null;
  teamSize: SoccerTeamSize;
  players: SoccerPlayer[];
  ball: SoccerBall;
  teamScores: Record<SoccerTeam, number>;
  matchEndsAt: number | null;
  winningTeam: SoccerTeam | null;
  // While now < kickoffUntil, the sim holds everyone/the ball in place —
  // see SOCCER_KICKOFF_FREEZE_MS. Also doubles as "match hasn't kicked off
  // yet" the instant status flips to "playing".
  kickoffUntil: number | null;
  // One-tick transient event lists — like tank's impacts/kills, cleared
  // right after every broadcast, so a client only ever sees each event
  // exactly once (as a toast), never accumulated in ongoing state.
  goalEvents: SoccerGoalEvent[];
  cardEvents: SoccerCardEvent[];
  tackleEvents: SoccerTackleEvent[];
  freeKickEvents: SoccerFreeKickEvent[];
  kickEvents: SoccerKickEvent[];
  serverNow: number;
}

// ---------- messages ----------

export type SoccerClientMessage =
  | { type: "join"; playerId: string; name: string }
  | { type: "choose_team"; team: SoccerTeam }
  | { type: "set_team_size"; teamSize: SoccerTeamSize }
  | { type: "start_game" }
  | { type: "play_again" }
  | { type: "input"; up: boolean; down: boolean; left: boolean; right: boolean; boost: boolean; aimAngle?: number }
  | { type: "kick_start" }
  | { type: "kick_release" }
  | { type: "tackle" }
  | { type: "leave_room" };

export type SoccerServerMessage =
  | { type: "state"; state: SoccerPublicState }
  | { type: "kicked" }
  | { type: "error"; message: string };
