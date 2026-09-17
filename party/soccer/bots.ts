// AI-controlled players that fill empty team slots — see SoccerBotDifficulty's
// doc for why there are three tiers instead of one. A bot is an ordinary
// entry in `players`, so it goes through the exact same physics/fouls/goal
// code as a human (see resolvePlayerCollisions, resolveTackle, applyKick) —
// this module only ever decides on an InputState (fed into stepPlayers like
// any WebSocket "input" message) and occasionally calls the same kick/tackle
// functions a real player's message handler would.

import {
  SOCCER_BOOST_MAX_ENERGY,
  SOCCER_FIELD_H,
  SOCCER_FIELD_W,
  SOCCER_GOAL_BOTTOM,
  SOCCER_GOAL_TOP,
  SOCCER_KICK_MAX_SPEED,
  SOCCER_KICK_MIN_SPEED,
  SOCCER_TACKLE_COOLDOWN_MS,
  SOCCER_TACKLE_RANGE,
  type SoccerBotDifficulty,
  type SoccerPlayer,
  type SoccerTeam,
} from "../../shared/soccerTypes";
import { applyKick, type KickCtx } from "./kicking";
import { resolveTackle, type TackleCtx } from "./fouls";
import type { InputState } from "./types";

/** A bot is an ordinary SoccerPlayer with isBot/botDifficulty set — created
 * fresh at handleStartGame time to fill whatever's short of `teamSize` on
 * each side, and discarded (see handlePlayAgain) so the lobby afterward
 * shows only real players again. `index` just makes the name/id unique when
 * a team needs more than one bot. */
export function createBot(id: string, name: string, team: SoccerTeam, difficulty: SoccerBotDifficulty, spawnX: number, spawnY: number): SoccerPlayer {
  return {
    id,
    name,
    team,
    connected: true,
    x: spawnX,
    y: spawnY,
    angle: team === "A" ? 0 : Math.PI,
    moving: false,
    kickChargeStartedAt: null,
    tackleCooldownUntil: 0,
    tackleSlowUntil: 0,
    tackleDashUntil: null,
    tackleDashAngle: 0,
    boostEnergy: SOCCER_BOOST_MAX_ENERGY,
    isBoosting: false,
    fouls: 0,
    cardStatus: "none",
    sentOff: false,
    goals: 0,
    shots: 0,
    tacklesWon: 0,
    isBot: true,
    botDifficulty: difficulty,
  };
}

const GOAL_Y = (SOCCER_GOAL_TOP + SOCCER_GOAL_BOTTOM) / 2;

/** Tuning knobs per difficulty — one decision function reads these instead
 * of three near-duplicate AI implementations, so tuning "dumb" doesn't risk
 * quietly drifting the other two out of sync with it. */
interface BotProfile {
  // Recompute the bot's target/intent this often — a slower reaction is a
  // big part of what makes "dumb" feel dumb, more than any single number.
  decisionEveryMs: number;
  positionNoisePx: number; // random wobble added to wherever it's headed
  aimNoiseRad: number; // random angle error on kicks
  holdsPosition: boolean; // false = always beelines the ball, kid-soccer style
  passChance: number; // chance to pass to an open teammate instead of always shooting/dribbling on
  shootSpeedFrac: [number, number]; // [min, max] fraction of the real kick speed range it commits to
  tackleChance: number; // chance to actually commit when a tackle opportunity appears
  wildTackleChance: number; // chance per decision to lunge even with no real opportunity — pure recklessness
  boostChance: number; // chance to hold sprint while chasing something far off
}

const PROFILES: Record<SoccerBotDifficulty, BotProfile> = {
  dumb: {
    decisionEveryMs: 500,
    positionNoisePx: 40,
    aimNoiseRad: (28 * Math.PI) / 180,
    holdsPosition: false,
    passChance: 0.05,
    shootSpeedFrac: [0.3, 0.8],
    tackleChance: 0.5,
    wildTackleChance: 0.06,
    boostChance: 0.15,
  },
  basic: {
    decisionEveryMs: 280,
    positionNoisePx: 18,
    aimNoiseRad: (12 * Math.PI) / 180,
    holdsPosition: true,
    passChance: 0.3,
    shootSpeedFrac: [0.6, 0.95],
    tackleChance: 0.8,
    wildTackleChance: 0.01,
    boostChance: 0.4,
  },
  star: {
    decisionEveryMs: 130,
    positionNoisePx: 6,
    aimNoiseRad: (3 * Math.PI) / 180,
    holdsPosition: true,
    passChance: 0.5,
    shootSpeedFrac: [0.85, 1],
    tackleChance: 0.95,
    wildTackleChance: 0,
    boostChance: 0.7,
  },
};

export interface BotMemory {
  nextDecisionAt: number;
  targetX: number;
  targetY: number;
  aimAngle: number;
  wantsBoost: boolean;
}

