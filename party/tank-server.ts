import type * as Party from "partykit/server";
import {
  BLIND_DURATION_MS,
  BOOST_DRAIN_PER_TICK,
  BOOST_REGEN_PER_TICK,
  BOOST_SPEED_MULTIPLIER,
  BULLET_DAMAGE,
  BULLET_SIZE,
  BULLET_SPEED,
  BURN_DAMAGE_PER_TICK,
  BURN_DURATION_MS,
  BURN_TICK_INTERVAL_MS,
  DEFAULT_MAP_ID,
  FIRE_SHOTS_PER_ITEM,
  FIRE_COOLDOWN_MS,
  HAZARD_DAMAGE,
  HAZARD_DAMAGE_INTERVAL_MS,
  KILL_TARGET,
  MAX_BOOST_ENERGY,
  MAX_HELD_ITEMS,
  MAX_HP,
  MAX_PICKUPS,
  MAX_TANK_PLAYERS,
  MAX_ULTIMATE_ENERGY,
  MIN_TANK_PLAYERS,
  MONSTER_AGGRO_TIMEOUT_MS,
  MONSTER_CHASE_LEASH_RADIUS,
  MONSTER_CHASE_SPEED_MULTIPLIER,
  MONSTER_COUNT,
  MONSTER_CONTACT_COOLDOWN_MS,
  MONSTER_DAMAGE,
  MONSTER_DIR_CHANGE_MS,
  MONSTER_HP,
  MONSTER_NEST_RADIUS,
  MONSTER_REST_CHANCE,
  MONSTER_REST_DURATION_MS,
  MONSTER_RESPAWN_DELAY_MS,
  MONSTER_SIZE,
  MONSTER_SPEED,
  NEST_PUDDLE_RADIUS,
  PICKUP_HEAL_AMOUNT,
  PICKUP_SIZE,
  PICKUP_SPAWN_INTERVAL_MS,
  PICKUP_WEIGHTS,
  RESPAWN_DELAY_MS,
  TANK_SIZE,
  TANK_SPEED,
  TICK_MS,
  TILE_SIZE,
  SHIELD_MAX_HITS,
  TRAP_DAMAGE,
  TRAP_SIZE,
  ULTIMATE_DAMAGE_MULTIPLIER,
  ULTIMATE_REGEN_PER_TICK,
  getMap,
  getSpawnPoints,
  mapCols,
  mapRows,
  type Bullet,
  type Direction,
  type ItemKind,
  type Monster,
  type Pickup,
  type TankClientMessage,
  type TankImpact,
  type TankKillEvent,
  type TankMapDef,
  type TankPlayer,
  type TankPublicState,
  type TankRoomStatus,
  type TankServerMessage,
  type Trap,
} from "../shared/tankTypes";

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function tileAt(map: TankMapDef, px: number, py: number): string {
  const col = Math.floor(px / TILE_SIZE);
  const row = Math.floor(py / TILE_SIZE);
  if (row < 0 || row >= mapRows(map) || col < 0 || col >= mapCols(map)) return "#";
  return map.layout[row][col] ?? "#";
}

function spawnPixel(tile: { x: number; y: number }) {
  return { x: tile.x * TILE_SIZE + TILE_SIZE / 2, y: tile.y * TILE_SIZE + TILE_SIZE / 2 };
}

function tankBlocked(map: TankMapDef, x: number, y: number): boolean {
  const half = TANK_SIZE / 2;
  return (
    tileAt(map, x - half, y - half) === "#" ||
    tileAt(map, x + half, y - half) === "#" ||
    tileAt(map, x - half, y + half) === "#" ||
    tileAt(map, x + half, y + half) === "#"
  );
}

function findOverlappingTank(
  players: IterableIterator<TankPlayer>,
  excludeIds: ReadonlySet<string>,
  x: number,
  y: number
): TankPlayer | null {
  for (const other of players) {
    if (excludeIds.has(other.id) || !other.alive) continue;
    if (Math.hypot(x - other.x, y - other.y) < TANK_SIZE) return other;
  }
  return null;
}

