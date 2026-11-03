import type { SoccerTeamSize, SoccerBotDifficulty, SoccerTeam } from "./models";

export const SOCCER_TEAM_SIZES: SoccerTeamSize[] = [1, 2, 3, 4];

export const SOCCER_BOT_DIFFICULTIES: SoccerBotDifficulty[] = ["dumb", "basic", "star"];

export const SOCCER_BOT_DIFFICULTY_LABELS: Record<SoccerBotDifficulty, string> = {
  dumb: "Ngu ngơ",
  basic: "Cơ bản",
  star: "Siêu sao",
};

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

export const SOCCER_TICK_MS = 65;

// same tick rate as tank — see its doc
export const SOCCER_MATCH_DURATION_MS = 3 * 60 * 1000;

// Frozen beat after kickoff/a goal: nobody can move/kick/tackle, mirrors the
// tank end-game transition's "let it land" pause rather than snapping
// straight into live play the instant positions reset.
export const SOCCER_KICKOFF_FREEZE_MS = 1500;

// ---------- movement ----------

export const SOCCER_PLAYER_SPEED = 2.6;

// px/tick, plain 8-directional

// ---------- referee ----------

// A neutral NPC that jogs around watching play — never interacts with the
// ball (see stepReferee's doc) but is a solid body to players, same as
// another player would be (see resolvePlayerCollisions), and can be tackled
// into by mistake for a foul (see resolveTackle).
export const SOCCER_REFEREE_SPEED = 1.8;

// px/tick — a jog, slower than a player's run
// Stays roughly this far from the ball rather than standing right on top of
// it — a real referee trails play, doesn't chase the ball itself. Kept well
// outside SOCCER_TACKLE_RANGE (32px) even though several players contesting
// the ball can each be within ~30-40px of it themselves — 75px used to put
// the referee right at the edge of that crowd, where a lunging tackle could
// clip it by pure bad luck (see SOCCER_REFEREE_AVOID_DIST below for the
// other half of that fix).
export const SOCCER_REFEREE_FOLLOW_DIST = 130;

// Personal-space buffer: any player closer than this gets a gentle push in
// stepReferee, so the referee visibly steps out of a crowd around the ball
// instead of standing still right in the middle of it while players fight
// for a tackle. Comfortably wider than SOCCER_TACKLE_RANGE so it de-risks
// contact before a lunge could ever connect, not just after.
export const SOCCER_REFEREE_AVOID_DIST = 55;

// ---------- sprint ----------

export const SOCCER_BOOST_MAX_ENERGY = 100;

export const SOCCER_BOOST_SPEED_MULTIPLIER = 1.6;

export const SOCCER_BOOST_DRAIN_PER_TICK = 2.2;

export const SOCCER_BOOST_REGEN_PER_TICK = 1;

// ---------- ball ----------

export const SOCCER_BALL_FRICTION = 0.985;

// velocity multiplier applied every tick
export const SOCCER_BALL_STOP_SPEED = 0.05;

// below this, snap to fully stopped
export const SOCCER_BALL_WALL_BOUNCE = 0.7;

// velocity retained after bouncing off a side wall
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
export const SOCCER_TACKLE_LUNGE_SPEED = 5.5;

// px/tick while lunging
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

// How long touched players stay excluded from re-picking-up the ball after
// their own kick/tackle — see SoccerBall.touchImmuneIds's doc. Only needs to
// outlast the couple of ticks it takes even a minimum-power kick to clear
// SOCCER_DRIBBLE_RADIUS from a standing start.
export const SOCCER_TOUCH_COOLDOWN_MS = 300;
