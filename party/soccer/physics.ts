// Per-tick movement + ball physics — the pure simulation step, with no
// lobby/message-handling concerns mixed in. Mirrors the split tank uses
// (party/tank/players-tick.ts, bullets-tick.ts): these take a `ctx` object
// exposing just the room state they need, and soccer-server.ts calls them
// with `this`, which satisfies PhysicsCtx structurally.

import {
  SOCCER_BALL_CONTROL_MAX_SPEED,
  SOCCER_BALL_FRICTION,
  SOCCER_BALL_RADIUS,
  SOCCER_BALL_STOP_SPEED,
  SOCCER_BALL_WALL_BOUNCE,
  SOCCER_BOOST_DRAIN_PER_TICK,
  SOCCER_BOOST_MAX_ENERGY,
  SOCCER_BOOST_REGEN_PER_TICK,
  SOCCER_BOOST_SPEED_MULTIPLIER,
  SOCCER_DEFLECT_DAMPING,
  SOCCER_DEFLECT_SPREAD_RAD,
  SOCCER_DRIBBLE_EASE,
  SOCCER_DRIBBLE_LEAD_PX,
  SOCCER_DRIBBLE_RADIUS,
  SOCCER_FIELD_H,
  SOCCER_FIELD_W,
  SOCCER_GOAL_BOTTOM,
  SOCCER_GOAL_TOP,
  SOCCER_PLAYER_RADIUS,
  SOCCER_PLAYER_SPEED,
  SOCCER_TACKLE_LUNGE_SPEED,
  SOCCER_TACKLE_MISS_SLOW_MULTIPLIER,
  SOCCER_TOUCH_COOLDOWN_MS,
  type SoccerBall,
  type SoccerPlayer,
} from "../../shared/soccerTypes";
import { clampToField } from "./geometry";
import type { InputState } from "./types";

export interface PhysicsCtx {
  players: Map<string, SoccerPlayer>;
  inputs: Map<string, InputState>;
  ball: SoccerBall;
}

export function stepPlayers(ctx: PhysicsCtx, now: number) {
  for (const player of ctx.players.values()) {
    if (!player.connected || player.sentOff) continue;

    if (player.tackleDashUntil !== null) {
      if (now >= player.tackleDashUntil) {
        player.tackleDashUntil = null;
      } else {
        // Forced slide along the locked-in lunge direction — normal input
        // is ignored entirely for its short duration, same idea as tank's
        // dash. See SOCCER_TACKLE_LUNGE_MS's doc.
        player.angle = player.tackleDashAngle;
        player.moving = true;
        player.x = clampToField(player.x + Math.cos(player.tackleDashAngle) * SOCCER_TACKLE_LUNGE_SPEED, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_W);
        player.y = clampToField(player.y + Math.sin(player.tackleDashAngle) * SOCCER_TACKLE_LUNGE_SPEED, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_H);
        continue;
      }
    }

    const input = ctx.inputs.get(player.id);
    let dx = 0;
    let dy = 0;
    if (input?.up) dy -= 1;
    if (input?.down) dy += 1;
    if (input?.left) dx -= 1;
    if (input?.right) dx += 1;

    player.moving = dx !== 0 || dy !== 0;
    // Facing follows the mouse (aimAngle) whenever it's available — see
    // SoccerPlayer.angle's doc — falling back to the movement direction for
    // touch controls, which have no cursor to report one.
    if (input?.aimAngle !== null && input?.aimAngle !== undefined) {
      player.angle = input.aimAngle;
    } else if (player.moving) {
      const len = Math.hypot(dx, dy);
      player.angle = Math.atan2(dy, len === 0 ? 0 : dx);
    }

    const wantsBoost = !!input?.boost && player.boostEnergy > 0 && player.moving;
    player.isBoosting = wantsBoost;
    player.boostEnergy = wantsBoost
      ? Math.max(0, player.boostEnergy - SOCCER_BOOST_DRAIN_PER_TICK)
      : Math.min(SOCCER_BOOST_MAX_ENERGY, player.boostEnergy + SOCCER_BOOST_REGEN_PER_TICK);

    if (player.moving) {
      const len = Math.hypot(dx, dy);
      const slowed = now < player.tackleSlowUntil;
      const boostMult = wantsBoost ? SOCCER_BOOST_SPEED_MULTIPLIER : 1;
      const speed = (SOCCER_PLAYER_SPEED * boostMult * (slowed ? SOCCER_TACKLE_MISS_SLOW_MULTIPLIER : 1)) / len;
      player.x = clampToField(player.x + dx * speed, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_W);
      player.y = clampToField(player.y + dy * speed, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_H);
    }
  }
}

/** Keeps players from overlapping — without this, two players could stand
 * exactly on top of each other, which read as walking straight through one
 * another instead of jostling for position. Simple pairwise circle
 * separation: push each half the overlap apart along the line between their
 * centers. At up to 8 players that's at most 28 pair checks a tick, trivial. */
export function resolvePlayerCollisions(ctx: PhysicsCtx) {
  const list = [...ctx.players.values()].filter((p) => p.connected && !p.sentOff);
  const minDist = SOCCER_PLAYER_RADIUS * 2;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= minDist) continue;
      // Exactly-overlapping is vanishingly rare (identical spawn points),
      // but falling back to a fixed axis keeps this divide-by-zero-safe
      // instead of leaving the pair stuck with nx/ny both NaN.
      const nx = dist > 0 ? dx / dist : 1;
      const ny = dist > 0 ? dy / dist : 0;
      const overlap = (minDist - dist) / 2;
      a.x = clampToField(a.x - nx * overlap, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_W);
      a.y = clampToField(a.y - ny * overlap, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_H);
      b.x = clampToField(b.x + nx * overlap, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_W);
      b.y = clampToField(b.y + ny * overlap, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_H);
    }
  }
}

