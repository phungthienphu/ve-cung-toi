import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { HillRaceSim } from '../shared/hillRaceSim';
import { DEFAULT_HILL_RACE, type HillRacer } from '../shared/hillRaceTypes';
import { hillHeight } from '../shared/hillTerrain';
import { Vec2 } from 'planck';
const players: HillRacer[] = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Driver ${i}`, vehicle: ['jeep', 'beetle', 'monster', 'bus'][i % 4] as HillRacer['vehicle'], connected: true, ready: true, points: 0 }));
const race = new HillRaceSim(42, DEFAULT_HILL_RACE, players);
const start = race.snapshot();
for (let i = 0; i < 179; i++) race.step();
assert.deepEqual(race.snapshot().cars.map(c => c.state.chassis), start.cars.map(c => c.state.chassis), 'countdown pins tower');
assert.ok(start.cars.every(c => c.state.energy === 35));
assert.equal(new Set(start.cars.map(c => c.state.chassis.x)).size, 2);
race.input('p0', { gas: true, brake: false, dash: true }, 2);
race.input('p0', { gas: false, brake: true }, 1);
assert.equal(race.entries.find(e => e.id === 'p0')!.input.gas, true, 'stale input rejected');
for (let i = 0; i < 300; i++) race.step();
assert.ok(race.snapshot().cars.some(c => Math.abs(c.state.chassis.x - start.cars.find(p => p.id === c.id)!.state.chassis.x) > 1));
race.neutral('p0'); assert.equal(race.entries.find(e => e.id === 'p0')!.input.gas, false);
race.reconnect('p0'); race.input('p0', { gas: true, brake: false }, 0); assert.equal(race.entries.find(e => e.id === 'p0')!.ack, 0, 'refresh resets input sequence');
const pair = () => new HillRaceSim(1, { ...DEFAULT_HILL_RACE, rounds: 1 }, players.slice(0, 2));
const stomp = pair();
for (let i = 0; i < 181; i++) stomp.step();
const [top, bottom] = stomp.entries;
bottom.sim.resetAt(10, 0); top.sim.resetAt(10, 4);
for (const b of [top.sim.chassis, ...top.sim.wheels]) b.setLinearVelocity(Vec2(0, -7));
for (let i = 0; i < 50; i++) stomp.step();
assert.ok(stomp.snapshot().cars.some(c => c.stomps > 0), 'falling onto another car triggers stomp');
assert.ok(stomp.snapshot().cars.every(c => c.state.overturnRemaining === null), 'roof touching other car does not count as roof-ground crash');
// A quick tap arriving entirely between physics ticks must not be lost.
const tap = pair(); for (let i = 0; i < 200; i++) tap.step();
const tapping = tap.entries[0]; tapping.sim.resetAt(25, 0); tapping.sim.addEnergy(100);
for (let i = 0; i < 20; i++) tap.step();
tap.input(tapping.id, { gas: false, brake: false, dash: true }, 1);
tap.input(tapping.id, { gas: false, brake: false, dash: false }, 2);
tap.step(); assert.ok(tapping.sim.snapshot().dashCooldown > 1.9, 'quick dash preserved between ticks');
// Squash blocks throttle, but does not take away a charged defensive dash.
tapping.stunUntil = tap.tick + 48; tapping.sim.addEnergy(100);
for (let i = 0; i < 121; i++) tap.step();
tapping.stunUntil = tap.tick + 48;
tap.input(tapping.id, { gas: true, brake: true, dash: true }, 3); tap.step();
assert.ok(tapping.sim.snapshot().dashCooldown > 1.9, 'victim can dash while squashed');
function shove(collisions: boolean) {
  const r = new HillRaceSim(9, { ...DEFAULT_HILL_RACE, collisions }, players.slice(0, 2));
  for (let i = 0; i < 181; i++) r.step();
  r.entries.forEach((e, i) => { e.sim.resetAt(10 + i * 5, 0); e.sim.addEnergy(100); });
  for (let i = 0; i < 20; i++) r.step();
  r.input(r.entries[0].id, { gas: true, brake: false, dash: true }, 1);
  for (let i = 0; i < 45; i++) r.step();
  return r.entries[1].sim.chassis.getPosition().x;
}
assert.ok(shove(true) > shove(false) + .5, 'dash physically pushes the other car; ghost mode passes through');
const crashRace = pair(); for (let i = 0; i < 181; i++) crashRace.step();
const crashed = crashRace.entries[0];
crashed.sim.chassis.setTransform(Vec2(25, 1.2), Math.PI);
crashed.sim.wheels.forEach((w, i) => w.setTransform(Vec2(25 + (i ? -1.25 : 1.25), 2.1), Math.PI));
for (let i = 0; i < 360; i++) crashRace.step();
assert.ok(crashed.crashes > 0, 'roof-ground timeout respawns rather than eliminates racer');
assert.equal(crashed.done, false);
const finish = pair(); for (let i = 0; i < 180; i++) finish.step();
finish.entries[0].sim.resetAt(1300, hillHeight(1, 1300)); finish.step();
assert.equal(finish.entries[0].finishTick, 1); assert.equal(finish.deadline, 1201);
for (let i = 0; i < 1200; i++) finish.step(); assert.equal(finish.ended, true); assert.equal(finish.order()[0], finish.entries[0].id);
const respawn = pair(); for (let i = 0; i < 181; i++) respawn.step();
const victim = respawn.entries[0]; victim.sim.resetAt(180, hillHeight(1,180)); victim.idle = 180; respawn.requestRespawn(victim.id);
assert.ok(victim.respawnAt > 0); for (let i = 0; i < 90; i++) respawn.step();
assert.ok(Math.abs(victim.sim.chassis.getPosition().x - 155) < 1); assert.ok(victim.ghostUntil > respawn.tick);
for (const map of ['tea', 'sand', 'mountain', 'moon'] as const) {
  assert.equal(hillHeight(42, 35, map), 0);
  const heights = Array.from({ length: 600 }, (_, i) => hillHeight(42, i + 40, map));
  const slopes = heights.slice(1).map((h, i) => Math.abs(h - heights[i]));
  assert.ok(Math.max(...heights) - Math.min(...heights) > 10, `${map} has significant relief`);
  assert.ok(slopes.filter(s => s > .4).length > 40, `${map} requires throttle timing`);
}
const spread = new HillRaceSim(42, DEFAULT_HILL_RACE, players);
for (let i = 0; i < 181; i++) spread.step();
spread.entries.forEach((e, i) => e.sim.resetAt(5 + i * 800, hillHeight(42, 5 + i * 800)));
spread.step(); assert.ok(spread.physics.world.getBodyCount() < 100, 'dispersed players stream only nearby terrain, not the space between them');
// Real process CPU, with warmed physics and all six vehicles kept active.
const benchmark = new HillRaceSim(42, DEFAULT_HILL_RACE, players);
for (let i = 0; i < 300; i++) benchmark.step();
for (const e of benchmark.entries) benchmark.input(e.id, { gas: true, brake: false }, 1);
const times: number[] = []; const cpu = process.cpuUsage(); const began = performance.now();
for (let i = 0; i < 3600; i++) {
  if (i % 300 === 0) for (const [slot, e] of benchmark.entries.entries()) {
    const x = 100 + Math.floor(i / 600) * 100 + slot * 5;
    e.sim.resetAt(x, hillHeight(42, x)); e.sim.setFuel(100); e.done = false; e.respawnAt = 0;
  }
  const before = performance.now(); benchmark.step(); times.push(performance.now() - before);
}
const used = process.cpuUsage(cpu); times.sort((a,b)=>a-b);
console.log(JSON.stringify({ test: 'six cars, 3600 steps', cpuMs: (used.user + used.system) / 1000, wallMs: performance.now() - began, p50StepMs: times[1800], p95StepMs: times[3420], p99StepMs: times[3564], bodies: benchmark.physics.world.getBodyCount(), activeCars: benchmark.entries.filter(e => !e.done).length }));
assert.equal(benchmark.ended, false, 'benchmark advances all 3600 steps');
assert.ok(benchmark.physics.world.getBodyCount() < 100, 'terrain bounded when players spread out');
console.log('Race passed: pinned tower, 35 energy, input order/reconnect, shared contacts, stomp, roof rules, finish deadline, checkpoint ghost, rough terrain.');