/**
 * Attempts to shove `other` by (dx, dy). Fails if that would put it inside a
 * wall or a third tank. Ramming a tank into a hazard/trap tile is the whole
 * point — hazard tiles are walkable, so the push itself is never blocked by
 * them, only by walls and other tanks.
 */
function tryPushTank(
  other: TankPlayer,
  dx: number,
  dy: number,
  map: TankMapDef,
  players: Map<string, TankPlayer>,
  pusherId: string
): boolean {
  if (other.shieldHitsLeft > 0) return false; // a standing shield holds its ground like a wall
  const nx = other.x + dx;
  const ny = other.y + dy;
  if (tankBlocked(map, nx, ny)) return false;
  if (findOverlappingTank(players.values(), new Set([other.id, pusherId]), nx, ny)) return false;
  other.x = nx;
  other.y = ny;
  return true;
}

/** Higher current speed wins a head-on shove; ties break on leftover boost energy. */
function winsShovingContest(mover: TankPlayer, moverBoosting: boolean, blocker: TankPlayer): boolean {
  if (moverBoosting !== blocker.isBoosting) return moverBoosting;
  return mover.boostEnergy >= blocker.boostEnergy;
}

function randomPickupKind(): ItemKind {
  const r = Math.random();
  let acc = 0;
  for (const [kind, weight] of Object.entries(PICKUP_WEIGHTS) as [ItemKind, number][]) {
    acc += weight;
    if (r <= acc) return kind;
  }
  return "health";
}

const DIR_VECTOR: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
}

export default class TankRoom implements Party.Server {
  players = new Map<string, TankPlayer>();
  inputs = new Map<string, InputState>();
  lastShotAt = new Map<string, number>();
  bullets: Bullet[] = [];
  pickups: Pickup[] = [];
  traps: Trap[] = [];
  monsters: Monster[] = [];
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
  winnerId: string | null = null;

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
      case "start_game":
        return this.handleStartGame(msg.mapId, sender);
      case "play_again":
        return this.handlePlayAgain(sender);
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

