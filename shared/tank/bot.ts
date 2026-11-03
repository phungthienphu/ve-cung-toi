import { BUSH_REVEAL_RADIUS, TANK_SIZE, TILE_SIZE, VISION_RADIUS, ULTIMATE_ACTIVATION_MODE, ULTIMATE_CONFIG, skinForColor, type TankClientMessage, type TankMapDef, type TankPlayer, type TankPublicState } from './types';
import { tankBlocked, tileAt } from './movement';

export type TankBotDifficulty = 'easy' | 'normal' | 'hard';
export const TANK_BOT_LEVELS = {
  easy: { think: 240, error: .24, range: 220 },
  normal: { think: 160, error: .12, range: 300 },
  hard: { think: 110, error: .045, range: 360 },
};

/** Grid route, bounded by map size; tanks never cut diagonally through wall corners. */
export function tankBotWaypoint(map: TankMapDef, from: { x: number; y: number }, to: { x: number; y: number }, obstacles: readonly { x: number; y: number }[] = []) {
  const cols = map.layout[0].length, rows = map.layout.length;
  const index = (p: { x: number; y: number }) => Math.floor(p.y / TILE_SIZE) * cols + Math.floor(p.x / TILE_SIZE);
  const start = index(from), goal = index(to), previous = new Int32Array(cols * rows).fill(-1);
  if (start < 0 || start >= previous.length || goal < 0 || goal >= previous.length) return from;
  const queue = [start]; previous[start] = start;
  for (let head = 0; head < queue.length && head < 4096; head++) {
    const current = queue[head]; if (current === goal) break;
    const x = current % cols, y = Math.floor(current / cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, next = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || previous[next] !== -1) continue;
      if (tankBlocked(map, (nx + .5) * TILE_SIZE, (ny + .5) * TILE_SIZE) || map.layout[ny][nx] === 'H') continue;
      if (obstacles.some(o => Math.abs(o.x - (nx + .5) * TILE_SIZE) < (TILE_SIZE + TANK_SIZE) / 2 && Math.abs(o.y - (ny + .5) * TILE_SIZE) < (TILE_SIZE + TANK_SIZE) / 2)) continue;
      previous[next] = current; queue.push(next);
    }
  }
  if (previous[goal] === -1) return from;
  let next = goal;
  while (previous[next] !== start && next !== start) next = previous[next];
  // First align with a tile centre so turning at a wall never clips the corner.
  const centre = { x: (start % cols + .5) * TILE_SIZE, y: (Math.floor(start / cols) + .5) * TILE_SIZE };
  const point = { x: (next % cols + .5) * TILE_SIZE, y: (Math.floor(next / cols) + .5) * TILE_SIZE };
  if (point.x !== centre.x && Math.abs(from.y - centre.y) > 2) return { x: from.x, y: centre.y };
  if (point.y !== centre.y && Math.abs(from.x - centre.x) > 2) return { x: centre.x, y: from.y };
  return point;
}

export function tankBotCanSee(map: TankMapDef, from: { x: number; y: number }, to: { x: number; y: number }) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const tile = tileAt(map, to.x, to.y);
  if ((tile === 'B' || tile === 'S') && distance > BUSH_REVEAL_RADIUS) return false;
  for (let d = 0; d < distance; d += 8) {
    const t = d / distance;
    if (tileAt(map, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t) === '#') return false;
  }
  return true;
}

