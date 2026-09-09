import type * as Party from "partykit/server";
import {
  BULLET_SIZE,
  DEFAULT_MAP_ID,
  FIRE_COOLDOWN_MS,
  FIRE_SHOTS_PER_ITEM,
  KILL_TARGET,
  MATCH_DURATION_MS,
  MAX_BOOST_ENERGY,
  MAX_TANK_PLAYERS,
  MAX_ULTIMATE_ENERGY,
  MIN_TANK_PLAYERS,
  MAX_HP,
  MONSTER_COUNT,
  SHIELD_MAX_HITS,
  TANK_SIZE,
  TICK_MS,
  getMap,
  getSpawnPoints,
  type Airstrike,
  type Bullet,
  type Crate,
  type ItemKind,
  type Monster,
  type Pickup,
  type TankClientMessage,
  type TankImpact,
  type TankKillEvent,
  type TankMapDef,
  type Team,
  type TankPlayer,
  type TankPublicState,
  type TankRoomMode,
  type TankRoomStatus,
  type TankServerMessage,
  type Trap,
} from "../shared/tankTypes";
import { randomAirstrikeDelay, stepAirstrikes } from "./tank/airstrike";
import { stepBullets } from "./tank/bullets-tick";
import { spawnCratesFromLayout } from "./tank/crates";
import { aimAngleOf, makeId, spawnPixel } from "./tank/geometry";
import { spawnMonster, stepMonsters } from "./tank/monsters-tick";
import { maybeSpawnPickup } from "./tank/pickups";
import { stepPlayers } from "./tank/players-tick";
import type { InputState } from "./tank/types";

export default class TankRoom implements Party.Server {
  players = new Map<string, TankPlayer>();
  inputs = new Map<string, InputState>();
  lastShotAt = new Map<string, number>();
  bullets: Bullet[] = [];
  pickups: Pickup[] = [];
  traps: Trap[] = [];
  crates: Crate[] = [];
  monsters: Monster[] = [];
  airstrikes: Airstrike[] = [];
  nextAirstrikeAt: number | null = null;
  matchStartAt: number | null = null;
  impacts: TankImpact[] = [];
  kills: TankKillEvent[] = [];
  lastPickupSpawnAt = 0;
  lastHazardDamageAt = new Map<string, number>();
  lastBurnDamageAt = new Map<string, number>();
  lastMonsterDirChangeAt = new Map<string, number>();
  lastMonsterContactAt = new Map<string, number>();
  monsterAggroUntil = new Map<string, number>();
  monsterRestUntil = new Map<string, number>();
  mapId: string = DEFAULT_MAP_ID;
  hostId: string | null = null;
  status: TankRoomStatus = "lobby";
  mode: TankRoomMode = "ffa";
  teamScores: Record<Team, number> = { A: 0, B: 0 };
  winnerId: string | null = null;
  winningTeam: Team | null = null;
  matchEndsAt: number | null = null;

  tickHandle: ReturnType<typeof setInterval> | null = null;
  disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  static readonly DISCONNECT_GRACE_MS = 8000;

  constructor(readonly party: Party.Party) {}

  private get map(): TankMapDef {
    return getMap(this.mapId);
  }

  onConnect(connection: Party.Connection) {
    connection.send(JSON.stringify(this.stateMessage()));
  }

  onClose(connection: Party.Connection) {
    const player = this.players.get(connection.id);
    if (!player) return;
    player.connected = false;
    this.broadcastState();

    const existing = this.disconnectTimers.get(player.id);
    if (existing) clearTimeout(existing);
    this.disconnectTimers.set(
      player.id,
      setTimeout(() => this.finalizeDisconnect(player.id), TankRoom.DISCONNECT_GRACE_MS)
    );
  }