  private handleJoin(playerId: string, name: string, color: string, sender: Party.Connection) {
    const cleanName = name.trim().slice(0, 20) || "Người chơi";
    let player = this.players.get(playerId);

    if (!player) {
      if (this.players.size >= MAX_TANK_PLAYERS) {
        sender.send(JSON.stringify({ type: "error", message: "Phòng đã đầy (tối đa 4 người)." } satisfies TankServerMessage));
        return;
      }
      const spawn = spawnPixel(getSpawnPoints(this.map)[this.players.size % 4]);
      player = {
        id: playerId,
        name: cleanName,
        color,
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
    if (connected.length < MIN_TANK_PLAYERS) {
      sender.send(
        JSON.stringify({ type: "error", message: `Cần ít nhất ${MIN_TANK_PLAYERS} người chơi để bắt đầu.` } satisfies TankServerMessage)
      );
      return;
    }

    this.mapId = getMap(mapId).id;
    const spawns = getSpawnPoints(this.map);
    connected.forEach((p, i) => {
      const spawn = spawnPixel(spawns[i % spawns.length]);
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
    this.impacts = [];
    this.kills = [];
    this.lastPickupSpawnAt = Date.now();
    this.lastMonsterDirChangeAt.clear();
    this.lastMonsterContactAt.clear();
    this.lastBurnDamageAt.clear();
    this.monsterAggroUntil.clear();
    this.monsterRestUntil.clear();
    this.monsters = Array.from({ length: MONSTER_COUNT }, () => this.spawnMonster());
    this.winnerId = null;
    this.status = "playing";
    this.ensureTicking();
    this.broadcastState();
  }

  private spawnMonster(): Monster {
    const tile = this.randomOpenTile();
    const pos = spawnPixel(tile ?? { x: 1, y: 1 });
    const dirs: Direction[] = ["up", "down", "left", "right"];
    return {
      id: makeId(),
      x: pos.x,
      y: pos.y,
      dir: dirs[Math.floor(Math.random() * dirs.length)],
      alive: true,
      hp: MONSTER_HP,
      respawnAt: null,
      nestX: pos.x,
      nestY: pos.y,
      aggroPlayerId: null,
    };
  }

  private handlePlayAgain(sender: Party.Connection) {
    if (sender.id !== this.hostId) return;
    if (this.status !== "ended") return;
    this.status = "lobby";
    this.bullets = [];
    this.pickups = [];
    this.traps = [];
    this.monsters = [];
    this.impacts = [];
    this.kills = [];
    this.winnerId = null;
    this.broadcastState();
  }

  private handleInput(
    msg: { up: boolean; down: boolean; left: boolean; right: boolean; boost: boolean },
    sender: Party.Connection
  ) {
    if (!this.players.has(sender.id)) return;
    this.inputs.set(sender.id, { up: msg.up, down: msg.down, left: msg.left, right: msg.right, boost: msg.boost });
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

    const v = DIR_VECTOR[player.dir];
    const offset = TANK_SIZE / 2 + BULLET_SIZE;
    this.bullets.push({
      id: makeId(),
      ownerId: player.id,
      x: player.x + v.dx * offset,
      y: player.y + v.dy * offset,
      dir: player.dir,
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
      const v = DIR_VECTOR[player.dir];
      const offset = TANK_SIZE / 2 + BULLET_SIZE;
      this.bullets.push({
        id: makeId(),
        ownerId: player.id,
        x: player.x + v.dx * offset,
        y: player.y + v.dy * offset,
        dir: player.dir,
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

  private randomOpenTile(): { x: number; y: number } | null {
    const map = this.map;
    const cols = mapCols(map);
    const rows = mapRows(map);
    for (let attempt = 0; attempt < 30; attempt++) {
      const col = 1 + Math.floor(Math.random() * (cols - 2));
      const row = 1 + Math.floor(Math.random() * (rows - 2));
      if (map.layout[row]?.[col] === ".") return { x: col, y: row };
    }
    return null;
  }

  private maybeSpawnPickup(now: number) {
    if (this.pickups.length >= MAX_PICKUPS) return;
    if (now - this.lastPickupSpawnAt < PICKUP_SPAWN_INTERVAL_MS) return;
    const tile = this.randomOpenTile();
    if (!tile) return;
    const px = spawnPixel(tile);
    this.pickups.push({ id: makeId(), x: px.x, y: px.y, kind: randomPickupKind() });
    this.lastPickupSpawnAt = now;
  }

  /** Applies flat damage to a tank; kills + credits `killerId` (if any) once hp runs out. */
  private damagePlayer(target: TankPlayer, amount: number, killerId: string | null) {
    if (!target.alive) return;
    target.hp -= amount;
    if (target.hp > 0) return;

    target.alive = false;
    target.respawnAt = Date.now() + RESPAWN_DELAY_MS;
    const killer = killerId ? this.players.get(killerId) : undefined;
    if (killer) {
      killer.score += 1;
      if (killer.score >= KILL_TARGET) {
        this.status = "ended";
        this.winnerId = killer.id;
      }
    }
    this.kills.push({ id: makeId(), killerName: killer ? killer.name : null, victimName: target.name });
  }

  /** Applies bullet damage/effects to a hit tank; returns true if the tank died. */
  private applyHit(target: TankPlayer, bulletKind: "normal" | "blind" | "big" | "fire", ownerId: string): boolean {
    if (target.shieldHitsLeft > 0) {
      target.shieldHitsLeft -= 1;
      this.impacts.push({ id: makeId(), x: target.x, y: target.y, kind: "shield" });
      return false;
    }
    if (bulletKind === "blind") {
      target.blindedUntil = Date.now() + BLIND_DURATION_MS;
      return false;
    }
    if (bulletKind === "fire") {
      target.burningUntil = Date.now() + BURN_DURATION_MS;
      target.burnOwnerId = ownerId;
    }
    const wasAlive = target.alive;
    const damage = bulletKind === "big" ? BULLET_DAMAGE * ULTIMATE_DAMAGE_MULTIPLIER : BULLET_DAMAGE;
    this.damagePlayer(target, damage, ownerId);
    return wasAlive && !target.alive;
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

    for (const player of this.players.values()) {
      if (!player.alive) {
        if (player.respawnAt !== null && now >= player.respawnAt) {
          const idx = [...this.players.values()].indexOf(player);
          const spawn = spawnPixel(getSpawnPoints(map)[idx % 4]);
          player.x = spawn.x;
          player.y = spawn.y;
          player.alive = true;
          player.hp = MAX_HP;
          player.respawnAt = null;
          player.blindedUntil = null;
          player.boostEnergy = MAX_BOOST_ENERGY;
          player.isBoosting = false;
          player.shieldHitsLeft = 0;
          player.fireShotsLeft = 0;
          player.burningUntil = null;
          player.burnOwnerId = null;
        }
        continue;
      }
      player.ultimateEnergy = Math.min(MAX_ULTIMATE_ENERGY, player.ultimateEnergy + ULTIMATE_REGEN_PER_TICK);

      const input = this.inputs.get(player.id);
      if (!input) {
        player.moving = false;
        player.boostEnergy = Math.min(MAX_BOOST_ENERGY, player.boostEnergy + BOOST_REGEN_PER_TICK);
        player.isBoosting = false;
      } else {
        let dir: Direction | null = null;
        if (input.up) dir = "up";
        else if (input.down) dir = "down";
        else if (input.left) dir = "left";
        else if (input.right) dir = "right";

        const isShielded = player.shieldHitsLeft > 0;
        player.moving = dir !== null && !isShielded;
        // The shield is a "turtle" tool — it holds position entirely while
        // active. You can still turn to face/shoot, just not relocate.
        const wantsBoost = dir !== null && input.boost && player.boostEnergy > 0 && !isShielded;
        if (dir) {
          player.dir = dir;
        }
        if (dir && !isShielded) {
          const speed = wantsBoost ? TANK_SPEED * BOOST_SPEED_MULTIPLIER : TANK_SPEED;
          const v = DIR_VECTOR[dir];
          const nx = player.x + v.dx * speed;
          const ny = player.y + v.dy * speed;

          if (!tankBlocked(map, nx, player.y)) {
            const blocker = findOverlappingTank(this.players.values(), new Set([player.id]), nx, player.y);
            if (!blocker) {
              player.x = nx;
            } else if (winsShovingContest(player, wantsBoost, blocker)) {
              const impactX = blocker.x;
              const impactY = blocker.y;
              if (tryPushTank(blocker, v.dx * speed, v.dy * speed, map, this.players, player.id)) {
                player.x = nx;
                this.impacts.push({ id: makeId(), x: impactX, y: impactY, kind: "shove" });
              }
            }
          }
          if (!tankBlocked(map, player.x, ny)) {
            const blocker = findOverlappingTank(this.players.values(), new Set([player.id]), player.x, ny);
            if (!blocker) {
              player.y = ny;
            } else if (winsShovingContest(player, wantsBoost, blocker)) {
              const impactX = blocker.x;
              const impactY = blocker.y;
              if (tryPushTank(blocker, v.dx * speed, v.dy * speed, map, this.players, player.id)) {
                player.y = ny;
                this.impacts.push({ id: makeId(), x: impactX, y: impactY, kind: "shove" });
              }
            }
          }
        }
        if (wantsBoost) {
          player.boostEnergy = Math.max(0, player.boostEnergy - BOOST_DRAIN_PER_TICK);
          player.isBoosting = true;
        } else {
          player.boostEnergy = Math.min(MAX_BOOST_ENERGY, player.boostEnergy + BOOST_REGEN_PER_TICK);
          player.isBoosting = false;
        }
      }

      // Health/item pickups.
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pickup = this.pickups[i];
        const dist = Math.hypot(player.x - pickup.x, player.y - pickup.y);
        if (dist >= TANK_SIZE / 2 + PICKUP_SIZE / 2) continue;
        if (pickup.kind === "health") {
          if (player.hp < MAX_HP) {
            player.hp = Math.min(MAX_HP, player.hp + PICKUP_HEAL_AMOUNT);
            this.pickups.splice(i, 1);
          }
        } else if (player.items.length < MAX_HELD_ITEMS && !player.items.includes(pickup.kind)) {
          player.items.push(pickup.kind);
          this.pickups.splice(i, 1);
        }
      }

      // Traps: only trigger against non-owners.
      for (let i = this.traps.length - 1; i >= 0; i--) {
        const trap = this.traps[i];
        if (trap.ownerId === player.id) continue;
        const dist = Math.hypot(player.x - trap.x, player.y - trap.y);
        if (dist < TANK_SIZE / 2 + TRAP_SIZE / 2) {
          this.traps.splice(i, 1);
          this.damagePlayer(player, TRAP_DAMAGE, trap.ownerId);
          this.impacts.push({ id: makeId(), x: trap.x, y: trap.y, kind: "trap" });
        }
      }

      // Natural terrain hazards ('H' tiles) — ticked damage while standing on
      // one, whether the tank walked in itself or got shoved there.
      if (player.alive && tileAt(map, player.x, player.y) === "H") {
        const last = this.lastHazardDamageAt.get(player.id) ?? 0;
        if (now - last >= HAZARD_DAMAGE_INTERVAL_MS) {
          this.lastHazardDamageAt.set(player.id, now);
          this.damagePlayer(player, HAZARD_DAMAGE, null);
        }
      }

      // Burning: ticked damage from a fire bullet until it lapses — unless
      // doused early by stepping into a monster nest's puddle.
      if (player.alive && player.burningUntil !== null) {
        const inPuddle = this.monsters.some(
          (m) => Math.hypot(player.x - m.nestX, player.y - m.nestY) < NEST_PUDDLE_RADIUS
        );
        if (inPuddle) {
          player.burningUntil = null;
          player.burnOwnerId = null;
        } else if (now >= player.burningUntil) {
          player.burningUntil = null;
          player.burnOwnerId = null;
        } else {
          const last = this.lastBurnDamageAt.get(player.id) ?? 0;
          if (now - last >= BURN_TICK_INTERVAL_MS) {
            this.lastBurnDamageAt.set(player.id, now);
            this.damagePlayer(player, BURN_DAMAGE_PER_TICK, player.burnOwnerId);
          }
        }
      }
    }

    // Forest monsters: passive wanderers tied to their own nest (spawn spot).
    // They only give chase after a tank collides with or shoots them, and
    // give up — back to wandering near the nest — once the target escapes
    // the leash range, dies, or the aggro timer lapses unrefreshed.
    for (const monster of this.monsters) {
      if (!monster.alive) {
        if (monster.respawnAt !== null && now >= monster.respawnAt) {
          // Respawns at its own nest, not a fresh random spot — the nest is
          // a fixed lair for the whole match (marked on the ground for players).
          monster.x = monster.nestX;
          monster.y = monster.nestY;
          monster.alive = true;
          monster.hp = MONSTER_HP;
          monster.respawnAt = null;
          monster.aggroPlayerId = null;
          this.monsterAggroUntil.delete(monster.id);
          this.monsterRestUntil.delete(monster.id);
        }
        continue;
      }

      if (monster.aggroPlayerId) {
        const target = this.players.get(monster.aggroPlayerId);
        const aggroUntil = this.monsterAggroUntil.get(monster.id) ?? 0;
        const targetGone = !target || !target.alive || !target.connected;
        const tooFar = !targetGone && target
          ? Math.hypot(target.x - monster.nestX, target.y - monster.nestY) > MONSTER_CHASE_LEASH_RADIUS
          : true;
        if (targetGone || tooFar || now >= aggroUntil) {
          monster.aggroPlayerId = null;
          this.monsterAggroUntil.delete(monster.id);
        }
      }

      let dir: Direction | null;
      const speed = monster.aggroPlayerId ? MONSTER_SPEED * MONSTER_CHASE_SPEED_MULTIPLIER : MONSTER_SPEED;
      if (monster.aggroPlayerId) {
        const target = this.players.get(monster.aggroPlayerId)!;
        const dx = target.x - monster.x;
        const dy = target.y - monster.y;
        dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      } else {
        // Passive wandering alternates between short walks and standing
        // around at the nest — it doesn't just run in circles forever.
        const restUntil = this.monsterRestUntil.get(monster.id) ?? 0;
        if (now >= restUntil) {
          const lastChange = this.lastMonsterDirChangeAt.get(monster.id) ?? 0;
          if (now - lastChange >= MONSTER_DIR_CHANGE_MS) {
            this.lastMonsterDirChangeAt.set(monster.id, now);
            const strayedFromNest = Math.hypot(monster.x - monster.nestX, monster.y - monster.nestY) > MONSTER_NEST_RADIUS;
            if (strayedFromNest) {
              const dx = monster.nestX - monster.x;
              const dy = monster.nestY - monster.y;
              monster.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
            } else if (Math.random() < MONSTER_REST_CHANCE) {
              this.monsterRestUntil.set(monster.id, now + MONSTER_REST_DURATION_MS);
            } else {
              const dirs: Direction[] = ["up", "down", "left", "right"];
              monster.dir = dirs[Math.floor(Math.random() * dirs.length)];
            }
          }
        }
        dir = now < (this.monsterRestUntil.get(monster.id) ?? 0) ? null : monster.dir;
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
        if (blockedAxis && !monster.aggroPlayerId) this.lastMonsterDirChangeAt.set(monster.id, 0); // bounced off a wall — pick a new direction next tick
      }

      for (const player of this.players.values()) {
        if (!player.alive) continue;
        const dist = Math.hypot(player.x - monster.x, player.y - monster.y);
        if (dist >= TANK_SIZE / 2 + MONSTER_SIZE / 2) continue;
        const key = `${player.id}:${monster.id}`;
        const last = this.lastMonsterContactAt.get(key) ?? 0;
        if (now - last >= MONSTER_CONTACT_COOLDOWN_MS) {
          this.lastMonsterContactAt.set(key, now);
          this.damagePlayer(player, MONSTER_DAMAGE, null);
          monster.aggroPlayerId = player.id;
          this.monsterAggroUntil.set(monster.id, now + MONSTER_AGGRO_TIMEOUT_MS);
        }
      }
    }

    this.maybeSpawnPickup(now);

    const survivors: Bullet[] = [];
    for (const bullet of this.bullets) {
      const v = DIR_VECTOR[bullet.dir];
      bullet.x += v.dx * BULLET_SPEED;
      bullet.y += v.dy * BULLET_SPEED;

      if (tileAt(map, bullet.x, bullet.y) === "#") continue; // hit a wall

      let hit = false;
      for (const target of this.players.values()) {
        if (!target.alive || target.id === bullet.ownerId) continue;
        const dx = target.x - bullet.x;
        const dy = target.y - bullet.y;
        if (Math.hypot(dx, dy) < TANK_SIZE / 2) {
          hit = true;
          this.applyHit(target, bullet.kind, bullet.ownerId);
          break;
        }
      }
      if (!hit && bullet.kind !== "blind") {
        for (const monster of this.monsters) {
          if (!monster.alive) continue;
          const dx = monster.x - bullet.x;
          const dy = monster.y - bullet.y;
          if (Math.hypot(dx, dy) < MONSTER_SIZE / 2) {
            hit = true;
            monster.hp -= bullet.kind === "big" ? ULTIMATE_DAMAGE_MULTIPLIER : 1;
            if (monster.hp <= 0) {
              monster.alive = false;
              monster.respawnAt = now + MONSTER_RESPAWN_DELAY_MS;
              monster.aggroPlayerId = null;
              this.monsterAggroUntil.delete(monster.id);
              this.pickups.push({ id: makeId(), x: monster.x, y: monster.y, kind: "shield" });
            } else {
              monster.aggroPlayerId = bullet.ownerId;
              this.monsterAggroUntil.set(monster.id, now + MONSTER_AGGRO_TIMEOUT_MS);
            }
            break;
          }
        }
      }
      if (!hit) survivors.push(bullet);
    }
    this.bullets = survivors;

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
      hostId: this.hostId,
      players: [...this.players.values()],
      bullets: this.bullets,
      pickups: this.pickups,
      traps: this.traps,
      monsters: this.monsters,
      impacts: this.impacts,
      kills: this.kills,
      mapId: this.mapId,
      killTarget: KILL_TARGET,
      winnerId: this.winnerId,
      serverNow: Date.now(),
    };
  }

  private broadcastState() {
    this.party.broadcast(JSON.stringify(this.stateMessage()));
  }
}
