import { hillSkyRoads, hillSurface } from './terrain';
import type { HillInput } from './types';
import type { HillRaceSim } from './raceSim';

// A computer driver for HillRaceSim: it reads its own car and the road and
// sends inputs like a player would — so a bot plays by exactly the same
// physics and rules. Runs anywhere the race does (browser now, the room
// server later).

export type HillBotLevel = 'easy' | 'normal' | 'hard';

const LEVELS: Record<HillBotLevel, {
  /** Ticks between decisions: its reaction time. */
  every: number;
  /** Ticks late off the start line. */
  start: number;
  /** How far the nose may be off the slope before it corrects in the air (radians). */
  tolerance: number;
  /** Nose-up angle at which it lifts off the gas on a climb. */
  rear: number;
  jump: number;
  dash: number;
  /** Chance per decision of a moment's hesitation. */
  lapse: number;
  /** Looks further ahead, to land on the car in front rather than just hop it. */
  hunter: boolean;
}> = {
  easy: { every: 14, start: 30, tolerance: 0.5, rear: 0.9, jump: 0.25, dash: 0.15, lapse: 0.1, hunter: false },
  normal: { every: 8, start: 14, tolerance: 0.3, rear: 0.75, jump: 0.6, dash: 0.35, lapse: 0.03, hunter: false },
  hard: { every: 4, start: 4, tolerance: 0.18, rear: 0.65, jump: 0.9, dash: 0.6, lapse: 0, hunter: true },
};

export const HILL_BOT_NAMES = ['Tèo', 'Tí', 'Sửu', 'Dần', 'Mão', 'Thìn'];

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

export class HillBotDriver {
  private input: HillInput = { gas: false, brake: false };
  private next: number;
  private seq = 0;
  private rng: number;
  /** Per sky road (by section): did it decide to jump up onto it? Decided once, so it doesn't dither. */
  private decks = new Map<number, boolean>();

  constructor(readonly id: string, readonly level: HillBotLevel, seed: number) {
    this.rng = (seed >>> 0) || 1;
    this.next = LEVELS[level].start + Math.floor(this.random() * 10);
  }

  private random() {
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }

  /** Call before each race.step(); applies a new input when the bot changes its mind. */
  drive(race: HillRaceSim) {
    if (race.tick < this.next) return;
    const level = LEVELS[this.level];
    this.next = race.tick + level.every;
    const me = race.entries.find(entry => entry.id === this.id);
    if (!me || me.done || me.respawnAt) return;
    if (me.idle >= 180) race.requestRespawn(this.id);
    const car = me.sim.snapshot();
    const velocity = me.sim.chassis.getLinearVelocity();
    const angle = wrap(car.chassis.angle);
    let gas = true, brake = false, jump = false, dash = false;

    if (car.overturnRemaining !== null) {
      // Upside down: flip back with energy, or rock the car.
      if (car.energy >= 35) jump = true;
      else { gas = Math.floor(race.tick / 24) % 2 === 0; brake = !gas; }
    } else if (!car.grounded) {
      // In the air: line the car up with the slope it is about to land on.
      const landing = car.chassis.x + velocity.x * 0.45;
      const surface = (x: number) => hillSurface(race.seed, x, race.map, car.chassis.y);
      const slope = Math.atan2(surface(landing + 1) - surface(landing - 1), 2);
      const error = wrap(angle - slope);
      gas = error < -level.tolerance;
      brake = error > level.tolerance;
    } else {
      if (angle > level.rear) { gas = false; brake = angle > level.rear + 0.25; }
      const reach = level.hunter ? 7 : 5;
      const blocked = race.entries.some(other => {
        if (other === me || other.done || other.respawnAt) return false;
        const at = other.sim.chassis.getPosition();
        const gap = at.x - car.chassis.x;
        return gap > 1 && gap < reach && Math.abs(at.y - car.chassis.y) < 2.5 && other.sim.chassis.getLinearVelocity().x < velocity.x + 1;
      });
      // A sky road past a launch ramp: with enough speed, jump right at the lip (decided once per road, so it doesn't dither).
      const deck = hillSkyRoads(race.seed, car.chassis.x, car.chassis.x + 12, race.map).find(road => car.chassis.x > road.lip - 3 && car.chassis.x < road.lip + 0.5);
      if (deck && !this.decks.has(deck.section)) this.decks.set(deck.section, this.random() < level.jump);
      if (deck && this.decks.get(deck.section) && car.chassis.x > deck.lip - 1.5 && car.speed > 9 && car.jumpReady && car.energy >= 35) jump = true;
      else if (blocked && car.jumpReady && car.energy >= 35 && this.random() < level.jump) jump = true;
      else if (car.dashReady && car.energy >= 75 && Math.abs(angle) < 0.2 && car.speed < 12 && this.random() < level.dash) dash = true;
      if (this.random() < level.lapse) gas = false;
    }

    const next = { gas, brake, jump, dash };
    if (next.gas === this.input.gas && next.brake === this.input.brake && next.jump === !!this.input.jump && next.dash === !!this.input.dash) return;
    this.input = next;
    race.input(this.id, next, ++this.seq);
  }
}
