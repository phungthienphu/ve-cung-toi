// The actual "ball leaves the foot" effect — shared between the real
// charge-and-release flow (soccer-server.ts's handleKickRelease, which
// turns a charge duration into a speed) and bot AI (party/soccer/bots.ts,
// which picks a speed directly with no charge duration to simulate). Same
// reasoning as fouls.ts's resolveTackle being its own function: one place
// for what striking the ball actually does, so a real player's shot and a
// bot's shot can never quietly drift apart in behavior.

import { SOCCER_KICK_MAX_SPEED, SOCCER_KICK_MIN_SPEED, SOCCER_TOUCH_COOLDOWN_MS, type SoccerBall, type SoccerKickEvent, type SoccerPlayer } from "../../shared/soccerTypes";
import { makeId } from "./geometry";

export interface KickCtx {
  ball: SoccerBall;
  kickEvents: SoccerKickEvent[];
}

/** Strikes the ball at `speed` px/tick along `player.angle`, overriding
 * whatever velocity it already had — whether it was being dribbled or met
 * first-time as a loose ball (a volley), see handleKickRelease's doc for why
 * both cases end up here. The FX "power" (0..1) shown to the client is
 * derived from where `speed` falls in the normal kick range, so a bot's
 * harder shots still visibly charge up more than its taps. */
export function applyKick(ctx: KickCtx, player: SoccerPlayer, speed: number, now: number) {
  ctx.ball.controllerId = null;
  ctx.ball.touchImmuneIds = [player.id];
  ctx.ball.touchCooldownUntil = now + SOCCER_TOUCH_COOLDOWN_MS;
  ctx.ball.lastToucherId = player.id;
  ctx.ball.vx = Math.cos(player.angle) * speed;
  ctx.ball.vy = Math.sin(player.angle) * speed;
  player.shots += 1;
  const chargeFraction = Math.max(0, Math.min(1, (speed - SOCCER_KICK_MIN_SPEED) / (SOCCER_KICK_MAX_SPEED - SOCCER_KICK_MIN_SPEED)));
  ctx.kickEvents.push({ id: makeId(), x: player.x, y: player.y, angle: player.angle, power: chargeFraction });
}
