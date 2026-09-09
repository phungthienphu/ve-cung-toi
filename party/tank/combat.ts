// Damage resolution shared by every damage source (bullets, traps, hazards,
// monsters, bombs): applying HP loss, crediting a kill, and checking the
// mode-specific win condition. Every other tick subsystem that can hurt a
// tank calls into `damagePlayer` here instead of re-implementing scoring.

import {
  BLIND_DURATION_MS,
  BULLET_DAMAGE,
  BURN_DURATION_MS,
  KILL_TARGET,
  RESPAWN_DELAY_MS,
  ULTIMATE_DAMAGE_MULTIPLIER,
  type Team,
  type TankImpact,
  type TankKillEvent,
  type TankPlayer,
  type TankRoomMode,
  type TankRoomStatus,
} from "../../shared/tankTypes";
import { makeId } from "./geometry";

/** The subset of room state damage resolution needs to read or mutate.
 * `TankRoom` has every one of these fields, so passing `this` from the room
 * class satisfies this structurally with no extra glue. */
export interface CombatCtx {
  players: Map<string, TankPlayer>;
  mode: TankRoomMode;
  teamScores: Record<Team, number>;
  status: TankRoomStatus;
  winnerId: string | null;
  winningTeam: Team | null;
  kills: TankKillEvent[];
  impacts: TankImpact[];
}

/** Applies flat damage to a tank; kills + credits `killerId` (if any) once hp runs out. */
export function damagePlayer(ctx: CombatCtx, target: TankPlayer, amount: number, killerId: string | null) {
  if (!target.alive) return;
  target.hp -= amount;
  if (target.hp > 0) return;

  target.alive = false;
  target.respawnAt = Date.now() + RESPAWN_DELAY_MS;
  const killer = killerId ? ctx.players.get(killerId) : undefined;
  if (killer) {
    // Personal kill count still ticks up even on a teammate (per design:
    // "phe đồng đội bắn nhau vẫn tính") — but in team mode, only an enemy
    // kill advances the team's score toward the win condition.
    killer.score += 1;
    // Practice rooms have no win condition — free play only, ended by the
    // host explicitly rather than a kill target.
    if (ctx.mode === "team") {
      if (killer.team !== target.team) {
        ctx.teamScores[killer.team] += 1;
        if (ctx.teamScores[killer.team] >= KILL_TARGET) {
          ctx.status = "ended";
          ctx.winningTeam = killer.team;
        }
      }
    } else if (ctx.mode !== "practice" && killer.score >= KILL_TARGET) {
      ctx.status = "ended";
      ctx.winnerId = killer.id;
    }
  }
  ctx.kills.push({ id: makeId(), killerName: killer ? killer.name : null, victimName: target.name });
}

/** Same as damagePlayer, but a standing shield eats the hit first (one of
 * its charges, no damage) instead of being bypassed — for any damage source
 * that isn't already a bullet routed through applyHit below (monster
 * contact damage is the current example: it used to call damagePlayer
 * directly, which meant a shielded tank getting mauled by a monster took
 * full damage anyway). */
export function damageThroughShield(ctx: CombatCtx, target: TankPlayer, amount: number, ownerId: string | null) {
  if (target.shieldHitsLeft > 0) {
    target.shieldHitsLeft -= 1;
    ctx.impacts.push({ id: makeId(), x: target.x, y: target.y, kind: "shield" });
    return;
  }
  damagePlayer(ctx, target, amount, ownerId);
}

/** Applies bullet damage/effects to a hit tank; returns true if the tank died. */
export function applyHit(ctx: CombatCtx, target: TankPlayer, bulletKind: "normal" | "blind" | "big" | "fire", ownerId: string): boolean {
  if (target.shieldHitsLeft > 0) {
    target.shieldHitsLeft -= 1;
    ctx.impacts.push({ id: makeId(), x: target.x, y: target.y, kind: "shield" });
    return false;
  }
  if (bulletKind === "blind") {
    target.blindedUntil = Date.now() + BLIND_DURATION_MS;
    return false;
  }
  if (bulletKind === "fire") {
    target.burningUntil = Date.now() + BURN_DURATION_MS;
    target.burnOwnerId = ownerId;
  }
  const wasAlive = target.alive;
  const damage = bulletKind === "big" ? BULLET_DAMAGE * ULTIMATE_DAMAGE_MULTIPLIER : BULLET_DAMAGE;
  damagePlayer(ctx, target, damage, ownerId);
  return wasAlive && !target.alive;
}
