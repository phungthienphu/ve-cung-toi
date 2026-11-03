import { Vec2 } from 'planck';
import { HillSim } from './sim';
import { HillPhysicsWorld } from './world';
import { hillHeight } from './terrain';
import { HILL_DT, type HillInput, type HillMapId } from './types';
import type { HillRacer, HillRaceConfig, HillRaceFrame, HillRaceCar } from './raceTypes';
interface Entry { id: string; sim: HillSim; input: HillInput; ack: number; ghostUntil: number; respawnAt: number; stunUntil: number; idle: number; done: boolean; finishTick: number | null; stomps: number; squashed: number; crashes: number; air: number; flight: number; pendingJump: boolean; pendingDash: boolean }
/** Fixed-step authoritative race. No wall clock, networking or browser state. */
export class HillRaceSim {
  readonly map: HillMapId;
  readonly physics: HillPhysicsWorld;
  readonly entries: Entry[];
  tick = -180;
  deadline: number | null = null;
  ended = false;
  private pairCooldown = new Map<string, number>();
  private stomps: [number, number][] = [];
  constructor(readonly seed: number, readonly config: HillRaceConfig, players: HillRacer[]) {
    this.map = config.map === "random" ? (["tea", "sand", "mountain", "moon"] as const)[(seed >>> 0) % 4] : config.map;
    this.physics = new HillPhysicsWorld(seed, this.map);
    this.physics.update([5, 11]);
    const shuffled = [...players];
    let random = seed >>> 0;
    for (let i = shuffled.length - 1; i > 0; i--) { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; const j = random % (i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    this.entries = shuffled.map((p, slot) => {
      const sim = new HillSim(seed, { map: this.map, vehicle: config.vehicle === 'choice' ? p.vehicle : config.vehicle, raceFuel: config.mode === 'race' }, this.physics, slot);
      // Three levels per tower. Front column starts at 11m; rear at 5m.
      sim.resetAt(players.length > 3 && slot < 3 ? 11 : 5, (slot % 3) * 2.8);
      sim.addEnergy(-65); sim.setGhost(!config.collisions); sim.setActive(false);
      return { id: p.id, sim, input: { gas: false, brake: false }, ack: -1, ghostUntil: 0, respawnAt: 0, stunUntil: 0, idle: 0, done: false, finishTick: null, stomps: 0, squashed: 0, crashes: 0, air: 0, flight: 0, pendingJump: false, pendingDash: false };
    });
    this.physics.world.on('begin-contact', contact => {
      const a = contact.getFixtureA(), b = contact.getFixtureB();
      if (a.isSensor() || b.isSensor()) return;
      const slot = (body: typeof a) => (body.getBody().getUserData() as { hillSlot?: number } | null)?.hillSlot;
      const ai = slot(a), bi = slot(b);
      if (ai === undefined || bi === undefined || ai === bi) return;
      for (const [top, bottom] of [[ai, bi], [bi, ai]]) {
        const A = this.entries[top].sim.chassis, B = this.entries[bottom].sim.chassis;
        const dx = Math.abs(A.getPosition().x - B.getPosition().x);
        if (A.getPosition().y - B.getPosition().y > 1 && dx < this.entries[bottom].sim.config.halfWidth && A.getLinearVelocity().y - B.getLinearVelocity().y < -3) this.stomps.push([top, bottom]);
      }
    });
  }
  input(id: string, input: HillInput, seq: number) { const e = this.entries.find(e => e.id === id); if (e && seq > e.ack) { e.pendingJump ||= !!input.jump && !e.input.jump; e.pendingDash ||= !!input.dash && !e.input.dash; e.input = input; e.ack = seq; } }
  reconnect(id: string) { const e = this.entries.find(e => e.id === id); if (e) { e.ack = -1; this.neutral(id); } }
  neutral(id: string) { const e = this.entries.find(e => e.id === id); if (e) { e.input = { gas: false, brake: false }; e.pendingJump = false; e.pendingDash = false; } }
  requestRespawn(id: string) { const e = this.entries.find(e => e.id === id); if (this.tick > 0 && e && e.idle >= 180 && !e.done && !e.respawnAt) this.respawn(e); }
  // "Ai đi xa nhất": a respawn costs 25 fuel. To the finish: it tops up to 60% (the owner found 30% too little), so a car limping on empty can't get stuck under the same hill.
  private respawn(e: Entry) { e.crashes++; e.respawnAt = this.tick + 90; e.sim.setActive(false); const fuel = e.sim.snapshot().fuel; e.sim.setFuel(this.config.mode === 'distance' ? fuel - 25 : Math.max(fuel, 60)); }
  step() {
    if (this.ended) return;
    this.tick++;
    if (this.tick < 0) return;
    if (this.tick === 0) this.entries.forEach(e => e.sim.setActive(true));
    for (const e of this.entries) {
      if (e.done) continue;
      if (e.respawnAt) {
        if (this.tick < e.respawnAt) continue;
        const x = 5 + Math.max(0, Math.floor((e.sim.chassis.getPosition().x - 5) / 150)) * 150;
        const safeY = Math.max(...[-1, 0, 1].map(side => hillHeight(this.seed, x + side * e.sim.config.wheelbase / 2, this.map)));
        e.sim.resetAt(x, safeY); e.sim.setActive(true);
        e.respawnAt = 0; e.ghostUntil = this.tick + 90; e.idle = 0;
      }
      e.sim.setGhost(!this.config.collisions || e.ghostUntil > this.tick);
      const actions = { ...e.input, jump: e.input.jump || e.pendingJump, dash: e.input.dash || e.pendingDash };
      e.sim.prepareStep(e.stunUntil > this.tick ? { ...actions, gas: false } : actions);
      e.pendingJump = false; e.pendingDash = false;
    }
    this.physics.update(this.entries.map(e => e.sim.chassis.getPosition().x));
    this.physics.world.step(HILL_DT, 8, 3);
    for (const [a, b] of this.stomps) {
      const key = `${Math.min(a,b)}:${Math.max(a,b)}`; if ((this.pairCooldown.get(key) ?? -999) + 90 > this.tick) continue;
      this.pairCooldown.set(key, this.tick);
      const A = this.entries[a], B = this.entries[b]; A.stomps++; B.squashed++; B.stunUntil = this.tick + 48; A.sim.addEnergy(20);
      for (const body of [B.sim.chassis, ...B.sim.wheels]) body.setLinearVelocity(Vec2(body.getLinearVelocity().x * .4, body.getLinearVelocity().y * .4));
      for (const body of [A.sim.chassis, ...A.sim.wheels]) body.applyLinearImpulse(Vec2(0, body.getMass() * 4), body.getWorldCenter(), true);
    }
    this.stomps = [];
    for (const e of this.entries) {
      if (e.done || e.respawnAt) continue;
      e.sim.finishStep(e.stunUntil > this.tick ? { ...e.input, gas: false } : e.input);
      e.sim.drainEvents();
      const s = e.sim.snapshot();
      e.idle = s.speed < .4 ? e.idle + 1 : 0;
      if (!s.grounded) { e.flight++; e.air = Math.max(e.air, e.flight / 60); } else e.flight = 0;
      if (this.tick > 480 && e.idle >= 240) { e.ghostUntil = this.tick + 180; e.idle = 0; }
      if (s.finished === 'overturned' || s.chassis.y < hillHeight(this.seed, s.chassis.x, this.map) - 15) this.respawn(e);
      else if (this.config.mode === 'distance' ? s.fuel <= 0 : s.chassis.x >= this.config.length + 5) {
        e.done = true; e.finishTick = this.config.mode === 'race' ? this.tick : null; e.sim.setGhost(true); e.sim.setActive(false);
        if (this.config.mode === 'race' && this.deadline === null) this.deadline = this.tick + 1200;
      } else if (s.finished === 'fuel') { e.done = true; e.sim.setActive(false); }
    }
    // Bound abandoned races; six minutes is above the longest configured course.
    if (this.tick >= 21600 || (this.deadline !== null && this.tick >= this.deadline) || this.entries.every(e => e.done) || (this.config.mode === 'distance' && this.entries.filter(e => !e.done).length <= 1)) this.ended = true;
  }
  order() { return [...this.entries].sort((a, b) => (this.config.mode === "distance" ? Number(a.done) - Number(b.done) : (a.finishTick ?? Infinity) - (b.finishTick ?? Infinity)) || b.sim.chassis.getPosition().x - a.sim.chassis.getPosition().x).map(e => e.id); }
  snapshot(): HillRaceFrame {
    return { tick: this.tick, seed: this.seed, remaining: this.deadline === null ? null : Math.max(0, (this.deadline - this.tick) / 60), cars: this.entries.map(e => ({ id: e.id, state: { ...e.sim.snapshot(), distance: Math.max(0, e.sim.chassis.getPosition().x - 5) }, ghost: !this.config.collisions || this.tick >= 0 && e.ghostUntil > this.tick, respawning: !!e.respawnAt, squash: this.tick >= 0 && e.stunUntil > this.tick, stuck: e.idle >= 180, done: e.done, finishTick: e.finishTick, stomps: e.stomps, squashed: e.squashed, crashes: e.crashes, air: e.air, ack: e.ack } satisfies HillRaceCar)) };
  }
}
