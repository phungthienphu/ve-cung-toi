import { hillSurface, hillWaterLevel } from "@shared/hill/terrain";
import { HILL_VEHICLES, type HillMapId, type HillSnapshot } from "@shared/hill/types";
import { playHillBump, playHillLanding, playHillScrape, playHillSplash, playHillSquash } from "@/lib/sound";

// Cosmetic "juice" on top of the physics: dust and sand from the wheels
// (more when they spin), splashes through ravine water, a puff on hard landings, sparks where two cars bang
// together or a roof scrapes, "BẸP!" on a stomp, and a bit of screen shake.
// It is worked out from the car states each frame, so it behaves the same
// solo, against bots and online, and nothing goes over the network.

export interface FxCar {
  id: string;
  state: HillSnapshot;
  ghost?: boolean;
  squash?: boolean;
  respawning?: boolean;
}

/** World → screen, as drawHill frames it this frame. */
export interface FxProjection {
  s: number;
  sx: (x: number) => number;
  sy: (y: number) => number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  gravity: number;
  drag: number;
  spark: boolean;
}

interface Pop {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface Memory {
  /** Each wheel's bottom under water last frame. */
  wet: boolean[];
  grounded: boolean;
  vx: number;
  vy: number;
  squash: boolean;
  jumpCooldown: number;
  dashCooldown: number;
}

/** Per map: dust colours, how it falls (moon dust hangs in the air), how much the wheels throw. */
const DUST: Record<HillMapId, { colors: string[]; gravity: number; drag: number; amount: number; life: number }> = {
  tea: { colors: ["#a57a4f", "#c49a6c", "#8c6a45"], gravity: -1.5, drag: 1.6, amount: 1, life: 0.8 },
  sand: { colors: ["#f1cf8d", "#e3b56f", "#f7deaa"], gravity: -5, drag: 1.2, amount: 1.8, life: 0.75 },
  mountain: { colors: ["#9aa3a8", "#7d878c", "#b3bbbf"], gravity: -7, drag: 1.3, amount: 0.8, life: 0.6 },
  moon: { colors: ["#c8cbdc", "#a9adc2", "#e1e3ee"], gravity: -0.25, drag: 0.35, amount: 1, life: 2.2 },
};
const MAX_PARTICLES = 260;
const SPRAY = ["#d8f1ff", "#a8dcff", "#ffffff", "#7cc4f2"];
const POP_SECONDS = 0.9;
const between = (low: number, high: number) => low + Math.random() * (high - low);
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

export class HillFx {
  private particles: Particle[] = [];
  private pops: Pop[] = [];
  private memory = new Map<string, Memory>();
  private bumped = new Map<string, number>();
  private trauma = 0;
  private time = 0;
  private scrapedAt = -1;
  private calm = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /** A new run: forget the previous cars so nothing "lands" on the first frame. */
  reset() {
    this.particles = [];
    this.pops = [];
    this.memory.clear();
    this.bumped.clear();
    this.trauma = 0;
  }

