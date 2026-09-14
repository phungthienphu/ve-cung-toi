import type * as Party from "partykit/server";
import {
  SOCCER_BALL_CONTROL_MAX_SPEED,
  SOCCER_BALL_FRICTION,
  SOCCER_BALL_RADIUS,
  SOCCER_BALL_STOP_SPEED,
  SOCCER_BALL_WALL_BOUNCE,
  SOCCER_BOOST_DRAIN_PER_TICK,
  SOCCER_BOOST_MAX_ENERGY,
  SOCCER_BOOST_REGEN_PER_TICK,
  SOCCER_BOOST_SPEED_MULTIPLIER,
  SOCCER_DEFLECT_DAMPING,
  SOCCER_DEFLECT_SPREAD_RAD,
  SOCCER_DRIBBLE_EASE,
  SOCCER_DRIBBLE_LEAD_PX,
  SOCCER_DRIBBLE_RADIUS,
  SOCCER_FIELD_H,
  SOCCER_FIELD_W,
  SOCCER_GOAL_BOTTOM,
  SOCCER_GOAL_TOP,
  SOCCER_KICKOFF_FREEZE_MS,
  SOCCER_KICK_CHARGE_MAX_MS,
  SOCCER_KICK_MAX_SPEED,
  SOCCER_KICK_MIN_SPEED,
  SOCCER_MATCH_DURATION_MS,
  SOCCER_PLAYER_RADIUS,
  SOCCER_PLAYER_SPEED,
  SOCCER_TACKLE_COOLDOWN_MS,
  SOCCER_TACKLE_KNOCKBACK_DIST,
  SOCCER_TACKLE_KNOCK_SPEED,
  SOCCER_TACKLE_LUNGE_MS,
  SOCCER_TACKLE_LUNGE_SPEED,
  SOCCER_TACKLE_MISS_SLOW_MS,
  SOCCER_TACKLE_MISS_SLOW_MULTIPLIER,
  SOCCER_TACKLE_RANGE,
  SOCCER_TICK_MS,
  SOCCER_TOUCH_COOLDOWN_MS,
  type SoccerBall,
  type SoccerCardEvent,
  type SoccerTackleEvent,
  type SoccerClientMessage,
  type SoccerGoalEvent,
  type SoccerPlayer,
  type SoccerPublicState,
  type SoccerRoomListing,
  type SoccerRoomStatus,
  type SoccerServerMessage,
  type SoccerTeam,
  type SoccerTeamSize,
} from "../shared/soccerTypes";

interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  aimAngle: number | null;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default class SoccerRoom implements Party.Server {
  players = new Map<string, SoccerPlayer>();
  inputs = new Map<string, InputState>();
  ball: SoccerBall = { x: SOCCER_FIELD_W / 2, y: SOCCER_FIELD_H / 2, vx: 0, vy: 0, controllerId: null, touchImmuneIds: [], touchCooldownUntil: 0 };
  hostId: string | null = null;
  status: SoccerRoomStatus = "lobby";
  teamSize: SoccerTeamSize = 2;
  teamScores: Record<SoccerTeam, number> = { A: 0, B: 0 };
  winningTeam: SoccerTeam | null = null;
  matchEndsAt: number | null = null;
  kickoffUntil: number | null = null;
  goalEvents: SoccerGoalEvent[] = [];
  cardEvents: SoccerCardEvent[] = [];
  tackleEvents: SoccerTackleEvent[] = [];

  tickHandle: ReturnType<typeof setInterval> | null = null;
  disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  static readonly DISCONNECT_GRACE_MS = 8000;

  constructor(readonly party: Party.Party) {}

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
      setTimeout(() => this.finalizeDisconnect(player.id), SoccerRoom.DISCONNECT_GRACE_MS)
    );
  }

  private finalizeDisconnect(playerId: string) {
    this.disconnectTimers.delete(playerId);
    const player = this.players.get(playerId);
    if (!player || player.connected) return;
    if (this.hostId === playerId) {
      const next = [...this.players.values()].find((p) => p.connected && p.id !== playerId);
      this.hostId = next ? next.id : null;
    }
    this.broadcastState();
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: SoccerClientMessage;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    switch (msg.type) {
      case "join":
        return this.handleJoin(msg.playerId, msg.name, sender);
      case "choose_team":
        return this.handleChooseTeam(msg.team, sender);
      case "set_team_size":
        return this.handleSetTeamSize(msg.teamSize, sender);
      case "start_game":
        return this.handleStartGame(sender);
      case "play_again":
        return this.handlePlayAgain(sender);
      case "input":
        return this.handleInput(msg, sender);
      case "kick_start":
        return this.handleKickStart(sender);
      case "kick_release":
        return this.handleKickRelease(sender);
      case "tackle":
        return this.handleTackle(sender);
      case "leave_room":
        return this.handleLeaveRoom(sender);
    }
  }

  // ---------- lobby ----------

  private teamCount(team: SoccerTeam): number {
    let n = 0;
    for (const p of this.players.values()) if (p.connected && p.team === team) n += 1;
    return n;
  }

  private leastFilledTeam(): SoccerTeam | null {
    const a = this.teamCount("A");
    const b = this.teamCount("B");
    if (a < this.teamSize && a <= b) return "A";
    if (b < this.teamSize) return "B";
    return null;
  }

  private handleJoin(playerId: string, name: string, sender: Party.Connection) {
    const cleanName = name.trim().slice(0, 20) || "Người chơi";
    let player = this.players.get(playerId);

    if (!player) {
      const team = this.leastFilledTeam();
      if (!team) {
        sender.send(JSON.stringify({ type: "error", message: "Phòng đã đầy." } satisfies SoccerServerMessage));
        return;
      }
      player = {
        id: playerId,
        name: cleanName,
        team,
        connected: true,
        x: SOCCER_FIELD_W / 2,
        y: SOCCER_FIELD_H / 2,
        angle: team === "A" ? 0 : Math.PI,
        moving: false,
        kickChargeStartedAt: null,
        tackleCooldownUntil: 0,
        tackleSlowUntil: 0,
        tackleDashUntil: null,
        tackleDashAngle: 0,
        boostEnergy: SOCCER_BOOST_MAX_ENERGY,
        isBoosting: false,
        fouls: 0,
        cardStatus: "none",
        sentOff: false,
      };
      this.players.set(playerId, player);
      if (this.players.size === 1) this.hostId = playerId;
    } else {
      const pending = this.disconnectTimers.get(playerId);
      if (pending) {
        clearTimeout(pending);
        this.disconnectTimers.delete(playerId);
      }
      player.connected = true;
      player.name = cleanName;
    }

    if (!this.hostId || !this.players.get(this.hostId)?.connected) this.hostId = playerId;

    sender.send(JSON.stringify(this.stateMessage()));
    this.broadcastState();
    this.reportToDirectory();
  }

  private handleChooseTeam(team: SoccerTeam, sender: Party.Connection) {
    if (this.status !== "lobby") return;
    const player = this.players.get(sender.id);
    if (!player || player.team === team) return;
    if (this.teamCount(team) >= this.teamSize) return; // target team already full
    player.team = team;
    this.broadcastState();
  }

  private handleSetTeamSize(teamSize: SoccerTeamSize, sender: Party.Connection) {
    if (this.status !== "lobby" || sender.id !== this.hostId) return;
    this.teamSize = teamSize;
    this.broadcastState();
    this.reportToDirectory();
  }

  private kickoffFormation() {
    // Sent-off players stay wherever they were (frozen — stepPlayers skips
    // them) rather than reappearing in the kickoff line, since they're out
    // for the rest of the match.
    const teamA = [...this.players.values()].filter((p) => p.connected && p.team === "A" && !p.sentOff);
    const teamB = [...this.players.values()].filter((p) => p.connected && p.team === "B" && !p.sentOff);
    const place = (list: SoccerPlayer[], x: number, facing: number) => {
      const gap = SOCCER_FIELD_H / (list.length + 1);
      list.forEach((p, i) => {
        p.x = x;
        p.y = gap * (i + 1);
        p.angle = facing;
        p.moving = false;
        p.kickChargeStartedAt = null;
        p.tackleDashUntil = null;
      });
    };
    place(teamA, SOCCER_FIELD_W * 0.25, 0);
    place(teamB, SOCCER_FIELD_W * 0.75, Math.PI);
    this.ball = { x: SOCCER_FIELD_W / 2, y: SOCCER_FIELD_H / 2, vx: 0, vy: 0, controllerId: null, touchImmuneIds: [], touchCooldownUntil: 0 };
    this.kickoffUntil = Date.now() + SOCCER_KICKOFF_FREEZE_MS;
  }

  private handleStartGame(sender: Party.Connection) {
    if (sender.id !== this.hostId || this.status === "playing") return;
    if (this.teamCount("A") !== this.teamSize || this.teamCount("B") !== this.teamSize) {
      sender.send(
        JSON.stringify({
          type: "error",
          message: `Mỗi đội cần đúng ${this.teamSize} người để bắt đầu (${this.teamSize} vs ${this.teamSize}).`,
        } satisfies SoccerServerMessage)
      );
      return;
    }
    for (const p of this.players.values()) {
      p.tackleCooldownUntil = p.tackleSlowUntil = 0;
      p.tackleDashUntil = null;
      p.boostEnergy = SOCCER_BOOST_MAX_ENERGY;
      p.isBoosting = false;
      p.fouls = 0;
      p.cardStatus = "none";
      p.sentOff = false;
    }
    this.teamScores = { A: 0, B: 0 };
    this.winningTeam = null;
    this.goalEvents = [];
    this.cardEvents = [];
    this.tackleEvents = [];
    this.matchEndsAt = Date.now() + SOCCER_MATCH_DURATION_MS;
    this.kickoffFormation();
    this.status = "playing";
    this.ensureTicking();
    this.broadcastState();
    this.reportToDirectory();
  }

  private handlePlayAgain(sender: Party.Connection) {
    if (sender.id !== this.hostId || this.status !== "ended") return;
    this.status = "lobby";
    this.matchEndsAt = null;
    this.kickoffUntil = null;
    this.winningTeam = null;
    this.broadcastState();
    this.reportToDirectory();
  }

  private handleLeaveRoom(sender: Party.Connection) {
    const player = this.players.get(sender.id);
    if (!player) return;
    this.players.delete(sender.id);
    this.inputs.delete(sender.id);
    if (this.ball.controllerId === sender.id) this.ball.controllerId = null;
    if (this.hostId === sender.id) {
      const next = [...this.players.values()].find((p) => p.connected);
      this.hostId = next ? next.id : null;
    }
    this.broadcastState();
    this.reportToDirectory();
    sender.close();
  }

  // ---------- input / actions ----------

  private handleInput(
    msg: { up: boolean; down: boolean; left: boolean; right: boolean; boost: boolean; aimAngle?: number },
    sender: Party.Connection
  ) {
    if (!this.players.get(sender.id)) return;
    this.inputs.set(sender.id, {
      up: msg.up,
      down: msg.down,
      left: msg.left,
      right: msg.right,
      boost: msg.boost,
      aimAngle: typeof msg.aimAngle === "number" ? msg.aimAngle : null,
    });
  }

  /** True if `player` is close enough to a currently-loose ball to strike it
   * first-time — a volley, without needing to trap/control it first (see
   * handleKickRelease's doc). Same reach as picking up a loose ball at all. */
  private canVolley(player: SoccerPlayer): boolean {
    return this.ball.controllerId === null && Math.hypot(this.ball.x - player.x, this.ball.y - player.y) <= SOCCER_DRIBBLE_RADIUS;
  }

  private handleKickStart(sender: Party.Connection) {
    const player = this.players.get(sender.id);
    if (!player || player.sentOff || this.status !== "playing" || this.isFrozen()) return;
    if (this.ball.controllerId !== player.id && !this.canVolley(player)) return;
    player.kickChargeStartedAt = Date.now();
  }

  private handleKickRelease(sender: Party.Connection) {
    const player = this.players.get(sender.id);
    if (!player || player.kickChargeStartedAt === null) return;
    const chargedMs = Date.now() - player.kickChargeStartedAt;
    player.kickChargeStartedAt = null;
    if (this.status !== "playing" || this.isFrozen()) return;
    // Either you're dribbling it (a normal shot/pass), or it's still loose
    // and close enough to meet first-time (a volley) — either way the ball's
    // current velocity gets overridden by the new strike. Anything else
    // (lost the ball mid-charge — tackled, or it rolled out of reach) is a
    // wasted press.
    if (this.ball.controllerId !== player.id && !this.canVolley(player)) return;

    const t = Math.min(1, chargedMs / SOCCER_KICK_CHARGE_MAX_MS);
    const power = SOCCER_KICK_MIN_SPEED + (SOCCER_KICK_MAX_SPEED - SOCCER_KICK_MIN_SPEED) * t;
    this.ball.controllerId = null;
    this.ball.touchImmuneIds = [player.id];
    this.ball.touchCooldownUntil = Date.now() + SOCCER_TOUCH_COOLDOWN_MS;
    this.ball.vx = Math.cos(player.angle) * power;
    this.ball.vy = Math.sin(player.angle) * power;
  }

  private handleTackle(sender: Party.Connection) {
    const tackler = this.players.get(sender.id);
    if (!tackler || tackler.sentOff || this.status !== "playing" || this.isFrozen()) return;
    const now = Date.now();
    if (now < tackler.tackleCooldownUntil) return;
    tackler.tackleCooldownUntil = now + SOCCER_TACKLE_COOLDOWN_MS;
    // The lunge itself commits regardless of outcome — see
    // SOCCER_TACKLE_LUNGE_MS's doc. Locks in the direction the tackle was
    // aimed at the moment of the press.
    tackler.tackleDashUntil = now + SOCCER_TACKLE_LUNGE_MS;
    tackler.tackleDashAngle = tackler.angle;

    // Any opposing player in range is a valid tackle target — whether it's a
    // clean steal or a foul depends on whether that target actually has the
    // ball (see SoccerCardEvent's doc).
    let victim: SoccerPlayer | null = null;
    let victimDist = SOCCER_TACKLE_RANGE;
    for (const p of this.players.values()) {
      if (p.team === tackler.team || p.sentOff) continue;
      const dist = Math.hypot(p.x - tackler.x, p.y - tackler.y);
      if (dist <= victimDist) {
        victim = p;
        victimDist = dist;
      }
    }

    if (!victim) {
      // Whiffed — a real lunge that finds nobody leaves you briefly slower,
      // so mashing tackle isn't a free way to harass the ball carrier.
      tackler.tackleSlowUntil = now + SOCCER_TACKLE_MISS_SLOW_MS;
      this.tackleEvents.push({ id: makeId(), x: tackler.x, y: tackler.y, angle: tackler.angle, hit: false });
      return;
    }

    // Contact — shove the victim away from the tackler (this doubles as the
    // fix for them otherwise standing right where the ball still is and
    // instantly re-collecting it; see SoccerBall.touchImmuneIds's doc).
    const kbDx = victim.x - tackler.x;
    const kbDy = victim.y - tackler.y;
    const kbLen = Math.hypot(kbDx, kbDy) || 1;
    victim.x = clamp(victim.x + (kbDx / kbLen) * SOCCER_TACKLE_KNOCKBACK_DIST, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_W - SOCCER_PLAYER_RADIUS);
    victim.y = clamp(victim.y + (kbDy / kbLen) * SOCCER_TACKLE_KNOCKBACK_DIST, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_H - SOCCER_PLAYER_RADIUS);

    const wasHoldingBall = victim.id === this.ball.controllerId;
    if (wasHoldingBall) {
      this.ball.controllerId = null;
      this.ball.touchImmuneIds = [tackler.id, victim.id];
      this.ball.touchCooldownUntil = now + SOCCER_TOUCH_COOLDOWN_MS;
      this.ball.vx = Math.cos(tackler.angle) * SOCCER_TACKLE_KNOCK_SPEED;
      this.ball.vy = Math.sin(tackler.angle) * SOCCER_TACKLE_KNOCK_SPEED;
    } else {
      // Connected with a player who wasn't holding the ball — a foul.
      tackler.fouls += 1;
      tackler.cardStatus = tackler.fouls >= 2 ? "red" : "yellow";
      if (tackler.cardStatus === "red") {
        tackler.sentOff = true;
        this.checkForfeit(tackler.team);
      }
      this.cardEvents.push({ id: makeId(), playerName: tackler.name, card: tackler.cardStatus });
    }
    this.tackleEvents.push({ id: makeId(), x: tackler.x, y: tackler.y, angle: tackler.angle, hit: true });
  }

  /** A team that's had every player sent off can't keep playing — rule it
   * an immediate forfeit rather than letting the match limp on toward the
   * clock with nobody left to actually play it. */
  private checkForfeit(team: SoccerTeam) {
    if (this.status !== "playing") return;
    const remaining = [...this.players.values()].filter((p) => p.connected && p.team === team && !p.sentOff).length;
    if (remaining > 0) return;
    this.status = "ended";
    this.winningTeam = team === "A" ? "B" : "A";
    this.stopTicking();
    this.broadcastState();
  }

  private isFrozen(): boolean {
    return this.kickoffUntil !== null && Date.now() < this.kickoffUntil;
  }

  // ---------- simulation ----------

  private ensureTicking() {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this.tick(), SOCCER_TICK_MS);
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

    if (this.matchEndsAt !== null && now >= this.matchEndsAt) {
      this.status = "ended";
      this.winningTeam = this.teamScores.A === this.teamScores.B ? null : this.teamScores.A > this.teamScores.B ? "A" : "B";
      this.broadcastState();
      this.stopTicking();
      return;
    }

    if (this.kickoffUntil !== null && now >= this.kickoffUntil) this.kickoffUntil = null;
    if (!this.isFrozen()) {
      this.stepPlayers(now);
      this.stepBall();
      this.checkGoal();
    }

    this.broadcastState();
    // Reset only after broadcasting, same reasoning as tank-server.ts's
    // impacts/kills: a tackle's foul can land synchronously from onMessage,
    // between two ticks — clearing at the top of tick() instead would wipe
    // it before it ever reached a broadcast.
    this.goalEvents = [];
    this.cardEvents = [];
    this.tackleEvents = [];
  }

  private stepPlayers(now: number) {
    for (const player of this.players.values()) {
      if (!player.connected || player.sentOff) continue;

      if (player.tackleDashUntil !== null) {
        if (now >= player.tackleDashUntil) {
          player.tackleDashUntil = null;
        } else {
          // Forced slide along the locked-in lunge direction — normal
          // input is ignored entirely for its short duration, same idea as
          // tank's dash. See SOCCER_TACKLE_LUNGE_MS's doc.
          player.angle = player.tackleDashAngle;
          player.moving = true;
          player.x = clamp(
            player.x + Math.cos(player.tackleDashAngle) * SOCCER_TACKLE_LUNGE_SPEED,
            SOCCER_PLAYER_RADIUS,
            SOCCER_FIELD_W - SOCCER_PLAYER_RADIUS
          );
          player.y = clamp(
            player.y + Math.sin(player.tackleDashAngle) * SOCCER_TACKLE_LUNGE_SPEED,
            SOCCER_PLAYER_RADIUS,
            SOCCER_FIELD_H - SOCCER_PLAYER_RADIUS
          );
          continue;
        }
      }

      const input = this.inputs.get(player.id);
      let dx = 0;
      let dy = 0;
      if (input?.up) dy -= 1;
      if (input?.down) dy += 1;
      if (input?.left) dx -= 1;
      if (input?.right) dx += 1;

      player.moving = dx !== 0 || dy !== 0;
      // Facing follows the mouse (aimAngle) whenever it's available — see
      // SoccerPlayer.angle's doc — falling back to the movement direction
      // for touch controls, which have no cursor to report one.
      if (input?.aimAngle !== null && input?.aimAngle !== undefined) {
        player.angle = input.aimAngle;
      } else if (player.moving) {
        const len = Math.hypot(dx, dy);
        player.angle = Math.atan2(dy, len === 0 ? 0 : dx);
      }

      const wantsBoost = !!input?.boost && player.boostEnergy > 0 && player.moving;
      player.isBoosting = wantsBoost;
      player.boostEnergy = wantsBoost
        ? Math.max(0, player.boostEnergy - SOCCER_BOOST_DRAIN_PER_TICK)
        : Math.min(SOCCER_BOOST_MAX_ENERGY, player.boostEnergy + SOCCER_BOOST_REGEN_PER_TICK);

      if (player.moving) {
        const len = Math.hypot(dx, dy);
        const slowed = now < player.tackleSlowUntil;
        const boostMult = wantsBoost ? SOCCER_BOOST_SPEED_MULTIPLIER : 1;
        const speed = (SOCCER_PLAYER_SPEED * boostMult * (slowed ? SOCCER_TACKLE_MISS_SLOW_MULTIPLIER : 1)) / len;
        player.x = clamp(player.x + dx * speed, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_W - SOCCER_PLAYER_RADIUS);
        player.y = clamp(player.y + dy * speed, SOCCER_PLAYER_RADIUS, SOCCER_FIELD_H - SOCCER_PLAYER_RADIUS);
      }
    }
  }

  private stepBall() {
    const ball = this.ball;
    if (ball.controllerId) {
      const controller = this.players.get(ball.controllerId);
      if (!controller || !controller.connected) {
        ball.controllerId = null;
      } else {
        // Eases toward the ideal dribble spot instead of snapping straight
        // to it — see SOCCER_DRIBBLE_EASE's doc for why a hard set looked
        // like the ball teleporting onto the player.
        const targetX = controller.x + Math.cos(controller.angle) * SOCCER_DRIBBLE_LEAD_PX;
        const targetY = controller.y + Math.sin(controller.angle) * SOCCER_DRIBBLE_LEAD_PX;
        ball.x += (targetX - ball.x) * SOCCER_DRIBBLE_EASE;
        ball.y += (targetY - ball.y) * SOCCER_DRIBBLE_EASE;
        ball.vx = 0;
        ball.vy = 0;
        return;
      }
    }

    // Loose ball: whoever's closest within dribble range takes control —
    // no proximity-steal from an existing controller (see stepBall's early
    // return above), only an active tackle can contest a held ball. Whoever
    // just kicked/tackled it loose is excluded until touchCooldownUntil
    // passes — see SoccerBall.touchImmuneIds's doc for why (otherwise
    // they'd just instantly re-pick-up their own kick/steal, every single
    // time, before it ever traveled anywhere).
    const now = Date.now();
    const touchImmune = now < ball.touchCooldownUntil ? ball.touchImmuneIds : [];
    let closest: SoccerPlayer | null = null;
    let closestDist = SOCCER_DRIBBLE_RADIUS;
    for (const p of this.players.values()) {
      if (!p.connected || p.sentOff || touchImmune.includes(p.id)) continue;
      const dist = Math.hypot(p.x - ball.x, p.y - ball.y);
      if (dist <= closestDist) {
        closest = p;
        closestDist = dist;
      }
    }
    if (closest) {
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed <= SOCCER_BALL_CONTROL_MAX_SPEED) {
        ball.controllerId = closest.id;
        return;
      }
      // Too hot to trap cleanly — deflects off them instead of gluing on,
      // same physical idea as a real first touch on a hard shot. See
      // SOCCER_BALL_CONTROL_MAX_SPEED's doc. Falls through to the normal
      // position/friction/wall-bounce integration below using the ball's
      // new (deflected) velocity, rather than returning early.
      const nx = ball.x - closest.x;
      const ny = ball.y - closest.y;
      const nLen = Math.hypot(nx, ny) || 1;
      const normX = nx / nLen;
      const normY = ny / nLen;
      const dot = ball.vx * normX + ball.vy * normY;
      const reflectedVx = ball.vx - 2 * dot * normX;
      const reflectedVy = ball.vy - 2 * dot * normY;
      const jitter = (Math.random() - 0.5) * 2 * SOCCER_DEFLECT_SPREAD_RAD;
      const cosJ = Math.cos(jitter);
      const sinJ = Math.sin(jitter);
      ball.vx = (reflectedVx * cosJ - reflectedVy * sinJ) * SOCCER_DEFLECT_DAMPING;
      ball.vy = (reflectedVx * sinJ + reflectedVy * cosJ) * SOCCER_DEFLECT_DAMPING;
      ball.touchImmuneIds = [closest.id];
      ball.touchCooldownUntil = now + SOCCER_TOUCH_COOLDOWN_MS;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= SOCCER_BALL_FRICTION;
    ball.vy *= SOCCER_BALL_FRICTION;
    if (Math.hypot(ball.vx, ball.vy) < SOCCER_BALL_STOP_SPEED) {
      ball.vx = 0;
      ball.vy = 0;
    }

    const inGoalMouth = ball.y >= SOCCER_GOAL_TOP && ball.y <= SOCCER_GOAL_BOTTOM;
    if (!inGoalMouth || (ball.x > SOCCER_BALL_RADIUS && ball.x < SOCCER_FIELD_W - SOCCER_BALL_RADIUS)) {
      if (ball.x < SOCCER_BALL_RADIUS && !inGoalMouth) {
        ball.x = SOCCER_BALL_RADIUS;
        ball.vx = Math.abs(ball.vx) * SOCCER_BALL_WALL_BOUNCE;
      } else if (ball.x > SOCCER_FIELD_W - SOCCER_BALL_RADIUS && !inGoalMouth) {
        ball.x = SOCCER_FIELD_W - SOCCER_BALL_RADIUS;
        ball.vx = -Math.abs(ball.vx) * SOCCER_BALL_WALL_BOUNCE;
      }
    }
    if (ball.y < SOCCER_BALL_RADIUS) {
      ball.y = SOCCER_BALL_RADIUS;
      ball.vy = Math.abs(ball.vy) * SOCCER_BALL_WALL_BOUNCE;
    } else if (ball.y > SOCCER_FIELD_H - SOCCER_BALL_RADIUS) {
      ball.y = SOCCER_FIELD_H - SOCCER_BALL_RADIUS;
      ball.vy = -Math.abs(ball.vy) * SOCCER_BALL_WALL_BOUNCE;
    }
  }

  private checkGoal() {
    const ball = this.ball;
    const inGoalMouth = ball.y >= SOCCER_GOAL_TOP && ball.y <= SOCCER_GOAL_BOTTOM;
    if (!inGoalMouth) return;
    if (ball.x - SOCCER_BALL_RADIUS <= 0) {
      this.teamScores.B += 1;
      this.goalEvents.push({ id: makeId(), scoringTeam: "B", scoreA: this.teamScores.A, scoreB: this.teamScores.B });
      this.kickoffFormation();
    } else if (ball.x + SOCCER_BALL_RADIUS >= SOCCER_FIELD_W) {
      this.teamScores.A += 1;
      this.goalEvents.push({ id: makeId(), scoringTeam: "A", scoreA: this.teamScores.A, scoreB: this.teamScores.B });
      this.kickoffFormation();
    }
  }

  // ---------- state ----------

  private publicState(): SoccerPublicState {
    return {
      roomId: this.party.id,
      status: this.status,
      hostId: this.hostId,
      teamSize: this.teamSize,
      players: [...this.players.values()],
      ball: this.ball,
      teamScores: this.teamScores,
      matchEndsAt: this.matchEndsAt,
      winningTeam: this.winningTeam,
      kickoffUntil: this.kickoffUntil,
      goalEvents: this.goalEvents,
      cardEvents: this.cardEvents,
      tackleEvents: this.tackleEvents,
      serverNow: Date.now(),
    };
  }

  private stateMessage(): SoccerServerMessage {
    return { type: "state", state: this.publicState() };
  }

  private broadcastState() {
    this.party.broadcast(JSON.stringify(this.stateMessage()));
  }

  /** Same nice-to-have listing pattern as tank-directory.ts — fire-and-forget,
   * nothing gameplay-critical depends on it. */
  private reportToDirectory() {
    const listing: SoccerRoomListing = {
      roomId: this.party.id,
      playerCount: [...this.players.values()].filter((p) => p.connected).length,
      teamSize: this.teamSize,
      status: this.status,
    };
    this.party.context.parties["soccerlobby"]
      .get("main")
      .fetch({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(listing) })
      .catch(() => {});
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
