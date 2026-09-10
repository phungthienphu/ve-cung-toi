// bigRed's hook resolves in stages instead of instantly: the chain snaps out
// (HOOK_THROW_MS) and only grabs/damages/stuns once it actually reaches the
// target, then reels back in over HOOK_PULL_DURATION_MS with the target in
// tow (see players-tick.ts's/monsters-tick.ts's hookPull* interpolation).
// This file tracks the in-flight throw between "fired" and "landed" — it's
// server bookkeeping only, never broadcast to clients (the impact list is
// what tells them what to draw).

import {
  HOOK_DAMAGE,
  HOOK_PULL_DISTANCE,
  HOOK_PULL_DURATION_MS,
  HOOK_STUN_MS,
  MONSTER_AGGRO_TIMEOUT_MS,
  MONSTER_RESPAWN_DELAY_MS,
  type Monster,
  type Pickup,
  type TankMapDef,
} from "../../shared/tankTypes";
import { type CombatCtx, damageThroughShield } from "./combat";
import { makeId, tankBlocked } from "./geometry";

export interface PendingHook {
  id: string;
  casterId: string;
  targetKind: "player" | "monster";
  targetId: string;
  // The caster's aim at the moment of firing, frozen — the pull always drags
  // the target to "in front of where bigRed was aiming", even if bigRed
  // itself has since turned to track something else during the throw.
  angle: number;
  resolveAt: number;
}

export interface HookFieldCtx extends CombatCtx {
  monsters: Monster[];
  monsterAggroUntil: Map<string, number>;
  pickups: Pickup[];
}

/** Resolves every pending hook whose throw has landed (now >= resolveAt) —
 * applying damage/stun and kicking off the reel-in pull — and returns
 * whatever's still mid-flight. Called once per tick, same shape as
 * stepRedBarrages. */
export function stepHooks(ctx: HookFieldCtx, map: TankMapDef, pending: PendingHook[], now: number): PendingHook[] {
  const remaining: PendingHook[] = [];
  for (const hook of pending) {
    if (now < hook.resolveAt) {
      remaining.push(hook);
      continue;
    }

    const caster = ctx.players.get(hook.casterId);
    if (!caster || !caster.alive) continue; // caster left or died mid-throw — the chain just vanishes

    const ux = Math.cos(hook.angle);
    const uy = Math.sin(hook.angle);
    const pulledX = caster.x + ux * HOOK_PULL_DISTANCE;
    const pulledY = caster.y + uy * HOOK_PULL_DISTANCE;

    if (hook.targetKind === "player") {
      const target = ctx.players.get(hook.targetId);
      if (!target || !target.alive) continue;
      const targetX = target.x;
      const targetY = target.y;
      damageThroughShield(ctx, target, HOOK_DAMAGE, hook.casterId);
      if (target.alive) {
        target.stunnedUntil = now + HOOK_STUN_MS;
        target.hookedUntil = now + HOOK_STUN_MS;
        target.hookPullFromX = target.x;
        target.hookPullFromY = target.y;
        target.hookPullToX = tankBlocked(map, pulledX, pulledY) ? target.x : pulledX;
        target.hookPullToY = tankBlocked(map, pulledX, pulledY) ? target.y : pulledY;
        target.hookPullUntil = now + HOOK_PULL_DURATION_MS;
        ctx.impacts.push({ id: makeId(), x: targetX, y: targetY, kind: "hook", x2: caster.x, y2: caster.y, durationMs: HOOK_PULL_DURATION_MS });
      }
    } else {
      const monster = ctx.monsters.find((m) => m.id === hook.targetId);
      if (!monster || !monster.alive) continue;
      const targetX = monster.x;
      const targetY = monster.y;
      monster.hp -= HOOK_DAMAGE;
      if (monster.hp <= 0) {
        monster.alive = false;
        monster.respawnAt = now + MONSTER_RESPAWN_DELAY_MS;
        monster.aggroPlayerId = null;
        ctx.pickups.push({ id: makeId(), x: monster.x, y: monster.y, kind: "shield" });
      } else {
        monster.aggroPlayerId = hook.casterId;
        ctx.monsterAggroUntil.set(monster.id, now + MONSTER_AGGRO_TIMEOUT_MS);
        monster.hookPullFromX = monster.x;
        monster.hookPullFromY = monster.y;
        monster.hookPullToX = tankBlocked(map, pulledX, pulledY) ? monster.x : pulledX;
        monster.hookPullToY = tankBlocked(map, pulledX, pulledY) ? monster.y : pulledY;
        monster.hookPullUntil = now + HOOK_PULL_DURATION_MS;
        ctx.impacts.push({ id: makeId(), x: targetX, y: targetY, kind: "hook", x2: caster.x, y2: caster.y, durationMs: HOOK_PULL_DURATION_MS });
      }
    }
  }
  return remaining;
}