export function stepBall(ctx: PhysicsCtx) {
  const ball = ctx.ball;
  if (ball.controllerId) {
    const controller = ctx.players.get(ball.controllerId);
    if (!controller || !controller.connected) {
      ball.controllerId = null;
    } else {
      // Eases toward the ideal dribble spot instead of snapping straight to
      // it — see SOCCER_DRIBBLE_EASE's doc for why a hard set looked like
      // the ball teleporting onto the player.
      const targetX = controller.x + Math.cos(controller.angle) * SOCCER_DRIBBLE_LEAD_PX;
      const targetY = controller.y + Math.sin(controller.angle) * SOCCER_DRIBBLE_LEAD_PX;
      ball.x += (targetX - ball.x) * SOCCER_DRIBBLE_EASE;
      ball.y += (targetY - ball.y) * SOCCER_DRIBBLE_EASE;
      ball.vx = 0;
      ball.vy = 0;
      // Kept current every tick while dribbled (not just set once on
      // pickup) so dribbling it straight into the goal without ever
      // kicking it still correctly credits this player — see
      // SoccerBall.lastToucherId's doc.
      ball.lastToucherId = controller.id;
      return;
    }
  }

  // Loose ball: whoever's closest within dribble range takes control — no
  // proximity-steal from an existing controller (see the early return
  // above), only an active tackle can contest a held ball. Whoever just
  // kicked/tackled it loose is excluded until touchCooldownUntil passes —
  // see SoccerBall.touchImmuneIds's doc for why (otherwise they'd just
  // instantly re-pick-up their own kick/steal, every time, before it ever
  // traveled anywhere).
  const now = Date.now();
  const touchImmune = now < ball.touchCooldownUntil ? ball.touchImmuneIds : [];
  let closest: SoccerPlayer | null = null;
  let closestDist = SOCCER_DRIBBLE_RADIUS;
  for (const p of ctx.players.values()) {
    if (!p.connected || p.sentOff || touchImmune.includes(p.id)) continue;
    const dist = Math.hypot(p.x - ball.x, p.y - ball.y);
    if (dist <= closestDist) {
      closest = p;
      closestDist = dist;
    }
  }
  if (closest) {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed <= SOCCER_BALL_CONTROL_MAX_SPEED) {
      ball.controllerId = closest.id;
      return;
    }
    // Too hot to trap cleanly — deflects off them instead of gluing on,
    // same physical idea as a real first touch on a hard shot. See
    // SOCCER_BALL_CONTROL_MAX_SPEED's doc. Falls through to the normal
    // position/friction/wall-bounce integration below using the ball's new
    // (deflected) velocity, rather than returning early.
    const nx = ball.x - closest.x;
    const ny = ball.y - closest.y;
    const nLen = Math.hypot(nx, ny) || 1;
    const normX = nx / nLen;
    const normY = ny / nLen;
    const dot = ball.vx * normX + ball.vy * normY;
    const reflectedVx = ball.vx - 2 * dot * normX;
    const reflectedVy = ball.vy - 2 * dot * normY;
    const jitter = (Math.random() - 0.5) * 2 * SOCCER_DEFLECT_SPREAD_RAD;
    const cosJ = Math.cos(jitter);
    const sinJ = Math.sin(jitter);
    ball.vx = (reflectedVx * cosJ - reflectedVy * sinJ) * SOCCER_DEFLECT_DAMPING;
    ball.vy = (reflectedVx * sinJ + reflectedVy * cosJ) * SOCCER_DEFLECT_DAMPING;
    ball.touchImmuneIds = [closest.id];
    ball.touchCooldownUntil = now + SOCCER_TOUCH_COOLDOWN_MS;
    ball.lastToucherId = closest.id;
  }

  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.vx *= SOCCER_BALL_FRICTION;
  ball.vy *= SOCCER_BALL_FRICTION;
  if (Math.hypot(ball.vx, ball.vy) < SOCCER_BALL_STOP_SPEED) {
    ball.vx = 0;
    ball.vy = 0;
  }

  const inGoalMouth = ball.y >= SOCCER_GOAL_TOP && ball.y <= SOCCER_GOAL_BOTTOM;
  if (!inGoalMouth || (ball.x > SOCCER_BALL_RADIUS && ball.x < SOCCER_FIELD_W - SOCCER_BALL_RADIUS)) {
    if (ball.x < SOCCER_BALL_RADIUS && !inGoalMouth) {
      ball.x = SOCCER_BALL_RADIUS;
      ball.vx = Math.abs(ball.vx) * SOCCER_BALL_WALL_BOUNCE;
    } else if (ball.x > SOCCER_FIELD_W - SOCCER_BALL_RADIUS && !inGoalMouth) {
      ball.x = SOCCER_FIELD_W - SOCCER_BALL_RADIUS;
      ball.vx = -Math.abs(ball.vx) * SOCCER_BALL_WALL_BOUNCE;
    }
  }
  if (ball.y < SOCCER_BALL_RADIUS) {
    ball.y = SOCCER_BALL_RADIUS;
    ball.vy = Math.abs(ball.vy) * SOCCER_BALL_WALL_BOUNCE;
  } else if (ball.y > SOCCER_FIELD_H - SOCCER_BALL_RADIUS) {
    ball.y = SOCCER_FIELD_H - SOCCER_BALL_RADIUS;
    ball.vy = -Math.abs(ball.vy) * SOCCER_BALL_WALL_BOUNCE;
  }
}
