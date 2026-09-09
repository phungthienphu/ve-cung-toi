// Forest monster spawning + AI: a pack sharing one nest (a real clump of
// bushes, not a lone tile), passive by default and wandering together near
// that nest, which only gives chase — individually, not as a pack — after a
// tank collides with or shoots one of them, and gives up (back to wandering)
// once the target escapes the leash range, dies, or the aggro timer lapses
// unrefreshed.

import {
  MONSTER_AGGRO_TIMEOUT_MS,
  MONSTER_CHASE_LEASH_RADIUS,
  MONSTER_CHASE_SPEED_MULTIPLIER,
  MONSTER_CONTACT_COOLDOWN_MS,
  MONSTER_DAMAGE,
  MONSTER_DIR_CHANGE_MS,
  MONSTER_HEAL_INTERVAL_MS,
  MONSTER_HP_MAX,
  MONSTER_HP_MIN,
  MONSTER_NEST_RADIUS,
  MONSTER_PACK_SIZE,
  MONSTER_REST_CHANCE,
  MONSTER_REST_DURATION_MS,
  MONSTER_SIZE,
  MONSTER_SPEED,
  NEST_PUDDLE_RADIUS,
  TANK_SIZE,
  type Direction,
  type Monster,
  type TankMapDef,
} from "../../shared/tankTypes";
import { type CombatCtx, damageThroughShield } from "./combat";
import { DIR_VECTOR, makeId, randomOpenTile, spawnPixel, tankBlocked, tileAt } from "./geometry";

/** 4-directionally-connected clusters of 'B' tiles on the map. */
function findBushClusters(map: TankMapDef): { x: number; y: number }[][] {
  const rows = map.layout.length;
  const cols = map.layout[0]?.length ?? 0;
  const visited = new Set<string>();
  const clusters: { x: number; y: number }[][] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = `${col},${row}`;
      if (map.layout[row][col] !== "B" || visited.has(key)) continue;
      const cluster: { x: number; y: number }[] = [];
      const queue: { x: number; y: number }[] = [{ x: col, y: row }];
      visited.add(key);
      while (queue.length > 0) {
        const cur = queue.pop()!;
        cluster.push(cur);
        for (const n of [
          { x: cur.x + 1, y: cur.y },
          { x: cur.x - 1, y: cur.y },
          { x: cur.x, y: cur.y + 1 },
          { x: cur.x, y: cur.y - 1 },
        ]) {
          const nKey = `${n.x},${n.y}`;
          if (visited.has(nKey) || map.layout[n.y]?.[n.x] !== "B") continue;
          visited.add(nKey);
          queue.push(n);
        }
      }
      clusters.push(cluster);
    }
  }
  return clusters;
}

/** A monster pack's nest should read as living somewhere real — a proper
 * clump of bushes, not a single lonely 'B' tile — so this prefers a cluster
 * of at least 3 connected bush tiles (falling back to any bush cluster, then
 * any open floor tile if a map somehow has no bushes at all). */
function pickNestTile(map: TankMapDef): { x: number; y: number } | null {
  const clusters = findBushClusters(map);
  const bigClusters = clusters.filter((c) => c.length >= 3);
  const pool = bigClusters.length > 0 ? bigClusters : clusters;
  if (pool.length === 0) return randomOpenTile(map);
  const cluster = pool[Math.floor(Math.random() * pool.length)];
  return cluster[Math.floor(Math.random() * cluster.length)];
}

function spawnMonsterAt(nestTile: { x: number; y: number }): Monster {
  const pos = spawnPixel(nestTile);
  const dirs: Direction[] = ["up", "down", "left", "right"];
  const maxHp = MONSTER_HP_MIN + Math.floor(Math.random() * (MONSTER_HP_MAX - MONSTER_HP_MIN + 1));
  return {
    id: makeId(),
    x: pos.x,
    y: pos.y,
    dir: dirs[Math.floor(Math.random() * dirs.length)],
    alive: true,
    hp: maxHp,
    maxHp,
    respawnAt: null,
    nestX: pos.x,
    nestY: pos.y,
    aggroPlayerId: null,
  };
}

/** The whole map's monster population: one pack, sharing one nest. */
export function spawnMonsterPack(map: TankMapDef): Monster[] {
  const nestTile = pickNestTile(map) ?? { x: 1, y: 1 };
  return Array.from({ length: MONSTER_PACK_SIZE }, () => spawnMonsterAt(nestTile));
}

export interface MonstersTickCtx extends CombatCtx {
  monsters: Monster[];
  lastMonsterDirChangeAt: Map<string, number>;
  lastMonsterContactAt: Map<string, number>;
  lastMonsterHealAt: Map<string, number>;
  monsterAggroUntil: Map<string, number>;
  monsterRestUntil: Map<string, number>;
}

function nestKeyOf(monster: Monster): string {
  return `${monster.nestX},${monster.nestY}`;
}