  private finalizeDisconnect(playerId: string) {
    this.disconnectTimers.delete(playerId);
    const player = this.players.get(playerId);
    if (!player || player.connected) return;

    if (this.hostId === playerId) {
      player.isHost = false;
      const next = [...this.players.values()].find((p) => p.connected && p.id !== playerId);
      this.hostId = next ? next.id : null;
      if (next) next.isHost = true;
    }
    this.broadcastState();
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: TankClientMessage;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    switch (msg.type) {
      case "join":
        return this.handleJoin(msg.playerId, msg.name, msg.color, sender);
      case "choose_team":
        return this.handleChooseTeam(msg.team, sender);
      case "set_mode":
        return this.handleSetMode(msg.mode, sender);
      case "start_game":
        return this.handleStartGame(msg.mapId, sender);
      case "play_again":
        return this.handlePlayAgain(sender);
      case "end_game":
        return this.handleEndGame(sender);
      case "input":
        return this.handleInput(msg, sender);
      case "shoot":
        return this.handleShoot(sender, !!msg.big);
      case "use_item":
        return this.handleUseItem(msg.kind, sender);
      case "leave_room":
        return this.handleLeaveRoom(sender);
    }
  }

  private leastFilledTeam(): Team {
    let a = 0;
    let b = 0;
    for (const p of this.players.values()) {
      if (p.team === "A") a += 1;
      else b += 1;
    }
    return a <= b ? "A" : "B";
  }

  private handleChooseTeam(team: Team, sender: Party.Connection) {
    if (this.status !== "lobby") return;
    const player = this.players.get(sender.id);
    if (!player) return;
    player.team = team;
    this.broadcastState();
  }

  private handleSetMode(mode: TankRoomMode, sender: Party.Connection) {
    if (this.status !== "lobby" || sender.id !== this.hostId) return;
    this.mode = mode;
    this.broadcastState();
  }

  private handleJoin(playerId: string, name: string, color: string, sender: Party.Connection) {
    const cleanName = name.trim().slice(0, 20) || "Người chơi";
    let player = this.players.get(playerId);

    if (!player) {
      if (this.players.size >= MAX_TANK_PLAYERS) {
        sender.send(
          JSON.stringify({ type: "error", message: `Phòng đã đầy (tối đa ${MAX_TANK_PLAYERS} người).` } satisfies TankServerMessage)
        );
        return;
      }
      const spawn = spawnPixel(getSpawnPoints(this.map)[this.players.size % 8]);
      player = {
        id: playerId,
        name: cleanName,
        color,
        team: this.leastFilledTeam(),
        x: spawn.x,
        y: spawn.y,
        dir: "down",
        moving: false,
        alive: true,
        hp: MAX_HP,
        score: 0,
        connected: true,
        isHost: this.players.size === 0,
        respawnAt: null,
        items: [],
        blindedUntil: null,
        boostEnergy: MAX_BOOST_ENERGY,
        isBoosting: false,
        ultimateEnergy: 0,
        shieldHitsLeft: 0,
        fireShotsLeft: 0,
        burningUntil: null,
        burnOwnerId: null,
        aimAngle: null,
      };
      this.players.set(playerId, player);
      if (player.isHost) this.hostId = playerId;
    } else {
      const pending = this.disconnectTimers.get(playerId);
      if (pending) {
        clearTimeout(pending);
        this.disconnectTimers.delete(playerId);
      }
      player.connected = true;
      player.name = cleanName;
      player.color = color;
    }

    if (!this.hostId || !this.players.get(this.hostId)?.connected) {
      this.hostId = playerId;
      player.isHost = true;
    }

    sender.send(JSON.stringify(this.stateMessage()));
    this.broadcastState();
  }