export interface BotCtx extends KickCtx, TackleCtx {
  players: Map<string, SoccerPlayer>;
  inputs: Map<string, InputState>;
  botMemory: Map<string, BotMemory>;
}

function opponentGoalX(team: SoccerTeam): number {
  return team === "A" ? SOCCER_FIELD_W : 0;
}
function ownGoalX(team: SoccerTeam): number {
  return team === "A" ? 0 : SOCCER_FIELD_W;
}

/** A stable "lane" (0, 1, 2, ...) for a bot among its own team, based on
 * player id order — just enough to spread bots out vertically instead of
 * every one of them converging on the same holding spot. */
function laneIndex(ctx: BotCtx, bot: SoccerPlayer): { index: number; count: number } {
  const teammates = [...ctx.players.values()].filter((p) => p.team === bot.team && p.connected && !p.sentOff).sort((a, b) => a.id.localeCompare(b.id));
  return { index: Math.max(0, teammates.findIndex((p) => p.id === bot.id)), count: Math.max(1, teammates.length) };
}

function laneY(index: number, count: number): number {
  return (SOCCER_FIELD_H * (index + 1)) / (count + 1);
}

/** Runs every tick for every bot: keeps each one's cached decision (target
 * position + facing + a couple of booleans) fresh only every
 * profile.decisionEveryMs, writes the resulting movement into ctx.inputs
 * exactly like a real "input" message would, and — when the moment's
 * right — fires a kick or a tackle attempt through the same functions a
 * human's message handlers use. `onSentOff` is threaded straight through to
 * resolveTackle — a bot earning a red card needs the exact same forfeit
 * check a human's does (see soccer-server.ts's handleTackle for the human
 * side of this same callback). */
export function stepBotAI(ctx: BotCtx, now: number, onSentOff: (team: SoccerTeam) => void) {
  for (const bot of ctx.players.values()) {
    if (!bot.isBot || bot.sentOff || !bot.botDifficulty) continue;
    const profile = PROFILES[bot.botDifficulty];

    let mem = ctx.botMemory.get(bot.id);
    if (!mem || now >= mem.nextDecisionAt) {
      mem = decide(ctx, bot, profile, now);
      mem.nextDecisionAt = now + profile.decisionEveryMs;
      ctx.botMemory.set(bot.id, mem);
    }

    const dx = mem.targetX - bot.x;
    const dy = mem.targetY - bot.y;
    const deadzone = 8;
    ctx.inputs.set(bot.id, {
      up: dy < -deadzone,
      down: dy > deadzone,
      left: dx < -deadzone,
      right: dx > deadzone,
      boost: mem.wantsBoost,
      aimAngle: mem.aimAngle,
    });

    maybeAct(ctx, bot, profile, now, onSentOff);
  }
}

function decide(ctx: BotCtx, bot: SoccerPlayer, profile: BotProfile, now: number): BotMemory {
  const ball = ctx.ball;
  const controller = ball.controllerId ? ctx.players.get(ball.controllerId) : null;
  const noise = () => (Math.random() - 0.5) * 2 * profile.positionNoisePx;

  let targetX: number;
  let targetY: number;
  let aimAngle: number;

  if (controller && controller.id === bot.id) {
    // Carrying it myself — head for the opponent goal, aiming roughly at it
    // (maybeAct decides whether/when to actually strike).
    targetX = opponentGoalX(bot.team);
    targetY = GOAL_Y;
    aimAngle = Math.atan2(GOAL_Y - bot.y, opponentGoalX(bot.team) - bot.x);
  } else if (!profile.holdsPosition) {
    // "Dumb": everyone just piles onto the ball regardless of who has it —
    // the classic kid-soccer swarm.
    targetX = ball.x + noise();
    targetY = ball.y + noise();
    aimAngle = Math.atan2(ball.y - bot.y, ball.x - bot.x);
  } else if (controller && controller.team !== bot.team) {
    // Opponent has it — whoever on my team is closest presses them, the
    // rest hold a defensive lane between the ball and our own goal.
    const teammatesDist = [...ctx.players.values()]
      .filter((p) => p.team === bot.team && p.connected && !p.sentOff)
      .map((p) => Math.hypot(p.x - controller.x, p.y - controller.y));
    const myDist = Math.hypot(bot.x - controller.x, bot.y - controller.y);
    const amClosest = myDist <= Math.min(...teammatesDist) + 1;
    if (amClosest) {
      targetX = controller.x + noise();
      targetY = controller.y + noise();
    } else {
      const { index, count } = laneIndex(ctx, bot);
      const own = ownGoalX(bot.team);
      targetX = own + (controller.x - own) * 0.4 + noise();
      targetY = laneY(index, count) * 0.5 + controller.y * 0.5 + noise();
    }
    aimAngle = Math.atan2(controller.y - bot.y, controller.x - bot.x);
  } else if (controller && controller.team === bot.team) {
    // A teammate has it — get into a supporting attacking position instead
    // of crowding them, roughly ahead and spread by lane.
    const { index, count } = laneIndex(ctx, bot);
    const forward = opponentGoalX(bot.team);
    targetX = controller.x + (forward - controller.x) * 0.5 + noise();
    targetY = laneY(index, count) + noise();
    aimAngle = Math.atan2(ball.y - bot.y, ball.x - bot.x);
  } else {
    // Loose ball — chase it (holdsPosition bots still chase a free ball,
    // just don't abandon position for one an opponent is already holding).
    targetX = ball.x + noise();
    targetY = ball.y + noise();
    aimAngle = Math.atan2(ball.y - bot.y, ball.x - bot.x);
  }

  targetX = Math.max(0, Math.min(SOCCER_FIELD_W, targetX));
  targetY = Math.max(0, Math.min(SOCCER_FIELD_H, targetY));

  const distToBall = Math.hypot(ball.x - bot.x, ball.y - bot.y);
  const wantsBoost = distToBall > 120 && Math.random() < profile.boostChance;

  return { nextDecisionAt: now, targetX, targetY, aimAngle, wantsBoost };
}