  /** Spawns effects from this frame's cars. `mine`: the car the camera follows — it alone shakes the screen, buzzes and plays sounds. */
  observe(cars: FxCar[], seed: number, map: HillMapId, dt: number, mine: string) {
    if (dt <= 0) return;
    this.time += dt;
    const dust = DUST[map];
    for (const car of cars) {
      const state = car.state;
      if (car.respawning) {
        this.memory.delete(car.id);
        continue;
      }
      const vehicle = HILL_VEHICLES[state.vehicle];
      const body = state.motion[0] ?? { vx: 0, vy: 0, omega: 0 };
      const before = this.memory.get(car.id);
      const own = car.id === mine;

      // Wheels on the ground (or a deck) throw dust behind them; wheelspin throws a lot more. In water they spray instead.
      const wet = state.wheels.map((wheel) => {
        const level = hillWaterLevel(seed, wheel.x, map);
        return level !== null && wheel.y - vehicle.wheelRadius < level;
      });
      state.wheels.forEach((wheel, i) => {
        const motion = state.motion[i + 1] ?? body;
        if (wet[i]) {
          const level = hillWaterLevel(seed, wheel.x, map)!;
          const speed = Math.hypot(motion.vx, motion.vy);
          if (!before?.wet[i] && speed > 4) {
            // Hitting the water: a big splash.
            for (let k = 0; k < 10 + Math.min(20, speed * 1.5); k++) this.drop(wheel.x, level, motion.vx * 0.4 + between(-2.5, 2.5), between(2, 3 + speed * 0.3));
            if (own) playHillSplash(Math.min(1, speed / 15));
          }
          // Ploughing through it: a spray off the back of the wheel.
          for (let count = speed * 2.2 * dt; count > 0; count -= 1) if (Math.random() < count) this.drop(wheel.x - Math.sign(motion.vx || 1) * vehicle.wheelRadius * 0.6, level, -motion.vx * 0.25 + between(-1, 1), between(1.5, 2.5 + speed * 0.15));
          return;
        }
        const ground = hillSurface(seed, wheel.x, map, wheel.y);
        if (wheel.y - vehicle.wheelRadius - ground > 0.18) return;
        const slip = Math.abs(motion.vx + motion.omega * vehicle.wheelRadius);
        let count = (Math.abs(motion.vx) * 0.22 + slip * 1.2) * dust.amount * dt;
        const back = motion.omega <= 0 ? -1 : 1;
        for (; count > 0; count -= 1) {
          if (Math.random() > count) break;
          this.add({
            x: wheel.x + back * vehicle.wheelRadius * 0.4,
            y: ground + 0.08,
            vx: back * between(0.5, 1.2) * (0.6 + Math.min(4, slip) * 0.5) + motion.vx * 0.3,
            vy: between(0.6, 1.8) + Math.min(3, slip) * 0.3,
            life: dust.life * between(0.6, 1.2),
            size: between(0.1, 0.2),
            grow: 0.35,
            color: pick(dust.colors),
            gravity: dust.gravity,
            drag: dust.drag,
          });
        }
      });

      if (before) {
        // Hard landing: a ring of dust, and a jolt if it's your car.
        if (state.grounded && !before.grounded && before.vy < -5) {
          const strength = Math.min(1, (-before.vy - 5) / 10);
          this.puff(state.chassis.x, hillSurface(seed, state.chassis.x, map, state.chassis.y), vehicle.halfWidth, 8 + strength * 16, dust);
          if (own) {
            this.shake(0.2 + strength * 0.35);
            if (strength > 0.4) {
              navigator.vibrate?.(20);
              playHillLanding();
            }
          }
        }
        // A jump kicks dust down; a dash kicks it back.
        if (state.jumpCooldown > before.jumpCooldown + 0.2) this.puff(state.chassis.x, hillSurface(seed, state.chassis.x, map, state.chassis.y), vehicle.halfWidth * 0.7, 10, dust);
        if (state.dashCooldown > before.dashCooldown + 0.5) {
          const rear = state.wheels[0];
          if (rear) this.puff(rear.x - vehicle.wheelRadius, hillSurface(seed, rear.x, map, rear.y), 0.4, 10, dust, -1);
        }
        // Stomped flat.
        if (car.squash && !before.squash) {
          this.pops.push({ x: state.chassis.x, y: state.chassis.y + 1.4, text: "BẸP!", color: "#ff6b6b", life: POP_SECONDS });
          this.puff(state.chassis.x, state.chassis.y - 0.4, vehicle.halfWidth, 14, dust);
          if (own) {
            this.shake(0.65);
            navigator.vibrate?.([30, 40, 30]);
            playHillSquash();
          }
        }
      }

      // Upside down and still moving: the roof scrapes and sparks.
      if (state.overturnRemaining !== null && Math.abs(body.vx) > 1.5 && Math.random() < dt * 40) {
        const angle = state.chassis.angle;
        this.spark(state.chassis.x - Math.cos(angle) * 0.15 - Math.sin(angle) * 1.1, state.chassis.y - Math.sin(angle) * 0.15 + Math.cos(angle) * 1.1, -body.vx * 0.3, 1.5);
        if (own && this.time - this.scrapedAt > 0.25) {
          this.scrapedAt = this.time;
          playHillScrape();
        }
      }

      this.memory.set(car.id, { wet, grounded: state.grounded, vx: body.vx, vy: body.vy, squash: !!car.squash, jumpCooldown: state.jumpCooldown, dashCooldown: state.dashCooldown });
    }

    this.bumps(cars, mine);
  }