export function stepMonsters(ctx: MonstersTickCtx, map: TankMapDef, now: number) {
  // Non-aggro pack-mates (sharing a nest) decide their wander direction (or
  // to rest) together, once per pack per tick — keyed by nest position
  // rather than each monster's own id — so the pack visibly moves as a
  // group instead of each member picking its own random direction.
  const packs = new Map<string, Monster[]>();
  for (const monster of ctx.monsters) {
    if (!monster.alive || monster.aggroPlayerId) continue;
    const key = nestKeyOf(monster);
    const pack = packs.get(key);
    if (pack) pack.push(monster);
    else packs.set(key, [monster]);
  }
  for (const [nestKey, pack] of packs) {
    if (now < (ctx.monsterRestUntil.get(nestKey) ?? 0)) continue; // whole pack resting
    const lastChange = ctx.lastMonsterDirChangeAt.get(nestKey) ?? 0;
    if (now - lastChange < MONSTER_DIR_CHANGE_MS) continue;
    ctx.lastMonsterDirChangeAt.set(nestKey, now);

    const leader = pack[0];
    const strayedFromNest = Math.hypot(leader.x - leader.nestX, leader.y - leader.nestY) > MONSTER_NEST_RADIUS;
    if (strayedFromNest) {
      // Each member walks back toward the shared nest from wherever it
      // currently is — naturally regroups without needing one exact shared
      // direction.
      for (const m of pack) {
        const dx = m.nestX - m.x;
        const dy = m.nestY - m.y;
        m.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      }
    } else if (Math.random() < MONSTER_REST_CHANCE) {
      ctx.monsterRestUntil.set(nestKey, now + MONSTER_REST_DURATION_MS);
    } else {
      const dirs: Direction[] = ["up", "down", "left", "right"];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      for (const m of pack) m.dir = dir;
    }
  }

  for (const monster of ctx.monsters) {
    if (!monster.alive) {
      if (monster.respawnAt !== null && now >= monster.respawnAt) {
        // Respawns at its own nest, not a fresh random spot — the nest is
        // a fixed lair for the whole match (marked on the ground for players).
        monster.x = monster.nestX;
        monster.y = monster.nestY;
        monster.alive = true;
        monster.hp = monster.maxHp;
        monster.respawnAt = null;
        monster.aggroPlayerId = null;
        ctx.monsterAggroUntil.delete(monster.id);
      }
      continue;
    }

    if (monster.aggroPlayerId) {
      const target = ctx.players.get(monster.aggroPlayerId);
      const aggroUntil = ctx.monsterAggroUntil.get(monster.id) ?? 0;
      const targetGone = !target || !target.alive || !target.connected;
      const tooFar = !targetGone && target ? Math.hypot(target.x - monster.nestX, target.y - monster.nestY) > MONSTER_CHASE_LEASH_RADIUS : true;
      if (targetGone || tooFar || now >= aggroUntil) {
        monster.aggroPlayerId = null;
        ctx.monsterAggroUntil.delete(monster.id);
      }
    }

    let dir: Direction | null;
    const speed = monster.aggroPlayerId ? MONSTER_SPEED * MONSTER_CHASE_SPEED_MULTIPLIER : MONSTER_SPEED;
    if (monster.aggroPlayerId) {
      const target = ctx.players.get(monster.aggroPlayerId)!;
      const dx = target.x - monster.x;
      const dy = target.y - monster.y;
      dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    } else {
      const nestKey = nestKeyOf(monster);
      dir = now < (ctx.monsterRestUntil.get(nestKey) ?? 0) ? null : monster.dir;
    }

    if (dir) {
      monster.dir = dir;
      const v = DIR_VECTOR[dir];
      const nx = monster.x + v.dx * speed;
      const ny = monster.y + v.dy * speed;
      let blockedAxis = false;
      if (!tankBlocked(map, nx, monster.y)) monster.x = nx;
      else blockedAxis = true;
      if (!tankBlocked(map, monster.x, ny)) monster.y = ny;
      else blockedAxis = true;
      // Bounced off a wall — make the whole pack reconsider next tick
      // instead of just this one member.
      if (blockedAxis && !monster.aggroPlayerId) ctx.lastMonsterDirChangeAt.set(nestKeyOf(monster), 0);
    }

    for (const player of ctx.players.values()) {
      if (!player.alive) continue;
      const dist = Math.hypot(player.x - monster.x, player.y - monster.y);
      if (dist >= TANK_SIZE / 2 + MONSTER_SIZE / 2) continue;
      const key = `${player.id}:${monster.id}`;
      const last = ctx.lastMonsterContactAt.get(key) ?? 0;
      if (now - last >= MONSTER_CONTACT_COOLDOWN_MS) {
        ctx.lastMonsterContactAt.set(key, now);
        damageThroughShield(ctx, player, MONSTER_DAMAGE, null);
        monster.aggroPlayerId = player.id;
        ctx.monsterAggroUntil.set(monster.id, now + MONSTER_AGGRO_TIMEOUT_MS);
      }
    }

    // Resting in its own puddle or hiding in any bush slowly heals a
    // monster back up — whole-HP steps on an interval, since its max HP is
    // too small for a per-tick fractional regen to read as anything.
    if (monster.hp < monster.maxHp) {
      const inNest = Math.hypot(monster.x - monster.nestX, monster.y - monster.nestY) < NEST_PUDDLE_RADIUS;
      const inBush = tileAt(map, monster.x, monster.y) === "B";
      if (inNest || inBush) {
        const lastHeal = ctx.lastMonsterHealAt.get(monster.id) ?? 0;
        if (now - lastHeal >= MONSTER_HEAL_INTERVAL_MS) {
          ctx.lastMonsterHealAt.set(monster.id, now);
          monster.hp = Math.min(monster.maxHp, monster.hp + 1);
        }
      }
    }
  }
}
