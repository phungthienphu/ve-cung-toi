import { unpackHillFrame } from "../shared/hillRaceWire";
import assert from 'node:assert/strict';
import type { HillRaceState, HillRaceFrame } from '../shared/hillRaceTypes';
const host = process.env.HILL_PARTY_URL || 'http://127.0.0.1:1999';
const room = `TEST${Date.now()}`;
const sockets: WebSocket[] = [];
let state: HillRaceState | null = null; let frame: HillRaceFrame | null = null;
let frames = 0, bytes = 0;
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(test: () => boolean, label: string, attempts = 200) { for (let i = 0; i < attempts; i++) { if (test()) return; await pause(50); } throw new Error(`Timeout: ${label}`); }
async function connect(i: number) {
  const ws = new WebSocket(`${host.replace('http','ws')}/parties/hill/${room}?_pk=driver${i}`); sockets[i] = ws;
  ws.addEventListener('message', event => { const raw = String(event.data); const m = JSON.parse(raw); if (i !== 0) return; if (m.type === 'state') { state = m.state; frame = m.state.frame ? unpackHillFrame(m.state.frame) : null; } if (m.type === 'frame') { frame = unpackHillFrame(m.frame); frames++; bytes += Buffer.byteLength(raw); } });
  await new Promise<void>((resolve, reject) => { ws.addEventListener('open', () => resolve(), { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.send(JSON.stringify({ type: 'join', name: `Test ${i}` })); return ws;
}
async function main() {
try {
  for (let i = 0; i < 6; i++) await connect(i);
  await until(() => state?.players.length === 6, 'six players');
  const directory = await fetch(`${host}/parties/hilllobby/main`).then(r => r.json()) as {roomId:string}[];
  assert.ok(directory.some(r => r.roomId === room.toLowerCase() || r.roomId === room));
  // Non-host configuration changes must be ignored.
  sockets[1].send(JSON.stringify({ type: 'config', config: { map: 'moon', length: 600, mode: 'race', collisions: false, rounds: 1, vehicle: 'bus' } }));
  sockets[0].send(JSON.stringify({ type: 'config', config: { map: 'tea', length: 600, mode: 'distance', collisions: true, rounds: 3, vehicle: 'choice' } }));
  await until(() => state?.config.mode === 'distance', 'host config');
  for (let i = 0; i < 6; i++) sockets[i].send(JSON.stringify({ type: 'ready', vehicle: 'jeep', ready: true }));
  await until(() => !!state?.players.every(p => p.ready), 'ready');
  assert.equal(state!.config.map, 'tea');
  sockets[0].send(JSON.stringify({ type: 'start' }));
  await until(() => state?.phase === 'race', 'race');
  assert.equal(frame!.cars.length, 6);
  const pinned = frame!.cars.map(c => c.state.chassis);
  await pause(1000); assert.deepEqual(frame!.cars.map(c => c.state.chassis), pinned);
  for (let i = 0; i < 6; i++) sockets[i].send(JSON.stringify({ type: 'input', seq: 10, input: { gas: true, brake: false, dash: i === 0 } }));
  await until(() => !!frame && frame.tick > 180, 'release and physics');
  assert.ok(frame!.cars.some(c => c.state.distance > 5));
  const count = frames; await pause(1000); assert.ok(frames - count >= 10 && frames - count <= 19, `snapshot rate ${frames - count}`);
  sockets[4].close(); await pause(150); await connect(4);
  sockets[4].send(JSON.stringify({ type: 'input', seq: 0, input: { gas: false, brake: false } }));
  await until(() => frame?.cars.find(c => c.id === 'driver4')?.ack === 0, 'reconnect with reset sequence');
  sockets[0].send('{invalid JSON'); sockets[0].send(JSON.stringify({type:'input',seq:11,input:null}));
  await until(() => state?.phase === 'results', 'distance race results', 2400);
  assert.equal(state!.players.reduce((sum, p) => sum + p.points, 0), 28);
  assert.equal(state!.order.length, 6); assert.equal(state!.seriesOver, false);
  sockets[0].send(JSON.stringify({ type: 'next' }));
  await until(() => state?.round === 2 && state.phase === 'race', 'next round');
  console.log(JSON.stringify({ room, players: state!.players.length, tick: frame!.tick, snapshots: frames, averageSnapshotBytes: Math.round(bytes / frames) }));
  console.log('Hill WebSocket integration passed: 6 joins, directory, host authorization, ready, pinned countdown, authoritative movement, ~15Hz, reconnect and invalid messages.');
} finally { sockets.forEach(s => s?.close()); }

}
main().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