  private handleStartGame(mapId: string, sender: Party.Connection) {
    if (sender.id !== this.hostId) return;
    if (this.status === "playing") return;
    const connected = [...this.players.values()].filter((p) => p.connected);
    if (this.mode !== "practice" && connected.length < MIN_TANK_PLAYERS) {
      sender.send(
        JSON.stringify({ type: "error", message: `Cần ít nhất ${MIN_TANK_PLAYERS} người chơi để bắt đầu.` } satisfies TankServerMessage)
      );
      return;
    }

    this.mapId = getMap(mapId).id;
    const spawns = getSpawnPoints(this.map);
    // In team mode, spawns 0-3 cluster near one corner and 4-7 near the
    // opposite corner — walk each team's own counter through its 4 reserved
    // slots so teammates land together on opposite sides of the map. FFA
    // just cycles through all 8 in join order like before teams existed.
    const teamIndex: Record<Team, number> = { A: 0, B: 0 };
    connected.forEach((p, i) => {
      let spawn;
      if (this.mode === "team") {
        const base = p.team === "A" ? 0 : 4;
        spawn = spawnPixel(spawns[base + (teamIndex[p.team] % 4)]);
        teamIndex[p.team] += 1;
      } else {
        spawn = spawnPixel(spawns[i % spawns.length]);
      }
      p.x = spawn.x;
      p.y = spawn.y;
      p.alive = true;
      p.hp = MAX_HP;
      p.score = 0;
      p.respawnAt = null;
      p.dir = "down";
      p.items = [];
      p.blindedUntil = null;
      p.boostEnergy = MAX_BOOST_ENERGY;
      p.isBoosting = false;
      p.ultimateEnergy = 0;
      p.shieldHitsLeft = 0;
      p.fireShotsLeft = 0;
      p.burningUntil = null;
      p.burnOwnerId = null;
    });
    this.bullets = [];
    this.pickups = [];
    this.traps = [];
    this.crates = spawnCratesFromLayout(this.map);
    this.impacts = [];
    this.kills = [];
    this.lastPickupSpawnAt = Date.now();
    this.lastMonsterDirChangeAt.clear();
    this.lastMonsterContactAt.clear();
    this.lastBurnDamageAt.clear();
    this.monsterAggroUntil.clear();
    this.monsterRestUntil.clear();
    this.monsters = Array.from({ length: MONSTER_COUNT }, () => spawnMonster(this.map));
    this.teamScores = { A: 0, B: 0 };
    this.winnerId = null;
    this.winningTeam = null;
    // Practice rooms are free play with no opponents required — no timer,
    // no win condition, just respawn-and-keep-going until the host stops it.
    this.matchEndsAt = this.mode === "practice" ? null : Date.now() + MATCH_DURATION_MS;
    // Airstrikes only make sense visually on grass terrain (arena/maze) —
    // the desert map is reserved for a future train hazard instead.
    this.airstrikes = [];
    this.matchStartAt = Date.now();
    this.nextAirstrikeAt = this.map.terrain === "grass" ? Date.now() + randomAirstrikeDelay() : null;
    this.status = "playing";
    this.ensureTicking();
    this.broadcastState();
  }

  private handleEndGame(sender: Party.Connection) {
    if (sender.id !== this.hostId) return;
    if (this.status !== "playing" || this.mode !== "practice") return;
    this.status = "lobby";
    this.bullets = [];
    this.pickups = [];
    this.traps = [];
    this.crates = [];
    this.monsters = [];
    this.airstrikes = [];
    this.nextAirstrikeAt = null;
    this.matchStartAt = null;
    this.impacts = [];
    this.kills = [];
    this.winnerId = null;
    this.winningTeam = null;
    this.matchEndsAt = null;
    this.broadcastState();
  }

  private handlePlayAgain(sender: Party.Connection) {
    if (sender.id !== this.hostId) return;
    if (this.status !== "ended") return;
    this.status = "lobby";
    this.bullets = [];
    this.pickups = [];
    this.traps = [];
    this.crates = [];
    this.monsters = [];
    this.airstrikes = [];
    this.nextAirstrikeAt = null;
    this.matchStartAt = null;
    this.impacts = [];
    this.kills = [];
    this.winnerId = null;
    this.winningTeam = null;
    this.matchEndsAt = null;
    this.broadcastState();
  }

  private handleInput(
    msg: { up: boolean; down: boolean; left: boolean; right: boolean; boost: boolean; aimAngle?: number },
    sender: Party.Connection
  ) {
    const player = this.players.get(sender.id);
    if (!player) return;
    this.inputs.set(sender.id, { up: msg.up, down: msg.down, left: msg.left, right: msg.right, boost: msg.boost });
    player.aimAngle = typeof msg.aimAngle === "number" ? msg.aimAngle : null;
  }

