// The referee's own movement — deliberately not part of stepPlayers, since
// it isn't driven by any player's input and never touches the ball (see its
// doc on SoccerReferee). Just trails the ball at a fixed distance, like a
// real referee jogging to keep up with play rather than chasing it down.

import {
  SOCCER_FIELD_H,
  SOCCER_FIELD_W,
  SOCCER_PLAYER_RADIUS,
  SOCCER_REFEREE_AVOID_DIST,
  SOCCER_REFEREE_FOLLOW_DIST,
  SOCCER_REFEREE_SPEED,
  type SoccerBall,
  type SoccerPlayer,
  type SoccerReferee,
} from "../../shared/soccerTypes";
import { clampToField } from "./geometry";

export interface RefereeCtx {
  referee: SoccerReferee;
  ball: SoccerBall;
  players: Map<string, SoccerPlayer>;
}

export function stepReferee(ctx: RefereeCtx) {
  const dx = ctx.ball.x - ctx.referee.x;
  const dy = ctx.ball.y - ctx.referee.y;
  const dist = Math.hypot(dx, dy);

  // Close enough already — hold position (still facing the ball, like a
  // referee watching play rather than turning away from it).
  if (dist <= SOCCER_REFEREE_FOLLOW_DIST) {
    if (dist > 0) ctx.referee.angle = Math.atan2(dy, dx);
    ctx.referee.moving = false;
  } else {
    const nx = dx / dist;
    const ny = dy / dist;
    ctx.referee.angle = Math.atan2(dy, dx);
    ctx.referee.moving = true;
    ctx.referee.x = clampToField(ctx.referee.x + nx * SOCCER_REFEREE_SPEED, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_W);
    ctx.referee.y = clampToField(ctx.referee.y + ny * SOCCER_REFEREE_SPEED, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_H);
  }

  avoidCrowding(ctx);
}

// Steps the referee away from any player standing too close, so it doesn't
// idle right in the middle of a contested ball while two players lunge for
// tackles around it ("chạy lung tung vướng chân" — see foulReferee's doc for
// the other half of this fix). Summed rather than one-at-a-time so being
// boxed in by several players still pushes toward the open side.
function avoidCrowding(ctx: RefereeCtx) {
  let pushX = 0;
  let pushY = 0;
  for (const p of ctx.players.values()) {
    const dx = ctx.referee.x - p.x;
    const dy = ctx.referee.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= SOCCER_REFEREE_AVOID_DIST || dist <= 0) continue;
    const strength = (SOCCER_REFEREE_AVOID_DIST - dist) / SOCCER_REFEREE_AVOID_DIST;
    pushX += (dx / dist) * strength;
    pushY += (dy / dist) * strength;
  }
  const pushLen = Math.hypot(pushX, pushY);
  if (pushLen <= 0) return;
  ctx.referee.x = clampToField(ctx.referee.x + (pushX / pushLen) * SOCCER_REFEREE_SPEED, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_W);
  ctx.referee.y = clampToField(ctx.referee.y + (pushY / pushLen) * SOCCER_REFEREE_SPEED, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_H);
}
