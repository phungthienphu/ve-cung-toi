import type * as Party from "partykit/server";
import {
  BULLET_SIZE,
  BULLET_SPEED,
  BULLET_SPREAD_MAX_DEG,
  BULLET_SPREAD_PER_SHOT_DEG,
  BULLET_SPREAD_RESET_MS,
  DEFAULT_MAP_ID,
  FIRE_COOLDOWN_MS,
  FIRE_SHOTS_PER_ITEM,
  KILL_TARGET,
  MATCH_DURATION_MS,
  MAX_BOOST_ENERGY,
  MAX_TANK_PLAYERS,
  MIN_TANK_PLAYERS,
  MAX_HP,
  MONSTER_PACK_COUNT,
  RAPID_FIRE_COOLDOWN_MS,
  SHIELD_MAX_HITS,
  SPAWN_MIN_DISTANCE_PX,
  TANK_COLORS,
  TANK_SIZE,
  TICK_MS,
  ULTIMATE_ACTIVATION_MODE,
  ULTIMATE_CONFIG,
  getMap,
  mapCols,
  skinForColor,
  type Airstrike,
  type Bullet,
  type Crate,
  type ItemKind,
  type Monster,
  type Pickup,
  type RedBarrage,
  type TankClientMessage,
  type TankImpact,
  type TankKillEvent,
  type TankMapDef,
  type Team,
  type TankPlayer,
  type TankPublicState,
  type TankRoomListing,
  type TankRoomMode,
  type TankRoomStatus,
  type TankServerMessage,
  type Trap,
} from "../shared/tankTypes";
import { randomAirstrikeDelay, stepAirstrikes } from "./tank/airstrike";
import { stepBullets } from "./tank/bullets-tick";
import { spawnCratesFromLayout } from "./tank/crates";
import { aimAngleOf, makeId, pickSpawnTile, spawnPixel } from "./tank/geometry";
import { stepGreenBursts, type PendingGreenBurst } from "./tank/greenBurst";
import { spawnMonsterPacks, stepMonsters } from "./tank/monsters-tick";
import { maybeSpawnPickup } from "./tank/pickups";
import { stepPlayers } from "./tank/players-tick";
import { stepRedBarrages } from "./tank/redBarrage";
import { stepHooks, type PendingHook } from "./tank/hook";
import {
  activateDash,
  activateGreenBurst,
  activateHook,
  activateRapidFire,
  activateSandWave,
  activateShieldAura,
  fireSniperShot,
  initialSkillState,
  resetSkillState,
  stepShieldAuras,
  throwRedBomb,
} from "./tank/skills";
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
  redBarrages: RedBarrage[] = [];
  matchStartAt: number | null = null;
  impacts: TankImpact[] = [];
  kills: TankKillEvent[] = [];
  lastPickupSpawnAt = 0;
  lastHazardDamageAt = new Map<string, number>();
  lastBurnDamageAt = new Map<string, number>();
  lastMonsterDirChangeAt = new Map<string, number>();
  lastMonsterContactAt = new Map<string, number>();
  lastMonsterHealAt = new Map<string, number>();
  lastDashHitAt = new Map<string, number>();
  pendingHooks: PendingHook[] = [];
  pendingGreenBursts: PendingGreenBurst[] = [];
  shotHeat = new Map<string, number>();
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
    this.reportToDirectory();

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
      case "choose_color":
        return this.handleChooseColor(msg.color, sender);
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
      case "charge_ultimate":
        return this.handleChargeUltimate(sender);
      case "throw_bomb":
        return this.handleThrowBomb(msg.x, msg.y, sender);
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

  /** Re-picking a tank mid-lobby — same "no duplicates enforced" rule as the
   * initial join color already had, so this doesn't need any new collision
   * handling either. Lobby-only, like choosing a team. */
  private handleChooseColor(color: string, sender: Party.Connection) {
    if (this.status !== "lobby") return;
    if (!TANK_COLORS.includes(color)) return;
    const player = this.players.get(sender.id);
    if (!player) return;
    player.color = color;
    this.broadcastState();
  }

  private handleSetMode(mode: TankRoomMode, sender: Party.Connection) {
    if (this.status !== "lobby" || sender.id !== this.hostId) return;
    this.mode = mode;
    this.broadcastState();
    this.reportToDirectory();
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
      // Real placement only matters once a match actually starts (see
      // handleStartGame's pickSpawnTile calls) — this is just a harmless
      // placeholder position for a player still sitting in the lobby.
      const spawn = spawnPixel({ x: 1, y: 1 });
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
        damageDealt: 0,
        damageTaken: 0,
        deaths: 0,
        velocityX: 0,
        velocityY: 0,
        connected: true,
        isHost: this.players.size === 0,
        respawnAt: null,
        items: [],
        blindedUntil: null,
        stunnedUntil: null,
        hookedUntil: null,
        hookPullUntil: null,
        hookPullFromX: 0,
        hookPullFromY: 0,
        hookPullToX: 0,
        hookPullToY: 0,
        auraShieldUntil: null,
        boostEnergy: MAX_BOOST_ENERGY,
        isBoosting: false,
        ultimateEnergy: 0,
        shieldHitsLeft: 0,
        fireShotsLeft: 0,
        burningUntil: null,
        burnOwnerId: null,
        aimAngle: null,
        ...initialSkillState(),
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
      player.damageDealt ??= 0;
      player.damageTaken ??= 0;
      player.deaths ??= 0;
      player.velocityX ??= 0;
      player.velocityY ??= 0;
    }

    if (!this.hostId || !this.players.get(this.hostId)?.connected) {
      this.hostId = playerId;
      player.isHost = true;
    }

    sender.send(JSON.stringify(this.stateMessage()));
    this.broadcastState();
    this.reportToDirectory();
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
    // Monsters are placed first so their nests are known — player spawns
    // (picked fresh below) actively steer clear of them, rather than the
    // old fixed 8-corner-point list that just happened to sit right next to
    // a couple of decorative bush clusters some maps use as nest material.
    this.monsters = spawnMonsterPacks(this.map, MONSTER_PACK_COUNT);
    // Team mode keeps each side roughly to its own half of the map (left vs
    // right) so teammates land near each other and away from the enemy —
    // FFA/practice just picks anywhere. Within whichever region a player
    // lands in, the exact spot is random and kept clear of every other
    // spawn already placed this match (and every monster nest), so tanks
    // stop reliably clustering into the same handful of corner slots — or
    // right next to a pack of monsters — every game. `avoidPx` accumulates
    // in pixel space as each player is placed, so later players in the same
    // batch also steer clear of earlier ones.
    const cols = mapCols(this.map);
    const avoidPx: { x: number; y: number }[] = this.monsters.map((m) => ({ x: m.nestX, y: m.nestY }));
    connected.forEach((p) => {
      const colRange =
        this.mode === "team" ? (p.team === "A" ? { min: 1, max: Math.floor(cols / 2) - 1 } : { min: Math.floor(cols / 2), max: cols - 2 }) : undefined;
      const tile = pickSpawnTile(this.map, avoidPx, SPAWN_MIN_DISTANCE_PX, colRange);
      const spawn = spawnPixel(tile);
      avoidPx.push(spawn);
      p.x = spawn.x;
      p.y = spawn.y;
      p.alive = true;
      p.hp = MAX_HP;
      p.score = 0;
      p.damageDealt = 0;
      p.damageTaken = 0;
      p.deaths = 0;
      p.velocityX = 0;
      p.velocityY = 0;
      p.respawnAt = null;
      p.dir = "down";
      p.items = [];
      p.blindedUntil = null;
      p.stunnedUntil = null;
      p.hookedUntil = null;
      p.hookPullUntil = null;
      p.auraShieldUntil = null;
      p.boostEnergy = MAX_BOOST_ENERGY;
      p.isBoosting = false;
      p.ultimateEnergy = 0;
      p.shieldHitsLeft = 0;
      p.fireShotsLeft = 0;
      p.burningUntil = null;
      p.burnOwnerId = null;
      resetSkillState(p);
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
    this.lastMonsterHealAt.clear();
    this.lastDashHitAt.clear();
    this.lastBurnDamageAt.clear();
    this.monsterAggroUntil.clear();
    this.monsterRestUntil.clear();
    this.teamScores = { A: 0, B: 0 };
    this.winnerId = null;
    this.winningTeam = null;
    // Practice rooms are free play with no opponents required — no timer,
    // no win condition, just respawn-and-keep-going until the host stops it.
    this.matchEndsAt = this.mode === "practice" ? null : Date.now() + MATCH_DURATION_MS;
    // Airstrikes only make sense visually on grass terrain (arena/maze) —
    // the desert map is reserved for a future train hazard instead.
    this.airstrikes = [];
    this.redBarrages = [];
    this.pendingHooks = [];
    this.pendingGreenBursts = [];
    this.matchStartAt = Date.now();
    this.nextAirstrikeAt = this.map.terrain === "grass" ? Date.now() + randomAirstrikeDelay() : null;
    this.status = "playing";
    this.ensureTicking();
    this.broadcastState();
    this.reportToDirectory();
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
    this.redBarrages = [];
    this.pendingHooks = [];
    this.pendingGreenBursts = [];
    this.nextAirstrikeAt = null;
    this.matchStartAt = null;
    this.impacts = [];
    this.kills = [];
    this.winnerId = null;
    this.winningTeam = null;
    this.matchEndsAt = null;
    this.broadcastState();
    this.reportToDirectory();
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
    this.redBarrages = [];
    this.pendingHooks = [];
    this.pendingGreenBursts = [];
    this.nextAirstrikeAt = null;
    this.matchStartAt = null;
    this.impacts = [];
    this.kills = [];
    this.winnerId = null;
    this.winningTeam = null;
    this.matchEndsAt = null;
    this.broadcastState();
    this.reportToDirectory();
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

  /**
   * Dispatches a "shoot" message. `big` requests the local skin's ultimate —
   * for a "charge" skin (see ULTIMATE_ACTIVATION_MODE) this is what the
   * client upgrades a normal fire-trigger press into while scoped, meaning
   * "release the shot at the current aim", handled entirely separately from
   * the normal cooldown-gated path below (toggling the scope on already
   * gated when this could happen); every other skin fires/activates
   * immediately on its own dedicated button press.
   */
  /** Sand's stun: can't move (see players-tick.ts) or act at all while it's
   * in effect — checked by every action handler below. */
  private isStunned(player: TankPlayer): boolean {
    return player.stunnedUntil !== null && player.stunnedUntil > Date.now();
  }

  private handleShoot(sender: Party.Connection, big: boolean) {
    const player = this.players.get(sender.id);
    if (!player || !player.alive || this.status !== "playing" || this.isStunned(player)) return;
    const skin = skinForColor(player.color);

    if (big && ULTIMATE_ACTIVATION_MODE[skin] === "charge") {
      if (player.sniperChargingSince === null) return;
      fireSniperShot(this, player);
      return;
    }

    const ultimateConfig = ULTIMATE_CONFIG[skin];
    if (big && player.ultimateEnergy < ultimateConfig.maxEnergy) return;

    const now = Date.now();
    const last = this.lastShotAt.get(sender.id) ?? 0;
    const isRapidFiring = player.rapidFireUntil !== null && now < player.rapidFireUntil;
    const cooldown = isRapidFiring ? RAPID_FIRE_COOLDOWN_MS : FIRE_COOLDOWN_MS;
    if (now - last < cooldown) return;
    this.lastShotAt.set(sender.id, now);

    // Ultimates that resolve on their own (a self-buff, an instant area
    // effect) stop here instead of falling through to spawn a bullet.
    if (big && skin === "blue") {
      activateRapidFire(player, now);
      return;
    }
    if (big && skin === "sand") {
      activateSandWave(this, player, this.map, now);
      return;
    }
    if (big && skin === "huge") {
      activateDash(player, now);
      return;
    }
    if (big && skin === "bigRed") {
      activateHook(this, player, now);
      return;
    }
    if (big && skin === "green") {
      activateGreenBurst(this, player, now);
      return;
    }
    if (big && skin === "darkLarge") {
      activateShieldAura(player, now);
      return;
    }

    const isFire = !big && player.fireShotsLeft > 0;
    if (big) {
      player.ultimateEnergy = 0;
    } else if (isFire) {
      player.fireShotsLeft -= 1;
    }

    // A normal shot fired right on the heels of the previous one (i.e.
    // holding the trigger) builds "heat", widening the spread each time —
    // resets back to pinpoint after BULLET_SPREAD_RESET_MS without firing.
    // Blue's rapid-fire window is exempt: going fast on purpose is its whole
    // gimmick, not the mindless spam this is meant to discourage. Fire ammo
    // is exempt too — it's a limited pickup the player already paid for,
    // not the free-to-spam plain shot this mechanic targets.
    let spreadDeg = 0;
    if (!big && !isRapidFiring && !isFire) {
      const prevHeat = this.shotHeat.get(sender.id) ?? 0;
      const heat = now - last < BULLET_SPREAD_RESET_MS ? prevHeat + 1 : 0;
      this.shotHeat.set(sender.id, heat);
      spreadDeg = Math.min(heat * BULLET_SPREAD_PER_SHOT_DEG, BULLET_SPREAD_MAX_DEG);
    }
    const spreadRad = spreadDeg === 0 ? 0 : ((Math.random() * 2 - 1) * spreadDeg * Math.PI) / 180;
    const angle = aimAngleOf(player) + spreadRad;
    const offset = TANK_SIZE / 2 + BULLET_SIZE;
    this.bullets.push({
      id: makeId(),
      ownerId: player.id,
      x: player.x + Math.cos(angle) * offset,
      y: player.y + Math.sin(angle) * offset,
      angle,
      kind: big ? "big" : isFire ? "fire" : "normal",
      cause: big ? "Đạn lớn" : isFire ? "Đạn lửa" : "Đạn thường",
      speed: BULLET_SPEED,
    });
  }

  /** Toggles on a "charge" skin's ultimate (currently just Dark's scope —
   * see fireSniperShot for the actual-fire/auto-fire side, triggered later
   * by a normal "shoot" message). A single tap, no holding required. The
   * client is expected to only send this for a charge-mode skin, but this
   * re-checks server-side to be safe. */
  private handleChargeUltimate(sender: Party.Connection) {
    const player = this.players.get(sender.id);
    if (!player || !player.alive || this.status !== "playing" || this.isStunned(player)) return;
    const skin = skinForColor(player.color);
    if (ULTIMATE_ACTIVATION_MODE[skin] !== "charge") return;
    if (player.sniperChargingSince !== null) return;
    if (player.ultimateEnergy < ULTIMATE_CONFIG[skin].maxEnergy) return;
    player.sniperChargingSince = Date.now();
  }

  /** Commits a "target" skin's ultimate (currently just Red's barrage) at a
   * world point the client picked entirely on its own — there's no prior
   * "start targeting" message for this mode (see ULTIMATE_ACTIVATION_MODE),
   * so this is the only place server-side that skin's skill is triggered. */
  private handleThrowBomb(x: number, y: number, sender: Party.Connection) {
    const player = this.players.get(sender.id);
    if (!player || !player.alive || this.status !== "playing" || this.isStunned(player)) return;
    const skin = skinForColor(player.color);
    if (ULTIMATE_ACTIVATION_MODE[skin] !== "target") return;
    if (player.ultimateEnergy < ULTIMATE_CONFIG[skin].maxEnergy) return;
    this.redBarrages.push(throwRedBomb(player, x, y, Date.now()));
  }

  private handleUseItem(kind: ItemKind, sender: Party.Connection) {
    const player = this.players.get(sender.id);
    if (!player || !player.alive || this.status !== "playing" || this.isStunned(player)) return;
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
        cause: "Đạn thường",
        speed: BULLET_SPEED,
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
    this.reportToDirectory();
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
      this.impacts = [];
      this.kills = [];
      this.stopTicking();
      return;
    }

    stepPlayers(this, map, now);
    stepMonsters(this, map, now);
    this.pendingHooks = stepHooks(this, map, this.pendingHooks, now);
    this.pendingGreenBursts = stepGreenBursts(this, this.pendingGreenBursts, now);
    stepShieldAuras(this, now);

    this.lastPickupSpawnAt = maybeSpawnPickup(this, map, now);

    if (map.terrain === "grass") {
      stepAirstrikes(this, map, now);
    }
    stepRedBarrages(this, now);

    stepBullets(this, map, now);

    this.broadcastState();
    // Reset only after broadcasting: an instant skill (e.g. Sand's wave) can
    // push an impact synchronously from onMessage, between two ticks — if we
    // cleared at the top of tick() instead, that push would be wiped before
    // ever reaching a broadcast.
    this.impacts = [];
    this.kills = [];
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
      redBarrages: this.redBarrages,
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

  /** Pushes this room's current listing-relevant state (player count, mode,
   * status) to the tank-directory party, so the tank-game home screen can
   * show it as a joinable lobby — see tank-directory.ts. Fire-and-forget:
   * the listing is a nice-to-have, never something gameplay should wait on
   * or fail over. Only "lobby" rooms with someone actually in them end up
   * shown; the directory itself filters that on read. */
  private reportToDirectory() {
    const listing: TankRoomListing = {
      roomId: this.party.id,
      playerCount: [...this.players.values()].filter((p) => p.connected).length,
      mode: this.mode,
      status: this.status,
    };
    this.party.context.parties["tanklobby"]
      .get("main")
      .fetch({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(listing) })
      .catch(() => {});
  }
}
