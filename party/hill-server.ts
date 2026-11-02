import { packHillFrame } from "../shared/hillRaceWire";
import { Server, getServerByName, type Connection } from 'partyserver';
import type { Env } from './env';
import { HillRaceSim } from '../shared/hillRaceSim';
import { DEFAULT_HILL_RACE, type HillRaceState, type HillRaceMessage } from '../shared/hillRaceTypes';
import { isHillMap, isHillVehicle } from '../shared/hillTypes';
export class HillRoom extends Server<Env> {
  state: HillRaceState = { host: '', players: [], config: { ...DEFAULT_HILL_RACE }, phase: 'lobby', round: 0, frame: null, order: [], seriesOver: false };
  private race: HillRaceSim | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private batch = 0;
  private rates = new Map<string, { at: number; count: number }>();
  onConnect(c: Connection) { c.send(JSON.stringify({ type: 'state', state: this.wireState() })); }
  onClose(c: Connection) {
    const p = this.state.players.find(p => p.id === c.id);
    if (p) { p.connected = false; p.ready = false; this.race?.neutral(p.id); }
    this.rates.delete(c.id);
    if (!this.state.players.some(p => p.connected)) { this.stop(); this.race = null; this.state = { ...this.state, players: [], host: '', phase: 'lobby', frame: null, round: 0 }; }
    else if (this.state.host === c.id) this.state.host = this.state.players.find(p => p.connected)!.id;
    this.publish();
  }
  onMessage(c: Connection, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > 2048) return;
    const now = Date.now(), rate = this.rates.get(c.id);
    if (!rate || now - rate.at > 1000) this.rates.set(c.id, { at: now, count: 1 });
    else if (++rate.count > 90) return;
    let m: HillRaceMessage;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    let p = this.state.players.find(p => p.id === c.id);
    if (m.type === 'join') {
      if (typeof m.name !== 'string' || !m.name.trim()) return;
      if (!p) {
        if (this.state.phase !== 'lobby' || this.state.players.filter(p => p.connected).length >= 6) { c.send(JSON.stringify({ type: 'error', message: 'Phòng đang đua hoặc đã đủ 6 người.' })); return; }
        this.state.players = this.state.players.filter(p => p.connected);
        p = { id: c.id, name: m.name.trim().slice(0, 24), ready: false, connected: true, vehicle: 'jeep', points: 0 }; this.state.players.push(p);
      }
      this.race?.reconnect(c.id);
      p.connected = true; p.name = m.name.trim().slice(0, 24);
      if (!this.state.host) this.state.host = c.id;
    } else if (!p || !p.connected) return;
    else if (m.type === 'ready' && this.state.phase === 'lobby' && isHillVehicle(m.vehicle) && typeof m.ready === 'boolean') { p.vehicle = m.vehicle; p.ready = m.ready; }
    else if (m.type === 'config' && c.id === this.state.host && this.state.phase === 'lobby') {
      const v = m.config;
      if (!v || (v.map !== "random" && !isHillMap(v.map)) || ![600, 1200, 2000].includes(v.length) || !['race', 'distance'].includes(v.mode) || ![1, 3, 5].includes(v.rounds) || typeof v.collisions !== 'boolean' || (v.vehicle !== 'choice' && !isHillVehicle(v.vehicle))) return;
      this.state.config = { map: v.map, length: v.length, mode: v.mode, rounds: v.rounds, collisions: v.collisions, vehicle: v.vehicle };
      this.state.players.forEach(p => p.ready = false);
    } else if (m.type === 'input' && this.state.phase === 'race') {
      if (!Number.isSafeInteger(m.seq) || m.seq < 0 || !m.input || typeof m.input.gas !== 'boolean' || typeof m.input.brake !== 'boolean') return;
      this.race?.input(c.id, { gas: m.input.gas, brake: m.input.brake, jump: m.input.jump === true, dash: m.input.dash === true }, m.seq); return;
    } else if (m.type === 'respawn' && this.state.phase === 'race') { this.race?.requestRespawn(c.id); return; }
    else if (m.type === 'start' && c.id === this.state.host && this.state.phase === 'lobby') {
      const players = this.state.players.filter(p => p.connected);
      if (players.length < 2 || !players.every(p => p.ready)) return;
      this.state.players = players; this.state.players.forEach(p => p.points = 0); this.state.round = 0; this.start(); return;
    } else if (m.type === 'next' && c.id === this.state.host && this.state.phase === 'results' && !this.state.seriesOver) { this.start(); return; }
    else if (m.type === 'lobby' && c.id === this.state.host && this.state.phase === 'results') {
      this.state.phase = 'lobby'; this.state.players = this.state.players.filter(p => p.connected); this.state.players.forEach(p => p.ready = false); this.state.frame = null; this.race = null;
    } else return;
    this.publish();
  }
  private start() {
    this.stop(); this.state.round++; this.state.phase = 'race'; this.state.seriesOver = false; this.state.order = [];
    this.race = new HillRaceSim(Date.now() >>> 0, this.state.config, this.state.players);
    this.state.frame = this.race.snapshot(); this.publish();
    this.timer = setInterval(() => {
      if (!this.race) return;
      // Three fixed 1/60s steps per 50ms wakeup; 3 of 4 batches => 15Hz snapshots.
      for (let i = 0; i < 3; i++) this.race.step();
      if (this.race.ended) {
        this.stop(); this.state.frame = this.race.snapshot(); this.state.order = this.race.order();
        this.state.order.forEach((id, i) => { const p = this.state.players.find(p => p.id === id); if (p) p.points += [10, 7, 5, 3, 2, 1][i]; });
        this.state.phase = 'results'; this.state.seriesOver = this.state.round >= this.state.config.rounds; this.publish();
      } else if (++this.batch % 4 !== 0) { this.state.frame = this.race.snapshot(); this.broadcast(JSON.stringify({ type: 'frame', frame: packHillFrame(this.state.frame) })); }
    }, 50);
  }
  private stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  private wireState() { return { ...this.state, frame: this.state.frame ? packHillFrame(this.state.frame) : null }; }
  private publish() {
    this.broadcast(JSON.stringify({ type: 'state', state: this.wireState() }));
    getServerByName(this.env.Hilllobby, 'main').then(server => server.fetch(new Request('https://hill/rooms', { method: 'POST', body: JSON.stringify({ roomId: this.name, hostName: this.state.players.find(p => p.id === this.state.host)?.name ?? '', playerCount: this.state.players.filter(p => p.connected).length, maxPlayers: 6, status: this.state.phase, hidden: this.state.phase !== 'lobby' || !this.state.players.length }) }))).catch(() => {});
  }
}
