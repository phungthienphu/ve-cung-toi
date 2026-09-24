import type * as Party from "partykit/server";
import {
  SOCCER_BOOST_MAX_ENERGY,
  SOCCER_FIELD_H,
  SOCCER_FIELD_W,
  SOCCER_GOAL_BOTTOM,
  SOCCER_GOAL_TOP,
  SOCCER_KICKOFF_FREEZE_MS,
  SOCCER_KICK_CHARGE_MAX_MS,
  SOCCER_KICK_MAX_SPEED,
  SOCCER_KICK_MIN_SPEED,
  SOCCER_MATCH_DURATION_MS,
  SOCCER_DRIBBLE_RADIUS,
  SOCCER_BALL_RADIUS,
  SOCCER_TACKLE_COOLDOWN_MS,
  SOCCER_TACKLE_LUNGE_MS,
  SOCCER_TICK_MS,
  type SoccerBall,
  type SoccerBotDifficulty,
  type SoccerCardEvent,
  type SoccerClientMessage,
  type SoccerFreeKickEvent,
  type SoccerGoalEvent,
  type SoccerKickEvent,
  type SoccerPlayer,
  type SoccerPublicState,
  type SoccerReferee,
  type SoccerRoomListing,
  type SoccerRoomStatus,
  type SoccerServerMessage,
  type SoccerTackleEvent,
  type SoccerTeam,
  type SoccerTeamSize,
} from "../shared/soccerTypes";
import { type BotMemory, createBot, stepBotAI } from "./soccer/bots";
import { resolveTackle } from "./soccer/fouls";
import { makeId } from "./soccer/geometry";
import { applyKick } from "./soccer/kicking";
import { resolvePlayerCollisions, stepBall, stepPlayers } from "./soccer/physics";
import { stepReferee } from "./soccer/referee";
import type { InputState } from "./soccer/types";

const EMPTY_BALL = (): SoccerBall => ({
  x: SOCCER_FIELD_W / 2,
  y: SOCCER_FIELD_H / 2,
  vx: 0,
  vy: 0,
  controllerId: null,
  touchImmuneIds: [],
  touchCooldownUntil: 0,
  lastToucherId: null,
});

// Starts just off the halfway line, roughly where a real referee lines up
// for kickoff — stepReferee takes over from there, trailing the ball.
const START_REFEREE = (): SoccerReferee => ({ x: SOCCER_FIELD_W / 2, y: SOCCER_FIELD_H / 2 - 60, angle: Math.PI / 2, moving: false });

