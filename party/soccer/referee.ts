// The referee's own movement — deliberately not part of stepPlayers, since
// it isn't driven by any player's input and never touches the ball (see its
// doc on SoccerReferee). Just trails the ball at a fixed distance, like a
// real referee jogging to keep up with play rather than chasing it down.

import { SOCCER_FIELD_H, SOCCER_FIELD_W, SOCCER_PLAYER_RADIUS, SOCCER_REFEREE_FOLLOW_DIST, SOCCER_REFEREE_SPEED, type SoccerBall, type SoccerReferee } from "../../shared/soccerTypes";
import { clampToField } from "./geometry";

export interface RefereeCtx {
  referee: SoccerReferee;
  ball: SoccerBall;
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
    return;
  }

  const nx = dx / dist;
  const ny = dy / dist;
  ctx.referee.angle = Math.atan2(dy, dx);
  ctx.referee.moving = true;
  ctx.referee.x = clampToField(ctx.referee.x + nx * SOCCER_REFEREE_SPEED, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_W);
  ctx.referee.y = clampToField(ctx.referee.y + ny * SOCCER_REFEREE_SPEED, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_H);
}