function maybeAct(ctx: BotCtx, bot: SoccerPlayer, profile: BotProfile, now: number, onSentOff: (team: SoccerTeam) => void) {
  if (ctx.ball.controllerId === bot.id) {
    const goalX = opponentGoalX(bot.team);
    const distToGoal = Math.hypot(goalX - bot.x, GOAL_Y - bot.y);
    const inShootingRange = distToGoal < SOCCER_FIELD_W * 0.6;

    const teammate = openTeammate(ctx, bot);
    const shouldPass = teammate && Math.random() < profile.passChance && distToGoal > SOCCER_FIELD_W * 0.3;

    if (shouldPass && teammate) {
      const angle = Math.atan2(teammate.y - bot.y, teammate.x - bot.x) + jitter(profile.aimNoiseRad);
      bot.angle = angle;
      const dist = Math.hypot(teammate.x - bot.x, teammate.y - bot.y);
      const speed = Math.max(SOCCER_KICK_MIN_SPEED, Math.min(SOCCER_KICK_MAX_SPEED, dist / 12));
      applyKick(ctx, bot, speed, now);
    } else if (inShootingRange && Math.random() < 0.5) {
      const angle = Math.atan2(GOAL_Y - bot.y, goalX - bot.x) + jitter(profile.aimNoiseRad);
      bot.angle = angle;
      const [minF, maxF] = profile.shootSpeedFrac;
      const frac = minF + Math.random() * (maxF - minF);
      applyKick(ctx, bot, SOCCER_KICK_MIN_SPEED + (SOCCER_KICK_MAX_SPEED - SOCCER_KICK_MIN_SPEED) * frac, now);
    }
    return;
  }

  if (now < bot.tackleCooldownUntil) return;

  let nearestOpponent: SoccerPlayer | null = null;
  let nearestDist = SOCCER_TACKLE_RANGE;
  for (const p of ctx.players.values()) {
    if (p.team === bot.team || p.sentOff) continue;
    const dist = Math.hypot(p.x - bot.x, p.y - bot.y);
    if (dist < nearestDist) {
      nearestOpponent = p;
      nearestDist = dist;
    }
  }

  const opportunistic = nearestOpponent && ctx.ball.controllerId === nearestOpponent.id && Math.random() < profile.tackleChance;
  const wild = Math.random() < profile.wildTackleChance;
  if (opportunistic || wild) {
    bot.tackleCooldownUntil = now + SOCCER_TACKLE_COOLDOWN_MS;
    bot.tackleDashUntil = now + 220;
    bot.tackleDashAngle = bot.angle;
    resolveTackle(ctx, bot, now, onSentOff);
  }
}

function openTeammate(ctx: BotCtx, bot: SoccerPlayer): SoccerPlayer | null {
  let best: SoccerPlayer | null = null;
  let bestScore = -Infinity;
  for (const p of ctx.players.values()) {
    if (p.id === bot.id || p.team !== bot.team || p.sentOff) continue;
    const distToMe = Math.hypot(p.x - bot.x, p.y - bot.y);
    if (distToMe < 40 || distToMe > 400) continue;
    let nearestDefender = Infinity;
    for (const o of ctx.players.values()) {
      if (o.team === bot.team || o.sentOff) continue;
      nearestDefender = Math.min(nearestDefender, Math.hypot(o.x - p.x, o.y - p.y));
    }
    if (nearestDefender > bestScore) {
      bestScore = nearestDefender;
      best = p;
    }
  }
  return best;
}

function jitter(rad: number): number {
  return (Math.random() - 0.5) * 2 * rad;
}