  /** Two solid cars meeting fast: sparks at the contact point, "BỐP!" for big hits. Uses last frame's speeds, from before the hit. */
  private bumps(cars: FxCar[], mine: string) {
    const solid = cars.filter((car) => !car.ghost && !car.respawning);
    for (let i = 0; i < solid.length; i++) {
      for (let j = i + 1; j < solid.length; j++) {
        const [rear, front] = solid[i].state.chassis.x < solid[j].state.chassis.x ? [solid[i], solid[j]] : [solid[j], solid[i]];
        const a = rear.state.chassis;
        const b = front.state.chassis;
        const reach = HILL_VEHICLES[rear.state.vehicle].halfWidth + HILL_VEHICLES[front.state.vehicle].halfWidth + 0.25;
        if (b.x - a.x > reach || Math.abs(a.y - b.y) > 1.6) continue;
        const closing = (this.memory.get(rear.id)?.vx ?? 0) - (this.memory.get(front.id)?.vx ?? 0);
        const key = rear.id < front.id ? `${rear.id}|${front.id}` : `${front.id}|${rear.id}`;
        if (closing < 2.5 || this.time - (this.bumped.get(key) ?? -9) < 0.5) continue;
        this.bumped.set(key, this.time);
        const strength = Math.min(1, closing / 12);
        const x = a.x + HILL_VEHICLES[rear.state.vehicle].halfWidth;
        const y = (a.y + b.y) / 2 + 0.2;
        for (let k = 0; k < 8 + strength * 18; k++) this.spark(x, y, between(-4, 4), between(1, 5));
        if (strength > 0.35) this.pops.push({ x, y: y + 1.2, text: "BỐP!", color: "#ffd166", life: POP_SECONDS });
        if (rear.id === mine || front.id === mine) {
          this.shake(0.3 + strength * 0.5);
          navigator.vibrate?.(30);
          playHillBump(strength);
        }
      }
    }
  }

  private add(particle: Omit<Particle, "max" | "spark"> & { spark?: boolean }) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({ ...particle, max: particle.life, spark: particle.spark ?? false });
  }

  private puff(x: number, y: number, spread: number, count: number, dust: (typeof DUST)[HillMapId], direction = 0) {
    for (let i = 0; i < count; i++) {
      const side = direction || (Math.random() < 0.5 ? -1 : 1);
      this.add({
        x: x + between(-spread, spread),
        y: y + 0.1,
        vx: side * between(1, 3.5),
        vy: between(0.3, 1.6),
        life: dust.life * between(0.7, 1.3),
        size: between(0.15, 0.3),
        grow: 0.5,
        color: pick(dust.colors),
        gravity: dust.gravity,
        drag: dust.drag,
      });
    }
  }

  private drop(x: number, y: number, vx: number, vy: number) {
    this.add({ x, y: y + 0.05, vx, vy, life: between(0.4, 0.75), size: between(0.05, 0.11), grow: 0, color: pick(SPRAY), gravity: -12, drag: 0.6 });
  }

  private spark(x: number, y: number, vx: number, vy: number) {
    this.add({ x, y, vx: vx + between(-1.5, 1.5), vy: vy + between(-1, 1.5), life: between(0.2, 0.45), size: 0, grow: 0, color: "", gravity: -14, drag: 1.5, spark: true });
  }

  private shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number) {
    if (dt <= 0) return;
    for (const p of this.particles) {
      p.vy += p.gravity * dt;
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const pop of this.pops) pop.life -= dt;
    this.pops = this.pops.filter((pop) => pop.life > 0);
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
  }

  /** Screen offset in CSS pixels; translate the canvas by it before drawing the scene. */
  offset() {
    if (this.calm || this.trauma <= 0) return { x: 0, y: 0 };
    const power = this.trauma * this.trauma * 11;
    return { x: Math.sin(this.time * 53) * power, y: Math.cos(this.time * 41) * power };
  }

  draw(ctx: CanvasRenderingContext2D, view: FxProjection) {
    ctx.save();
    ctx.lineCap = "round";
    for (const p of this.particles) {
      const fade = p.life / p.max;
      const x = view.sx(p.x);
      const y = view.sy(p.y);
      if (p.spark) {
        ctx.globalAlpha = Math.min(1, fade * 1.5);
        ctx.strokeStyle = fade > 0.5 ? "#fff3a8" : "#ff8a3d";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - p.vx * 0.03 * view.s, y + p.vy * 0.03 * view.s);
        ctx.stroke();
      } else {
        ctx.globalAlpha = 0.6 * fade;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, p.size * view.s), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    for (const pop of this.pops) {
      const age = 1 - pop.life / POP_SECONDS;
      const size = 26 + 14 * Math.min(1, age * 5) - 6 * age;
      ctx.globalAlpha = Math.min(1, pop.life * 3);
      ctx.font = `900 ${size}px sans-serif`;
      const x = view.sx(pop.x);
      const y = view.sy(pop.y + age * 0.8);
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#1d2b2f";
      ctx.strokeText(pop.text, x, y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, x, y);
    }
    ctx.restore();
  }
}
