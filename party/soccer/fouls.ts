// Tackle resolution: contact, cards, and the free-kick restart that follows
// a foul. Split out of soccer-server.ts for the same reason tank split
// skills.ts out of tank-server.ts — this was the single longest, most
// tangled method in the file.

import {
  SOCCER_BALL_RADIUS,
  SOCCER_DRIBBLE_RADIUS,
  SOCCER_FIELD_H,
  SOCCER_FIELD_W,
  SOCCER_FREE_KICK_FREEZE_MS,
  SOCCER_FREE_KICK_WALL_DIST,
  SOCCER_PLAYER_RADIUS,
  SOCCER_TACKLE_KNOCKBACK_DIST,
  SOCCER_TACKLE_KNOCK_SPEED,
  SOCCER_TACKLE_MISS_SLOW_MS,
  SOCCER_TACKLE_RANGE,
  SOCCER_TOUCH_COOLDOWN_MS,
  type SoccerBall,
  type SoccerCardEvent,
  type SoccerFreeKickEvent,
  type SoccerPlayer,
  type SoccerReferee,
  type SoccerRoomStatus,
  type SoccerTackleEvent,
  type SoccerTeam,
} from "../../shared/soccerTypes";
import { clampToField, makeId, otherTeam } from "./geometry";

export interface TackleCtx {
  players: Map<string, SoccerPlayer>;
  referee: SoccerReferee;
  ball: SoccerBall;
  status: SoccerRoomStatus;
  matchEndsAt: number | null;
  kickoffUntil: number | null;
  tackleEvents: SoccerTackleEvent[];
  cardEvents: SoccerCardEvent[];
  freeKickEvents: SoccerFreeKickEvent[];
}

/** Resolves one tackle press end-to-end: finds a target in range, applies
 * contact (knockback, and possibly a stolen/dislodged ball), and — for a
 * foul — either starts a free kick or waves advantage. The caller
 * (soccer-server.ts's handleTackle) is expected to have already gated on
 * cooldown/frozen/sentOff and set the tackler's cooldown + lunge-dash
 * fields before calling this. `onSentOff` fires when the foul earns a red
 * card, so the caller can check for a forfeit — ending the match and
 * stopping the tick loop are room-lifecycle concerns this module has no
 * business reaching into directly. */
export function resolveTackle(ctx: TackleCtx, tackler: SoccerPlayer, now: number, onSentOff: (team: SoccerTeam) => void) {
  // Any opposing player in range is a valid target — whether it resolves as
  // a clean steal or a foul depends on whether they actually have the ball.
  // The referee is a candidate too — always a mistaken foul (it never has
  // the ball), never a clean steal — and, being neutral, whichever's
  // actually closest wins rather than always preferring a real player.
  let victim: SoccerPlayer | null = null;
  let victimDist = SOCCER_TACKLE_RANGE;
  for (const p of ctx.players.values()) {
    if (p.team === tackler.team || p.sentOff || !p.connected) continue;
    const dist = Math.hypot(p.x - tackler.x, p.y - tackler.y);
    if (dist <= victimDist) {
      victim = p;
      victimDist = dist;
    }
  }
  const refDist = Math.hypot(ctx.referee.x - tackler.x, ctx.referee.y - tackler.y);
  // refDist <= victimDist can only trip once victimDist has already been
  // confirmed <= SOCCER_TACKLE_RANGE (its starting value, only ever
  // shrinking), so the referee is guaranteed in range here too.
  if (refDist <= victimDist) {
    foulReferee(ctx, tackler, onSentOff);
    return;
  }

  if (!victim) {
    // Whiffed — a real lunge that finds nobody leaves you briefly slower,
    // so mashing tackle isn't a free way to harass the ball carrier.
    tackler.tackleSlowUntil = now + SOCCER_TACKLE_MISS_SLOW_MS;
    ctx.tackleEvents.push({ id: makeId(), x: tackler.x, y: tackler.y, angle: tackler.angle, hit: false });
    return;
  }

  // Captured before the knockback below moves the victim — a free kick (if
  // this ends up being a foul, not a clean steal) is taken from where the
  // contact actually happened, not from wherever they get shoved to.
  const foulX = victim.x;
  const foulY = victim.y;
  const priorControllerId = ctx.ball.controllerId;

  // Contact — shove the victim away from the tackler (this doubles as the
  // fix for them otherwise standing right where the ball still is and
  // instantly re-collecting it; see SoccerBall.touchImmuneIds's doc).
  const kbDx = victim.x - tackler.x;
  const kbDy = victim.y - tackler.y;
  const kbLen = Math.hypot(kbDx, kbDy) || 1;
  victim.x = clampToField(victim.x + (kbDx / kbLen) * SOCCER_TACKLE_KNOCKBACK_DIST, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_W);
  victim.y = clampToField(victim.y + (kbDy / kbLen) * SOCCER_TACKLE_KNOCKBACK_DIST, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_H);

  const wasHoldingBall = victim.id === ctx.ball.controllerId;
  // A foul from behind on someone still catching up to a just-arrived pass
  // (ball loose, not yet "controlled" — see SOCCER_BALL_CONTROL_MAX_SPEED)
  // shouldn't leave the ball sitting there untouched either: if it's right
  // where the contact happened, the challenge knocks it loose same as a
  // real steal would, even though the tackler still gets carded for not
  // having actually won it fairly.
  const ballWasNearby = Math.hypot(ctx.ball.x - victim.x, ctx.ball.y - victim.y) <= SOCCER_DRIBBLE_RADIUS;
  if (wasHoldingBall || ballWasNearby) {
    ctx.ball.controllerId = null;
    ctx.ball.touchImmuneIds = [tackler.id, victim.id];
    ctx.ball.touchCooldownUntil = now + SOCCER_TOUCH_COOLDOWN_MS;
    ctx.ball.lastToucherId = tackler.id;
    ctx.ball.vx = Math.cos(tackler.angle) * SOCCER_TACKLE_KNOCK_SPEED;
    ctx.ball.vy = Math.sin(tackler.angle) * SOCCER_TACKLE_KNOCK_SPEED;
  }

  if (wasHoldingBall) {
    tackler.tacklesWon += 1;
  } else {
    // Didn't actually have the ball under control — a foul, regardless of
    // whether it happened to be knocked loose above.
    tackler.fouls += 1;
    tackler.cardStatus = tackler.fouls >= 2 ? "red" : "yellow";
    if (tackler.cardStatus === "red") {
      tackler.sentOff = true;
      onSentOff(tackler.team);
    }
    ctx.cardEvents.push({ id: makeId(), playerName: tackler.name, card: tackler.cardStatus });

    // Advantage: this foul never touched the ball (ballWasNearby is false)
    // and a teammate of the victim already had it before this tackle — the
    // fouled side is mid-attack elsewhere on the pitch, so stopping play
    // would only help the team that just fouled. The card still stands,
    // but play never stops. Otherwise, a real stoppage: free kick from the
    // foul spot, fouling side pushed back.
    const teammateHasBall = !ballWasNearby && priorControllerId !== null && ctx.players.get(priorControllerId)?.team === victim.team;
    if (ctx.status === "playing") {
      if (teammateHasBall) {
        ctx.freeKickEvents.push({ id: makeId(), team: victim.team, advantage: true });
      } else {
        startFreeKick(ctx, victim, foulX, foulY);
        ctx.freeKickEvents.push({ id: makeId(), team: victim.team, advantage: false });
      }
    }
  }
  ctx.tackleEvents.push({ id: makeId(), x: tackler.x, y: tackler.y, angle: tackler.angle, hit: true });
}