/** AI emits ordinary player commands. The engine owns every cooldown, hit and resource. */
export class TankBot {
  private nextThink = 0;
  private destination: { x: number; y: number } | null = null;
  private routeAt = 0;
  private wanderAt = 0;
  private progressAt = 0;
  private progressPosition = { x: 0, y: 0 };
  private waypoint = { x: 0, y: 0 };
  constructor(readonly difficulty: TankBotDifficulty) {}
  decide(self: TankPlayer, state: Omit<TankPublicState, 'players'> & { players: TankPlayer[] }, map: TankMapDef, now: number): TankClientMessage[] {
    // Steering must update every simulation tick: holding a turn until the next
    // combat decision overshoots tile centres and oscillates against corners.
    const thinking = now >= this.nextThink;
    const level = TANK_BOT_LEVELS[this.difficulty];
    if (thinking) this.nextThink = now + level.think;
    const idle = { type: 'input' as const, up: false, down: false, left: false, right: false, boost: false };
    if (!self.alive) return [idle];
    const candidates = state.players.filter(p => p.id !== self.id && p.alive && p.connected && (state.mode !== 'team' || p.team !== self.team));
    const target = candidates.filter(p => Math.hypot(p.x - self.x, p.y - self.y) < (self.blindedUntil && self.blindedUntil > now ? VISION_RADIUS : level.range) && tankBotCanSee(map, self, p))
      .sort((a, b) => Math.hypot(a.x - self.x, a.y - self.y) - Math.hypot(b.x - self.x, b.y - self.y))[0];
    const pickup = state.pickups.filter(p => (self.hp < 65 ? p.kind === 'health' : true) && Math.hypot(p.x - self.x, p.y - self.y) < 250)
      .sort((a, b) => Math.hypot(a.x - self.x, a.y - self.y) - Math.hypot(b.x - self.x, b.y - self.y))[0];
    if (!this.destination || Math.hypot(this.destination.x - self.x, this.destination.y - self.y) < 15 || now >= this.wanderAt) {
      this.wanderAt = now + 3000;
      for (let i = 0; i < 40; i++) {
        const x = (1.5 + Math.floor(Math.random() * (map.layout[0].length - 3))) * TILE_SIZE;
        const y = (1.5 + Math.floor(Math.random() * (map.layout.length - 3))) * TILE_SIZE;
        if (!tankBlocked(map, x, y) && tileAt(map, x, y) !== 'H') { this.destination = { x, y }; break; }
      }
    }
    if (now - this.progressAt >= 900) {
      if (Math.hypot(self.x - this.progressPosition.x, self.y - this.progressPosition.y) < 5) {
        this.destination = null;
        this.wanderAt = 0;
        this.routeAt = 0;
      }
      this.progressPosition = { x: self.x, y: self.y };
      this.progressAt = now;
    }
    const goal = self.hp < 65 && pickup ? pickup : target ?? pickup ?? this.destination ?? self;
    if (now >= this.routeAt || Math.hypot(this.waypoint.x - self.x, this.waypoint.y - self.y) < 3) {
      this.waypoint = tankBotWaypoint(map, self, goal, state.crates); this.routeAt = now + 450;
    }
    let dx = this.waypoint.x - self.x, dy = this.waypoint.y - self.y;
    // Sidestep an approaching visible round, with the same walls as the player.
    const threat = this.difficulty !== 'easy' && state.bullets.find(b => b.ownerId !== self.id && Math.hypot(b.x - self.x, b.y - self.y) < 90 && Math.cos(b.angle) * (self.x - b.x) + Math.sin(b.angle) * (self.y - b.y) > 0 && tankBotCanSee(map, self, b));
    if (threat) {
      for (const side of [1, -1]) {
        const x = -Math.sin(threat.angle) * side * 20, y = Math.cos(threat.angle) * side * 20;
        if (!tankBlocked(map, self.x + x, self.y + y)) { dx = x; dy = y; break; }
      }
    } else if (target && Math.hypot(target.x - self.x, target.y - self.y) < 100 && self.hp >= 65) dx = dy = 0;
    const angle = target ? Math.atan2(target.y - self.y, target.x - self.x) + (Math.random() * 2 - 1) * level.error : Math.atan2(dy, dx);
    const commands: TankClientMessage[] = [{ ...idle, up: dy < -2, down: dy > 2, left: dx < -2, right: dx > 2, boost: !!threat || self.hp < 35, aimAngle: angle }];
    const blockingCrate = state.crates.find(c => Math.hypot(c.x - self.x, c.y - self.y) < TILE_SIZE * 1.6);
    if (thinking && !target && blockingCrate && Math.hypot(dx, dy) < 3) {
      const input = commands[0];
      if (input.type === 'input') input.aimAngle = Math.atan2(blockingCrate.y - self.y, blockingCrate.x - self.x);
      commands.push({ type: 'shoot' });
    }
    if (target && thinking) {
      const blocked = state.crates.some(c => {
        const along = (c.x - self.x) * Math.cos(angle) + (c.y - self.y) * Math.sin(angle);
        const across = Math.abs((c.x - self.x) * Math.sin(angle) - (c.y - self.y) * Math.cos(angle));
        return along > 0 && along < Math.hypot(target.x - self.x, target.y - self.y) && across < TILE_SIZE / 2;
      });
      // Shooting a blocking crate is useful too; it is destructible under normal rules.
      if ((!blocked || Math.random() < .4) && self.sniperChargingSince === null) commands.push({ type: 'shoot' });
      const skin = skinForColor(self.color), activation = ULTIMATE_ACTIVATION_MODE[skin];
      if (self.ultimateEnergy >= ULTIMATE_CONFIG[skin].maxEnergy) {
        if (activation === 'target') commands.push({ type: 'throw_bomb', x: target.x, y: target.y });
        else if (activation === 'charge') {
          if (self.sniperChargingSince === null) commands.push({ type: 'charge_ultimate' });
          else if (now - self.sniperChargingSince > 700) commands.push({ type: 'shoot', big: true });
        } else commands.push({ type: 'shoot', big: true });
      }
      const item = self.items.find(item => item !== 'shield' || self.hp < 55);
      if (item) commands.push({ type: 'use_item', kind: item });
    }
    return commands.sort((a, b) => Number(a.type === "shoot" && !a.big) - Number(b.type === "shoot" && !b.big));
  }
}
