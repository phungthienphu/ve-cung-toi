

export type SoccerTeam = "A" | "B";

export type SoccerRoomStatus = "lobby" | "playing" | "ended";

export type SoccerTeamSize = 1 | 2 | 3 | 4;

// ---------- AI bots ----------

// Fills empty team slots so a match can start without waiting on a full
// roster of real players — unlike tank, where an uneven team just plays a
// player down for the whole match (see SoccerPlayer.sentOff's doc for the
// same "no bot substitutes" rule applying to a red card specifically, which
// still holds: a sent-off bot is NOT replaced either, same as a sent-off
// human). Three tuning presets rather than a single "AI" toggle, since a
// silly/weak bot and a sharp one are both useful for different groups (a
// couple of kids filling out a 4v4 vs. one skilled friend wanting a real
// match with 3 empty slots).
export type SoccerBotDifficulty = "dumb" | "basic" | "star";

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
  // True when the foul was tackling into the referee by mistake, rather
  // than an opposing player — the client shows a distinct toast for it.
  foulOnReferee?: boolean;
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

// A neutral NPC, not part of either team — no stats, no cards of its own,
// never touches the ball (see SOCCER_REFEREE_FOLLOW_DIST's doc), but is a
// solid body players collide with and can foul by tackling into by mistake.
export interface SoccerReferee {
  x: number;
  y: number;
  angle: number;
  moving: boolean;
}

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
  // Bots are ordinary entries in the same players map/array — same physics,
  // same fouls/cards, same stats — just driven by stepBotAI's decisions
  // instead of a WebSocket connection's input messages. isBot is purely for
  // display (a 🤖 badge) and for handleStartGame/handlePlayAgain to know
  // which entries to spawn/clear.
  isBot: boolean;
  botDifficulty?: SoccerBotDifficulty;
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
  botFillEnabled: boolean;
  botDifficulty: SoccerBotDifficulty;
  players: SoccerPlayer[];
  referee: SoccerReferee;
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
  | { type: "set_bot_fill"; enabled: boolean; difficulty: SoccerBotDifficulty }
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