  private handleShoot(sender: Party.Connection, big: boolean) {
    const player = this.players.get(sender.id);
    if (!player || !player.alive || this.status !== "playing") return;
    if (big && player.ultimateEnergy < MAX_ULTIMATE_ENERGY) return;

    const now = Date.now();
    const last = this.lastShotAt.get(sender.id) ?? 0;
    if (now - last < FIRE_COOLDOWN_MS) return;
    this.lastShotAt.set(sender.id, now);

    const isFire = !big && player.fireShotsLeft > 0;
    if (big) {
      player.ultimateEnergy = 0;
    } else if (isFire) {
      player.fireShotsLeft -= 1;
    }

    const angle = aimAngleOf(player);
    const offset = TANK_SIZE / 2 + BULLET_SIZE;
    this.bullets.push({
      id: makeId(),
      ownerId: player.id,
      x: player.x + Math.cos(angle) * offset,
      y: player.y + Math.sin(angle) * offset,
      angle,
      kind: big ? "big" : isFire ? "fire" : "normal",
    });
  }

  private handleUseItem(kind: ItemKind, sender: Party.Connection) {
    const player = this.players.get(sender.id);
    if (!player || !player.alive || this.status !== "playing") return;
    const slot = player.items.indexOf(kind);
    if (slot === -1) return;

    if (kind === "trap") {
      this.traps.push({ id: makeId(), ownerId: player.id, x: player.x, y: player.y });
    } else if (kind === "blind") {
      const angle = aimAngleOf(player);
      const offset = TANK_SIZE / 2 + BULLET_SIZE;
      this.bullets.push({
        id: makeId(),
        ownerId: player.id,
        x: player.x + Math.cos(angle) * offset,
        y: player.y + Math.sin(angle) * offset,
        angle,
        kind: "blind",
      });
    } else if (kind === "shield") {
      player.shieldHitsLeft = SHIELD_MAX_HITS;
    } else if (kind === "fire") {
      player.fireShotsLeft = FIRE_SHOTS_PER_ITEM;
    }
    player.items.splice(slot, 1);
  }

  private handleLeaveRoom(sender: Party.Connection) {
    const player = this.players.get(sender.id);
    if (!player) return;
    this.players.delete(sender.id);
    this.inputs.delete(sender.id);
    this.lastShotAt.delete(sender.id);

    if (this.hostId === sender.id) {
      const next = [...this.players.values()].find((p) => p.connected);
      this.hostId = next ? next.id : null;
      if (next) next.isHost = true;
    }
    this.broadcastState();
    sender.close();
  }

  // ---------- simulation ----------

  private ensureTicking() {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTicking() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private tick() {
    if (this.status !== "playing") {
      this.stopTicking();
      return;
    }

    const now = Date.now();
    const map = this.map;
    this.impacts = [];
    this.kills = [];

    if (this.matchEndsAt !== null && now >= this.matchEndsAt) {
      this.status = "ended";
      if (this.mode === "team") {
        this.winningTeam = this.teamScores.A === this.teamScores.B ? null : this.teamScores.A > this.teamScores.B ? "A" : "B";
      } else {
        const ranked = [...this.players.values()].sort((a, b) => b.score - a.score);
        const top = ranked[0];
        this.winnerId = top && (!ranked[1] || ranked[1].score < top.score) ? top.id : null;
      }
      this.broadcastState();
      this.stopTicking();
      return;
    }

    stepPlayers(this, map, now);
    stepMonsters(this, map, now);

    this.lastPickupSpawnAt = maybeSpawnPickup(this, map, now);

    if (map.terrain === "grass") {
      stepAirstrikes(this, map, now);
    }

    stepBullets(this, map, now);

    this.broadcastState();
    if (this.status !== "playing") this.stopTicking();
  }

  // ---------- state ----------

  private stateMessage(): TankServerMessage {
    return { type: "state", state: this.publicState() };
  }

  private publicState(): TankPublicState {
    return {
      roomId: this.party.id,
      status: this.status,
      mode: this.mode,
      hostId: this.hostId,
      players: [...this.players.values()],
      bullets: this.bullets,
      pickups: this.pickups,
      traps: this.traps,
      crates: this.crates,
      monsters: this.monsters,
      airstrikes: this.airstrikes,
      impacts: this.impacts,
      kills: this.kills,
      mapId: this.mapId,
      killTarget: KILL_TARGET,
      teamScores: this.teamScores,
      winnerId: this.winnerId,
      winningTeam: this.winningTeam,
      matchEndsAt: this.matchEndsAt,
      serverNow: Date.now(),
    };
  }

  private broadcastState() {
    this.party.broadcast(JSON.stringify(this.stateMessage()));
  }
}
