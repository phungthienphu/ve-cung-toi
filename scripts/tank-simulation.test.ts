/** Run: node --import tsx scripts/tank-simulation.test.ts */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { TankEngine, type TankPeer } from '../shared/tank/engine';
import { TankBot, tankBotCanSee, tankBotWaypoint } from '../shared/tank/bot';
import { stepSelfMovement } from '../shared/tank/movement';
import { createSelfPredictor } from '../src/features/tank/components/predictSelf';
import { applyHit, damagePlayer } from '../shared/tank/combat';
import { TANK_COLORS, TICK_MS, TANK_SPEED, MAX_HP, type TankClientMessage, type TankMapDef, type TankServerMessage } from '../shared/tank/types';
const map: TankMapDef = { id: 'test', name: 'Test', terrain: 'sand', layout: ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '############'] };
const idle = { up: false, down: false, left: false, right: false, boost: false };
const flags = { isShielded: false, isStunned: false, dashUntil: null, dashAngle: 0 };
const base = { x: 100, y: 100, dir: 'right' as const, moving: false, velocityX: 0, velocityY: 0, isBoosting: false, boostEnergy: 100 };
const straight = stepSelfMovement(base, { ...idle, right: true }, flags, map, () => true);
const diagonal = stepSelfMovement(base, { ...idle, right: true, down: true }, flags, map, () => true);
assert.ok(Math.abs(Math.hypot(diagonal.x - base.x, diagonal.y - base.y) - TANK_SPEED) < 1e-10, 'diagonal has exactly straight-line speed');
assert.ok(diagonal.x > base.x && diagonal.y > base.y);
assert.ok(Math.abs((straight.x - base.x) / TICK_MS * 1000 - 2.4 / 65 * 1000) < 1e-9, '30Hz preserves previous speed per second');
let boosted = base;
for (let i = 0; i < 30; i++) boosted = { ...stepSelfMovement(boosted, { ...idle, right: true, boost: true }, flags, map, () => true), dir: 'right' };
assert.ok(Math.abs(boosted.boostEnergy - (100 - 1.6 / 65 * 1000)) < 1e-8, 'boost drain per second is unchanged');
let sequence = 0;
const predictor = createSelfPredictor(base);
const input = { ...idle, right: true };
// Reconcile more frequently than a movement step: prediction must keep making progress.
for (let i = 0; i < 20; i++) { predictor.advance(map, input, flags, 10, () => ++sequence); predictor.reconcile(base, 0); }
const predicted = predictor.advance(map, input, flags, 10, () => ++sequence);
assert.ok(sequence >= 6 && predicted.x > base.x + TANK_SPEED * 2, 'snapshots never starve the prediction clock');
const delayed = createSelfPredictor(base); let delayedSeq = 0;
for (let i = 0; i < 5; i++) delayed.advance(map, input, flags, TICK_MS, () => ++delayedSeq);
const authoritative = { ...base, x: base.x + TANK_SPEED * 2 };
delayed.reconcile(authoritative, 2);
const replayed = delayed.advance(map, input, flags, 1, () => ++delayedSeq);
assert.ok(replayed.x > authoritative.x + TANK_SPEED, 'unacknowledged steps are replayed');
delayed.reconcile({ ...base, x: 280 }, delayedSeq);
assert.ok(delayed.advance(map, idle, flags, 1, () => ++delayedSeq).x > 270, 'respawn-sized corrections snap instead of drifting');
const hiddenMap = { ...map, layout: [...map.layout] }; hiddenMap.layout[2] = '#.......B..#';
assert.equal(tankBotCanSee(hiddenMap, { x: 48, y: 80 }, { x: 272, y: 80 }), false, 'bot cannot see distant enemies inside bushes');
const wallMap = { ...map, layout: ['############', '#..#.......#', '#..#.......#', '#..#.......#', '#..........#', '#..........#', '#..........#', '############'] };
assert.equal(tankBotCanSee(wallMap, { x: 48, y: 80 }, { x: 240, y: 80 }), false, 'bot cannot aim through walls');
assert.ok(tankBotWaypoint(wallMap, { x: 80, y: 80 }, { x: 240, y: 80 }).y > 80, 'pathfinding routes around a wall');