/** Tackling into the referee by mistake — always a foul (it never has the
 * ball, so there's no "clean steal" outcome), and neutral (neither team's
 * play, so no free kick/advantage to award). Still shoves the ref out of
 * the way for the same physical consistency a player-victim gets.
 *
 * Deliberately lighter than a real player foul: the referee actively trails
 * the ball (see stepReferee), so it can end up in a crowd through no fault
 * of the tackler — unlike fouling an opposing player, this doesn't count
 * toward the real fouls counter or ever escalate to red/send-off. It still
 * shows a yellow the first time as a clear "watch out for the ref" signal,
 * but never punishes bad luck the way a genuine reckless-tackle strike does. */
function foulReferee(ctx: TackleCtx, tackler: SoccerPlayer, _onSentOff: (team: SoccerTeam) => void) {
  const kbDx = ctx.referee.x - tackler.x;
  const kbDy = ctx.referee.y - tackler.y;
  const kbLen = Math.hypot(kbDx, kbDy) || 1;
  ctx.referee.x = clampToField(ctx.referee.x + (kbDx / kbLen) * SOCCER_TACKLE_KNOCKBACK_DIST, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_W);
  ctx.referee.y = clampToField(ctx.referee.y + (kbDy / kbLen) * SOCCER_TACKLE_KNOCKBACK_DIST, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_H);

  if (tackler.cardStatus === "none") tackler.cardStatus = "yellow";
  ctx.cardEvents.push({ id: makeId(), playerName: tackler.name, card: "yellow", foulOnReferee: true });
  ctx.tackleEvents.push({ id: makeId(), x: tackler.x, y: tackler.y, angle: tackler.angle, hit: true });
}

/** Sets up a dead-ball restart for the fouled team: ball placed at the foul
 * spot under the victim's control, the fouling team's nearby players pushed
 * back to make room (SOCCER_FREE_KICK_WALL_DIST), and a short freeze
 * (SOCCER_FREE_KICK_FREEZE_MS — the referee's whistle beat) before anyone
 * can act. The victim is pulled back to the foul spot too (they may have
 * just been knocked away from it by the same tackle) — a free kick is taken
 * from where the foul happened, not from wherever the player ended up.
 * matchEndsAt shifts by the same freeze duration so the stoppage doesn't
 * eat into regulation time. */
function startFreeKick(ctx: TackleCtx, victim: SoccerPlayer, foulX: number, foulY: number) {
  victim.x = foulX;
  victim.y = foulY;
  ctx.ball.x = clampToField(foulX, SOCCER_BALL_RADIUS, SOCCER_FIELD_W);
  ctx.ball.y = clampToField(foulY, SOCCER_BALL_RADIUS, SOCCER_FIELD_H);
  ctx.ball.vx = 0;
  ctx.ball.vy = 0;
  ctx.ball.controllerId = victim.id;
  ctx.ball.touchImmuneIds = [];
  ctx.ball.touchCooldownUntil = 0;
  ctx.ball.lastToucherId = victim.id;

  const foulingTeam = otherTeam(victim.team);
  for (const p of ctx.players.values()) {
    if (!p.connected || p.sentOff || p.team !== foulingTeam) continue;
    const dx = p.x - ctx.ball.x;
    const dy = p.y - ctx.ball.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist >= SOCCER_FREE_KICK_WALL_DIST) continue;
    const nx = dx / dist;
    const ny = dy / dist;
    p.x = clampToField(ctx.ball.x + nx * SOCCER_FREE_KICK_WALL_DIST, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_W);
    p.y = clampToField(ctx.ball.y + ny * SOCCER_FREE_KICK_WALL_DIST, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_H);
  }

  ctx.kickoffUntil = Date.now() + SOCCER_FREE_KICK_FREEZE_MS;
  if (ctx.matchEndsAt !== null) ctx.matchEndsAt += SOCCER_FREE_KICK_FREEZE_MS;
}