export default class SoccerRoom implements Party.Server {
  players = new Map<string, SoccerPlayer>();
  inputs = new Map<string, InputState>();
  ball: SoccerBall = EMPTY_BALL();
  referee: SoccerReferee = START_REFEREE();
  hostId: string | null = null;
  status: SoccerRoomStatus = "lobby";
  teamSize: SoccerTeamSize = 2;
  botFillEnabled = false;
  botDifficulty: SoccerBotDifficulty = "basic";
  botMemory = new Map<string, BotMemory>();
  teamScores: Record<SoccerTeam, number> = { A: 0, B: 0 };
  winningTeam: SoccerTeam | null = null;
  matchEndsAt: number | null = null;
  kickoffUntil: number | null = null;
  goalEvents: SoccerGoalEvent[] = [];
  cardEvents: SoccerCardEvent[] = [];
  tackleEvents: SoccerTackleEvent[] = [];
  freeKickEvents: SoccerFreeKickEvent[] = [];
  kickEvents: SoccerKickEvent[] = [];

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
    // A human who stayed gone past the grace window is removed outright. Left
    // in the roster, their record kept being drawn (and could even be
    // tackled for a foul) as a phantom standing at the kickoff spot — most
    // often seen when one person opens the invite link in two browsers and so
    // ends up with two player ids under the same name.
    this.removePlayer(playerId);
    this.broadcastState();
    this.reportToDirectory();
  }

  private removePlayer(playerId: string) {
    this.players.delete(playerId);
    this.inputs.delete(playerId);
    if (this.ball.controllerId === playerId) this.ball.controllerId = null;
    if (this.hostId === playerId) {
      const next = [...this.players.values()].find((p) => p.connected && !p.isBot);
      this.hostId = next ? next.id : null;
    }
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
      case "set_bot_fill":
        return this.handleSetBotFill(msg.enabled, msg.difficulty, sender);
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
        goals: 0,
        shots: 0,
        tacklesWon: 0,
        isBot: false,
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

  private handleSetBotFill(enabled: boolean, difficulty: SoccerBotDifficulty, sender: Party.Connection) {
    if (this.status !== "lobby" || sender.id !== this.hostId) return;
    this.botFillEnabled = enabled;
    this.botDifficulty = difficulty;
    this.broadcastState();
  }

  /** Fills whatever's short of `teamSize` on each side with bots — called
   * right before kickoffFormation in handleStartGame, once real-player
   * validation has already passed. Spawn positions don't matter much (the
   * very next kickoffFormation call repositions everyone into the kickoff
   * line anyway); center-ish is just a harmless placeholder, same reasoning
   * as a human's spawn point in handleJoin. */
  private fillWithBots() {
    for (const team of ["A", "B"] as const) {
      let i = 0;
      while (this.teamCount(team) < this.teamSize) {
        i += 1;
        const id = `bot-${team}-${i}`;
        const bot = createBot(id, `🤖 Bot ${i}`, team, this.botDifficulty, SOCCER_FIELD_W / 2, SOCCER_FIELD_H / 2);
        this.players.set(id, bot);
      }
    }
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
    this.ball = EMPTY_BALL();
    this.referee = START_REFEREE();
    this.kickoffUntil = Date.now() + SOCCER_KICKOFF_FREEZE_MS;
  }

  private handleStartGame(sender: Party.Connection) {
    if (sender.id !== this.hostId || this.status === "playing") return;
    const aCount = this.teamCount("A");
    const bCount = this.teamCount("B");
    if (!this.botFillEnabled) {
      if (aCount !== this.teamSize || bCount !== this.teamSize) {
        sender.send(
          JSON.stringify({
            type: "error",
            message: `Mỗi đội cần đúng ${this.teamSize} người để bắt đầu (${this.teamSize} vs ${this.teamSize}).`,
          } satisfies SoccerServerMessage)
        );
        return;
      }
    } else if (aCount === 0 && bCount === 0) {
      sender.send(
        JSON.stringify({ type: "error", message: "Cần ít nhất 1 người chơi thật để bắt đầu." } satisfies SoccerServerMessage)
      );
      return;
    }
    // Drop anyone still marked disconnected before the roster is frozen for
    // the match (their grace timer may simply not have fired yet).
    for (const [id, p] of [...this.players]) if (!p.connected && !p.isBot) this.removePlayer(id);
    if (this.botFillEnabled) this.fillWithBots();
    for (const p of this.players.values()) {
      p.tackleCooldownUntil = p.tackleSlowUntil = 0;
      p.tackleDashUntil = null;
      p.boostEnergy = SOCCER_BOOST_MAX_ENERGY;
      p.isBoosting = false;
      p.fouls = 0;
      p.cardStatus = "none";
      p.sentOff = false;
      p.goals = 0;
      p.shots = 0;
      p.tacklesWon = 0;
    }
    this.teamScores = { A: 0, B: 0 };
    this.winningTeam = null;
    this.goalEvents = [];
    this.cardEvents = [];
    this.tackleEvents = [];
    this.kickEvents = [];
    this.freeKickEvents = [];
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
    // Bots are spawned fresh per match (see fillWithBots) — clear them back
    // out so the lobby shows only real players, and the host can freely
    // re-pick team size/bot difficulty for the next one.
    for (const [id, p] of this.players) {
      if (p.isBot) {
        this.players.delete(id);
        this.botMemory.delete(id);
      }
    }
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
    const speed = SOCCER_KICK_MIN_SPEED + (SOCCER_KICK_MAX_SPEED - SOCCER_KICK_MIN_SPEED) * t;
    applyKick(this, player, speed, Date.now());
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
    resolveTackle(this, tackler, now, (team) => this.checkForfeit(team));
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
    this.saveGameHistory();
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
      this.saveGameHistory();
      return;
    }

    if (this.kickoffUntil !== null && now >= this.kickoffUntil) this.kickoffUntil = null;
    if (!this.isFrozen()) {
      // Bots decide their movement/kicks/tackles first, writing into
      // `this.inputs` exactly like a real "input" message would — so
      // stepPlayers right after treats a bot no differently from a human.
      stepBotAI(this, now, (team) => this.checkForfeit(team));
      stepPlayers(this, now);
      stepReferee(this);
      resolvePlayerCollisions(this);
      stepBall(this);
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
    this.kickEvents = [];
    this.freeKickEvents = [];
  }

  /** Attributes a goal to whoever last touched the ball (see
   * SoccerBall.lastToucherId's doc) and pushes the scoreboard toast event —
   * shared between both goal directions below. An own goal still counts for
   * the scoring team but isn't credited to the scorer as a "goal" stat,
   * same convention as a real match. */
  private recordGoal(scoringTeam: SoccerTeam) {
    this.teamScores[scoringTeam] += 1;
    const scorer = this.ball.lastToucherId ? this.players.get(this.ball.lastToucherId) : null;
    const ownGoal = !!scorer && scorer.team !== scoringTeam;
    if (scorer && !ownGoal) scorer.goals += 1;
    this.goalEvents.push({
      id: makeId(),
      scoringTeam,
      scoreA: this.teamScores.A,
      scoreB: this.teamScores.B,
      scorerId: scorer?.id ?? null,
      scorerName: scorer?.name ?? null,
      ownGoal,
    });
    this.kickoffFormation();
  }

  private checkGoal() {
    const ball = this.ball;
    const inGoalMouth = ball.y >= SOCCER_GOAL_TOP && ball.y <= SOCCER_GOAL_BOTTOM;
    if (!inGoalMouth) return;
    if (ball.x - SOCCER_BALL_RADIUS <= 0) this.recordGoal("B");
    else if (ball.x + SOCCER_BALL_RADIUS >= SOCCER_FIELD_W) this.recordGoal("A");
  }

  // ---------- state ----------

  private publicState(): SoccerPublicState {
    return {
      roomId: this.party.id,
      status: this.status,
      hostId: this.hostId,
      teamSize: this.teamSize,
      botFillEnabled: this.botFillEnabled,
      botDifficulty: this.botDifficulty,
      players: [...this.players.values()],
      referee: this.referee,
      ball: this.ball,
      teamScores: this.teamScores,
      matchEndsAt: this.matchEndsAt,
      winningTeam: this.winningTeam,
      kickoffUntil: this.kickoffUntil,
      goalEvents: this.goalEvents,
      cardEvents: this.cardEvents,
      tackleEvents: this.tackleEvents,
      freeKickEvents: this.freeKickEvents,
      kickEvents: this.kickEvents,
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

  /** Reports a finished match to the shared game-history collection — same
   * fire-and-forget pattern as party/server.ts's drawing game / tank's
   * saveGameHistory. Called from both ways a match can end: the clock
   * running out (tick()) and a forfeit (checkForfeit()). */
  private async saveGameHistory() {
    try {
      const base = this.party.env.NEXT_APP_URL as string | undefined;
      if (!base) return;
      const players = [...this.players.values()];
      await fetch(`${base.replace(/\/$/, "")}/api/game-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "soccer",
          roomId: this.party.id,
          players: players.map((p) => ({ name: p.name, score: p.goals })),
          mode: `${this.teamSize}v${this.teamSize}`,
          winningTeam: this.winningTeam,
          teamScores: this.teamScores,
          detail: players.map((p) => ({
            name: p.name,
            team: p.team,
            goals: p.goals,
            shots: p.shots,
            tacklesWon: p.tacklesWon,
            fouls: p.fouls,
            cardStatus: p.cardStatus,
          })),
          playedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // Best-effort only — history persistence must never break the game loop.
    }
  }
}