let clock = 1_000_000;
const messages: TankServerMessage[] = [];
const engine = new TankEngine({ name: 'test-room', automatic: false, now: () => clock, emit: raw => messages.push(JSON.parse(raw)) });
const host: TankPeer = { id: 'human', send: raw => messages.push(JSON.parse(raw)), close() {} };
const guest: TankPeer = { id: 'guest', send() {}, close() {} };
const send = (message: TankClientMessage, peer = host) => engine.onMessage(peer, JSON.stringify(message));
const steps = (n: number) => { for (let i = 0; i < n; i++) { clock += TICK_MS; engine.step(); } };
send({ type: 'join', playerId: host.id, name: 'Human', color: TANK_COLORS[0] });
send({ type: 'join', playerId: 'forged', name: 'Forged', color: TANK_COLORS[0] }, guest);
assert.equal(engine.players.has('forged'), false, 'join identity comes from the connection');
send({ type: 'join', playerId: guest.id, name: 'Guest', color: TANK_COLORS[1] }, guest);
send({ type: 'set_bots', count: 5, difficulty: 'hard' }, guest);
assert.equal(engine.bots.size, 0, 'only the host configures bots');
send({ type: 'set_bots', count: 5, difficulty: 'hard' });
assert.equal(engine.bots.size, 5); assert.equal(engine.players.size, 7);
assert.ok([...engine.players.values()].filter(p => p.bot).every(p => !p.isHost));
send({ type: 'set_bots', count: 6, difficulty: 'hard' }); assert.equal(engine.bots.size, 5, 'bot cap is enforced');
send({ type: 'set_mode', mode: 'practice' }); send({ type: 'start_game', mapId: 'arena' });
assert.equal(engine.status, 'playing');
const me = engine.players.get(host.id)!; me.x = 80; me.y = 80;
send({ type: 'input', ...idle, right: true, down: true, aimAngle: Math.PI / 4, seq: 7 });
assert.equal(me.inputAck, 0, 'input is acknowledged only after simulation consumes it');
send({ type: 'input', ...idle, left: true, seq: 6 }); steps(1);
assert.equal(me.inputAck, 7); assert.equal(engine.inputs.get(host.id)!.right, true, 'stale input never replaces a newer command');
send({ type: 'shoot' }); assert.ok(engine.bullets.some(b => b.ownerId === host.id && Math.abs(b.angle - Math.PI / 4) < 1e-9), 'diagonal aim reaches authoritative bullets');
const beforeCount = messages.filter(m => m.type === 'state_delta').length; steps(60);
assert.equal(messages.filter(m => m.type === 'state_delta').length - beforeCount, 30, '30 simulation steps/sec produce 15 snapshots/sec');
const victim = engine.players.get(guest.id)!; victim.alive = true; victim.hp = MAX_HP; victim.auraShieldUntil = null;
applyHit(engine, victim, 'blind', host.id, 'Đạn thường');
assert.ok(victim.blindedUntil! > clock && victim.blindedUntil! < clock + 30_000, 'status effects use simulation clock');
damagePlayer(engine, victim, 200, host.id, 'Đạn thường'); assert.equal(victim.alive, false);
steps(50); assert.equal(victim.alive, true, 'offline engine respawns by its own clock');
const bot = [...engine.players.values()].find(p => p.bot)!;
bot.x = 80; bot.y = 80; me.x = 160; me.y = 80; bot.alive = me.alive = true; bot.hp = 100;
const brain = new TankBot('hard'); const view = { ...engine.publicState(), players: [...engine.players.values()] };
assert.ok(brain.decide(bot, view, map, clock).some(c => c.type === 'shoot'), 'bot attacks a visible opponent');
assert.ok(brain.decide(bot, view, map, clock + 1).every(c => c.type === 'input'), 'steering updates each tick while combat decisions stay bounded');

// Follow an actual multi-turn route at simulation cadence, rather than only
// checking the first waypoint. Coarse steering used to oscillate at corners.
for (const difficulty of ['easy', 'normal', 'hard'] as const) {
  const driver = { ...bot, x:80, y:80, hp:60, velocityX:0, velocityY:0 };
  const navigation = new TankBot(difficulty);
  const routeView = { ...view, players:[driver], bullets:[], crates:[], pickups:[{ id:'route-health', kind:'health' as const, x:144, y:144 }] };
  const cornerMap = { ...map, layout:['#######', '#..#..#', '#..#..#', '#..#..#', '#.....#', '#.....#', '#######'] };
  let closest = Infinity;
  for (let tick=0; tick<700; tick++) {
    const command = navigation.decide(driver, routeView, cornerMap, clock + tick*TICK_MS).find(c => c.type === 'input');
    if (command?.type === 'input') Object.assign(driver, stepSelfMovement(driver, command, flags, cornerMap, () => true));
    closest = Math.min(closest, Math.hypot(driver.x-144, driver.y-144));
  }
  assert.ok(closest < 12, `${difficulty} bot clears wall corners and reaches its pickup, closest=${closest}`);
}
assert.ok(tankBotWaypoint(map, {x:80,y:80}, {x:176,y:80}, [{x:112,y:80}]).y !== 80, 'route detours around a live crate');
engine.mode = 'ffa'; me.score = 4; victim.alive = true; victim.hp = 10;
damagePlayer(engine, victim, 20, host.id, 'Đạn thường'); steps(1);
assert.ok(messages.some(m => m.type === 'state' && m.state.status === 'ended'), 'kill-target victory publishes the ended phase');
engine.dispose();
console.log('Tank tests passed: diagonal speed, prediction/replay, authority/ack, bots/visibility/pathfinding, 30Hz/15Hz, offline clocks, respawn and victory.');

const perfMessages: string[] = [];
const load = new TankEngine({ name: 'benchmark', automatic: false, now: () => clock, emit: m => { if (perfMessages.length < 2) perfMessages.push(m); } });
load.onMessage(host, JSON.stringify({ type: 'join', playerId: host.id, name: 'Human', color: TANK_COLORS[0] }));
load.onMessage(host, JSON.stringify({ type: 'set_bots', count: 5, difficulty: 'hard' }));
load.onMessage(host, JSON.stringify({ type: 'set_mode', mode: 'practice' }));
load.onMessage(host, JSON.stringify({ type: 'start_game', mapId: 'arena' }));
const times: number[] = [];
for (let i = 0; i < 1800; i++) { clock += TICK_MS; const before = performance.now(); load.step(); times.push(performance.now() - before); }
times.sort((a, b) => a - b);
assert.ok([...load.players.values()].filter(p => p.bot).some(p => p.damageDealt > 0), 'bots actually fight during a simulated minute');
assert.ok([...load.players.values()].every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
console.log(JSON.stringify({ scenario: 'human + 5 hard bots, 60 simulated seconds', p50StepMs: times[900], p95StepMs: times[1710], p99StepMs: times[1782] }));
load.dispose();
