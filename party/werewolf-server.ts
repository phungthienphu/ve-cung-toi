import type * as Party from "partykit/server";
import {
  DEFAULT_WEREWOLF_CONFIG,
  MAX_VOTE_REASON_LENGTH,
  MAX_WEREWOLF_PLAYERS,
  MIN_WEREWOLF_PLAYERS,
  rolesForPlayerCount,
  type PrivateWerewolfState,
  type PublicWerewolfState,
  type WerewolfClientMessage,
  type WerewolfConfig,
  type WerewolfBallot,
  type WerewolfChatEntry,
  type WerewolfGameEvent,
  type WerewolfPhase,
  type WerewolfPlayer,
  type WerewolfServerMessage,
  type SuspicionStatistic,
  type NightSuspicionResult,
  type WerewolfTeam,
} from "../shared/werewolfTypes";
import {
  createSecretPlayerState,
  PHASE_DURATION_MS,
  shuffled,
  type SecretPlayerState,
} from "./werewolf/domain";

export default class WerewolfRoom implements Party.Server {
  players = new Map<string, WerewolfPlayer>();
  secrets = new Map<string, SecretPlayerState>();
  hostId: string | null = null;
  phase: WerewolfPhase = "lobby";
  day = 0;
  config: WerewolfConfig = { ...DEFAULT_WEREWOLF_CONFIG };
  phaseEndsAt: number | null = null;
  nightDeaths: string[] = [];
  lastVoteResult: Array<{ playerId: string; votes: number }> = [];
  lastVotes: WerewolfBallot[] = [];
  resultAcks = new Set<string>();
  chat: WerewolfChatEntry[] = [];
  events: WerewolfGameEvent[] = [];
  suspicionStats: SuspicionStatistic[] = [];
  voteHistory: Array<{ day: number; results: Array<{ playerId: string; votes: number }> }> = [];
  lastNightSuspicion: NightSuspicionResult | null = null;
  lastChatAt = new Map<string, number>();
  winner: WerewolfTeam | null = null;
  wolfVictimId: string | null = null;
  timer: ReturnType<typeof setTimeout> | null = null;
  disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  matchStartedAt: number | null = null;
  historyReported = false;

  constructor(readonly party: Party.Party) {}

  onConnect(connection: Party.Connection) {
    connection.send(JSON.stringify(this.stateMessage()));
  }

  onClose(connection: Party.Connection) {
    const player = this.players.get(connection.id);
    if (!player) return;
    player.connected = false;
    this.broadcastState();
    const old = this.disconnectTimers.get(player.id);
    if (old) clearTimeout(old);
    this.disconnectTimers.set(player.id, setTimeout(() => this.finalizeDisconnect(player!.id), 30_000));
  }

  onMessage(raw: string, sender: Party.Connection) {
    let msg: WerewolfClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case "join": return this.join(msg.playerId, msg.name, sender);
      case "set_ready": return this.setReady(sender.id, msg.ready);
      case "update_config": return this.updateConfig(sender, msg.config);
      case "start_game": return this.startGame(sender);
      case "ack_role": return this.ackRole(sender.id);
      case "preview_target": return this.previewTarget(sender.id, msg.targetId);
      case "lock_target": return this.lockTarget(sender.id, msg.targetId);
      case "set_suspicion": return this.setSuspicion(sender.id, msg.targetId);
      case "witch_decision": return this.witchDecision(sender.id, msg.decision, msg.targetId);
      case "cast_vote": return this.castVote(sender.id, msg.targetId, msg.reason);
      case "chat": return this.sendChat(sender.id, msg.text);
      case "end_discussion": return this.endDiscussion(sender);
      case "ack_result": return this.ackResult(sender.id);
      case "play_again": return this.playAgain(sender);
      case "leave_room": return this.leave(sender);
    }
  }

  private sendError(conn: Party.Connection, message: string) {
    conn.send(JSON.stringify({ type: "error", message } satisfies WerewolfServerMessage));
  }

  private join(playerId: string, name: string, sender: Party.Connection) {
    if (sender.id !== playerId) return this.sendError(sender, "Phiên người chơi không hợp lệ.");
    let player = this.players.get(playerId);
    if (!player) {
      if (this.players.size >= MAX_WEREWOLF_PLAYERS) return this.sendError(sender, "Phòng đã đầy.");
      player = {
        id: playerId,
        name: name.trim().slice(0, 20) || "Người chơi",
        avatarSeed: playerId,
        connected: true,
        alive: true,
        ready: false,
        isHost: this.players.size === 0,
        revealedRole: null,
      };
      this.players.set(playerId, player);
      if (player.isHost) this.hostId = playerId;
    } else {
      player.connected = true;
      player.name = name.trim().slice(0, 20) || player.name;
      const pending = this.disconnectTimers.get(playerId);
      if (pending) clearTimeout(pending);
      this.disconnectTimers.delete(playerId);
    }
    if (!this.hostId) {
      this.hostId = playerId;
      player.isHost = true;
    }
    sender.send(JSON.stringify(this.stateMessage()));
    this.sendPrivate(playerId);
    this.broadcastState();
  }

  private finalizeDisconnect(playerId: string) {
    this.disconnectTimers.delete(playerId);
    const player = this.players.get(playerId);
    if (!player || player.connected) return;
    if (this.phase === "lobby") this.players.delete(playerId);
    if (this.hostId === playerId) {
      if (player) player.isHost = false;
      const next = [...this.players.values()].find(p => p.connected);
      this.hostId = next?.id ?? null;
      if (next) next.isHost = true;
    }
    this.broadcastState();
  }

  private setReady(id: string, ready: boolean) {
    if (this.phase !== "lobby") return;
    const player = this.players.get(id);
    if (!player) return;
    player.ready = ready;
    this.broadcastState();
  }

  private updateConfig(sender: Party.Connection, incoming: WerewolfConfig) {
    if (sender.id !== this.hostId || this.phase !== "lobby") return;
    this.config = {
      discussionSeconds: Math.min(300, Math.max(60, Math.round(incoming.discussionSeconds) || 120)),
      votingSeconds: Math.min(60, Math.max(15, Math.round(incoming.votingSeconds) || 30)),
      revealRoleOnDeath: !!incoming.revealRoleOnDeath,
      witchCanSelfSave: !!incoming.witchCanSelfSave,
    };
    this.broadcastState();
  }

  private startGame(sender: Party.Connection) {
    if (sender.id !== this.hostId || this.phase !== "lobby") return;
    const participants = [...this.players.values()].filter(p => p.connected);
    if (participants.length < MIN_WEREWOLF_PLAYERS) return this.sendError(sender, `Cần ít nhất ${MIN_WEREWOLF_PLAYERS} người.`);
    if (participants.some(p => !p.ready && p.id !== this.hostId)) return this.sendError(sender, "Mọi người cần bấm Sẵn sàng.");
    const roles = shuffled(rolesForPlayerCount(participants.length));
    this.secrets.clear();
    participants.forEach((player, index) => {
      player.alive = true;
      player.revealedRole = null;
      this.secrets.set(player.id, createSecretPlayerState(roles[index]));
    });
    this.day = 0;
    this.winner = null;
    this.nightDeaths = [];
    this.lastVoteResult = [];
    this.lastVotes = [];
    this.chat = [];
    this.events = [];
    this.suspicionStats = [];
    this.voteHistory = [];
    this.lastNightSuspicion = null;
    this.matchStartedAt = Date.now();
    this.historyReported = false;
    this.enterPhase("roleReveal", PHASE_DURATION_MS.roleReveal);
  }

  private ackRole(id: string) {
    if (this.phase !== "roleReveal") return;
    const secret = this.secrets.get(id);
    if (secret) secret.roleAcknowledged = true;
    this.sendPrivate(id);
    const living = [...this.players.values()].filter(p => p.connected);
    if (living.length > 0 && living.every(p => this.secrets.get(p.id)?.roleAcknowledged)) this.startNight();
  }

  private isLivingTarget(targetId: string) {
    return this.players.get(targetId)?.alive === true;
  }

  private previewTarget(id: string, targetId: string) {
    if (!["nightExplore", "wolfLock", "nightResolve"].includes(this.phase) || !this.isLivingTarget(targetId)) return;
    const player = this.players.get(id);
    const secret = this.secrets.get(id);
    if (!player || !secret || !player.alive || id === targetId) return;
    if (secret.role === "wolf" && this.secrets.get(targetId)?.role === "wolf") return;
    if (secret.role === "guardian" && secret.lastGuardedPlayerId === targetId) return;
    if (this.phase === "nightResolve" && secret.role === "wolf") {
      secret.suspicionTargetId = targetId;
    } else {
      secret.previewTargetId = targetId;
      if (secret.role === "villager" || secret.role === "witch") {
        secret.suspicionTargetId = targetId;
      }
    }
    this.sendPrivate(id);
    if (secret.role === "wolf" && this.phase !== "nightResolve") this.sendPrivateToLivingWolves();
  }

  private lockTarget(id: string, targetId: string) {
    if (!["wolfLock", "nightResolve"].includes(this.phase) || !this.isLivingTarget(targetId)) return;
    const secret = this.secrets.get(id);
    const player = this.players.get(id);
    if (!secret || !player?.alive || id === targetId) return;
    if (secret.role === "wolf" && this.phase !== "wolfLock") return;
    if (secret.role === "wolf" && this.secrets.get(targetId)?.role === "wolf") return;
    if (secret.role === "guardian" && secret.lastGuardedPlayerId === targetId) return;
    secret.previewTargetId = targetId;
    secret.lockedTargetId = targetId;
    this.sendPrivate(id);
    if (secret.role === "wolf") this.sendPrivateToLivingWolves();
  }

  private setSuspicion(id: string, targetId: string) {
    if (!["nightExplore", "wolfLock", "nightResolve"].includes(this.phase) || !this.isLivingTarget(targetId) || id === targetId) return;
    const secret = this.secrets.get(id);
    if (secret) {
      secret.suspicionTargetId = targetId;
      this.sendPrivate(id);
    }
  }

  private witchDecision(id: string, decision: "heal" | "poison" | "skip", targetId?: string) {
    if (this.phase !== "nightResolve") return;
    const secret = this.secrets.get(id);
    const player = this.players.get(id);
    if (!secret || secret.role !== "witch" || !player?.alive) return;
    if (decision === "heal" && (!secret.healAvailable || !this.wolfVictimId || (!this.config.witchCanSelfSave && this.wolfVictimId === id))) return;
    if (decision === "poison" && (!secret.poisonAvailable || !targetId || !this.isLivingTarget(targetId) || targetId === id)) return;
    secret.witchDecision = decision;
    secret.witchPoisonTargetId = decision === "poison" ? targetId! : null;
    this.sendPrivate(id);
  }

  private castVote(id: string, targetId: string | null, rawReason?: string) {
    if (this.phase !== "voting") return;
    const player = this.players.get(id);
    const secret = this.secrets.get(id);
    if (!player?.alive || !secret || targetId === id || (targetId && !this.isLivingTarget(targetId))) return;
    secret.voteTargetId = targetId;
    secret.voteReason = typeof rawReason === "string" ? rawReason.trim().replace(/\s+/g, " ").slice(0, MAX_VOTE_REASON_LENGTH) : "";
    this.sendPrivate(id);
    // Public progress ("n/m đã bỏ phiếu") — who has voted, never for whom.
    this.broadcastState();
  }

  private sendChat(playerId: string, rawText: string) {
    if (this.phase !== "discussion") return;
    const player = this.players.get(playerId);
    if (!player?.alive) return;

    const text = rawText.trim().replace(/\s+/g, " ").slice(0, 300);
    if (!text) return;

    const now = Date.now();
    if (now - (this.lastChatAt.get(playerId) ?? 0) < 400) return;
    this.lastChatAt.set(playerId, now);

    this.chat.push({
      id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      playerId,
      playerName: player.name,
      text,
      sentAt: now,
    });
    if (this.chat.length > 100) this.chat.splice(0, this.chat.length - 100);
    this.broadcastState();
  }

  // Everyone who's still playing can skip the vote-result read-through early;
  // disconnected players don't hold the table up (the phase timer still ends it).
  private ackResult(id: string) {
    if (this.phase !== "voteResult" || !this.players.get(id)?.alive) return;
    this.resultAcks.add(id);
    const everyoneReady = [...this.players.values()]
      .filter((player) => player.alive && player.connected)
      .every((player) => this.resultAcks.has(player.id));
    if (everyoneReady) this.startNight();
    else this.broadcastState();
  }

  private endDiscussion(sender: Party.Connection) {
    if (sender.id === this.hostId && this.phase === "discussion") this.enterPhase("voting", this.config.votingSeconds * 1000);
  }

  private startNight() {
    this.day += 1;
    this.wolfVictimId = null;
    this.nightDeaths = [];
    for (const secret of this.secrets.values()) {
      secret.previewTargetId = null;
      secret.lockedTargetId = null;
      secret.witchDecision = null;
      secret.witchPoisonTargetId = null;
      secret.voteTargetId = null;
      secret.voteReason = "";
      secret.suspicionTargetId = null;
    }
    this.enterPhase("nightExplore", PHASE_DURATION_MS.nightExplore);
  }

  private chooseWolfVictim(): string | null {
    const counts = new Map<string, number>();
    for (const [id, secret] of this.secrets) {
      if (secret.role !== "wolf" || !this.players.get(id)?.alive) continue;
      const target = secret.lockedTargetId ?? secret.previewTargetId;
      if (target && this.isLivingTarget(target) && this.secrets.get(target)?.role !== "wolf") counts.set(target, (counts.get(target) ?? 0) + 1);
    }
    if (!counts.size) return null;
    const max = Math.max(...counts.values());
    const tied = [...counts].filter(([, n]) => n === max).map(([id]) => id);
    return tied[Math.floor(Math.random() * tied.length)];
  }

  private resolveNight() {
    const guardianEntry = [...this.secrets.entries()].find(([id, s]) => s.role === "guardian" && this.players.get(id)?.alive);
    const guardianTarget = guardianEntry?.[1].lockedTargetId ?? guardianEntry?.[1].previewTargetId ?? null;
    if (guardianEntry && guardianTarget) guardianEntry[1].lastGuardedPlayerId = guardianTarget;
    const witchEntry = [...this.secrets.entries()].find(([id, s]) => s.role === "witch" && this.players.get(id)?.alive);
    const witch = witchEntry?.[1];
    const deaths = new Set<string>();

    for (const [id, secret] of this.secrets) {
      if (!this.players.get(id)?.alive || !secret.suspicionTargetId) continue;
      secret.suspicionHistory.push({ night: this.day, targetId: secret.suspicionTargetId });
    }
    this.lastNightSuspicion = this.calculateNightSuspicion(this.day);
    if (this.wolfVictimId && guardianTarget !== this.wolfVictimId && witch?.witchDecision !== "heal") deaths.add(this.wolfVictimId);
    if (witch?.witchDecision === "heal" && witch.healAvailable) witch.healAvailable = false;
    if (witch?.witchDecision === "poison" && witch.poisonAvailable && witch.witchPoisonTargetId) {
      deaths.add(witch.witchPoisonTargetId);
      witch.poisonAvailable = false;
    }
    for (const [id, secret] of this.secrets) {
      if (secret.role !== "seer" || !this.players.get(id)?.alive) continue;
      const target = secret.lockedTargetId ?? secret.previewTargetId;
      if (target && this.isLivingTarget(target)) {
        secret.seerHistory.push({
          night: this.day,
          targetId: target,
          isWolf: this.secrets.get(target)?.role === "wolf",
        });
      }
    }
    this.nightDeaths = [...deaths];
    this.events.push({
      id: `night-${this.day}`,
      day: this.day,
      type: deaths.size ? "night_death" : "peaceful_night",
      playerIds: [...deaths],
    });
    for (const id of deaths) {
      const player = this.players.get(id);
      if (!player) continue;
      player.alive = false;
      player.revealedRole = this.config.revealRoleOnDeath
        ? this.secrets.get(id)?.role ?? null
        : null;
    }
    if (this.checkWinner()) return;
    this.enterPhase("dawn", PHASE_DURATION_MS.dawn);
  }

  private resolveVotes() {
    const counts = new Map<string, number>();
    for (const [id, secret] of this.secrets) if (this.players.get(id)?.alive && secret.voteTargetId) counts.set(secret.voteTargetId, (counts.get(secret.voteTargetId) ?? 0) + 1);
    this.lastVoteResult = [...counts].map(([playerId, votes]) => ({ playerId, votes })).sort((a, b) => b.votes - a.votes);
    // Ballots become public only now that voting is closed, so nobody can
    // just bandwagon on whoever voted first.
    this.lastVotes = [...this.secrets]
      .filter(([id]) => this.players.get(id)?.alive)
      .map(([voterId, secret]) => ({
        voterId,
        targetId: secret.voteTargetId,
        reason: secret.voteTargetId ? secret.voteReason : "",
      }));
    this.voteHistory.push({
      day: this.day,
      results: this.lastVoteResult.map((result) => ({ ...result })),
    });
    if (this.lastVoteResult.length) {
      const max = this.lastVoteResult[0].votes;
      const leaders = this.lastVoteResult.filter(v => v.votes === max);
      if (leaders.length === 1) {
        const eliminated = this.players.get(leaders[0].playerId);
        if (eliminated) {
          eliminated.alive = false;
          eliminated.revealedRole = this.config.revealRoleOnDeath
            ? this.secrets.get(eliminated.id)?.role ?? null
            : null;
          this.events.push({
            id: `vote-${this.day}`,
            day: this.day,
            type: "vote_elimination",
            playerIds: [eliminated.id],
          });
        }
      }
    }
    if (this.checkWinner()) return;
    this.resultAcks.clear();
    this.enterPhase("voteResult", PHASE_DURATION_MS.voteResult);
  }

  private checkWinner(): boolean {
    let wolves = 0, village = 0;
    for (const [id, secret] of this.secrets) if (this.players.get(id)?.alive) secret.role === "wolf" ? wolves++ : village++;
    if (wolves === 0) this.winner = "village";
    else if (wolves >= village) this.winner = "wolves";
    if (!this.winner) return false;
    for (const [id, secret] of this.secrets) {
      const player = this.players.get(id);
      if (player) player.revealedRole = secret.role;
    }
    this.suspicionStats = this.calculateSuspicionStats();
    this.enterPhase("gameEnd", 0);
    void this.reportHistory();
    return true;
  }

  private onPhaseTimeout(expected: WerewolfPhase) {
    if (this.phase !== expected) return;
    if (expected === "roleReveal") this.startNight();
    else if (expected === "nightExplore") this.enterPhase("wolfLock", PHASE_DURATION_MS.wolfLock);
    else if (expected === "wolfLock") {
      this.wolfVictimId = this.chooseWolfVictim();
      this.enterPhase("nightResolve", PHASE_DURATION_MS.nightResolve);
    }
    else if (expected === "nightResolve") this.resolveNight();
    else if (expected === "dawn") this.enterPhase("discussion", this.config.discussionSeconds * 1000);
    else if (expected === "discussion") this.enterPhase("voting", this.config.votingSeconds * 1000);
    else if (expected === "voting") this.resolveVotes();
    else if (expected === "voteResult") this.startNight();
  }

  private enterPhase(phase: WerewolfPhase, durationMs: number) {
    if (this.timer) clearTimeout(this.timer);
    this.phase = phase;
    this.phaseEndsAt = durationMs > 0 ? Date.now() + durationMs : null;
    if (phase === "nightResolve") for (const id of this.secrets.keys()) this.sendPrivate(id);
    this.broadcastState();
    this.sendAllPrivate();
    if (durationMs > 0) this.timer = setTimeout(() => this.onPhaseTimeout(phase), durationMs);
  }

  private playAgain(sender: Party.Connection) {
    if (sender.id !== this.hostId || this.phase !== "gameEnd") return;
    this.phase = "lobby";
    this.day = 0;
    this.winner = null;
    this.phaseEndsAt = null;
    this.nightDeaths = [];
    this.lastVoteResult = [];
    this.chat = [];
    this.events = [];
    this.suspicionStats = [];
    this.voteHistory = [];
    this.lastNightSuspicion = null;
    this.secrets.clear();
    for (const player of this.players.values()) {
      player.alive = true;
      player.ready = false;
      player.revealedRole = null;
    }
    this.broadcastState();
    this.sendAllPrivate();
  }

  private leave(sender: Party.Connection) {
    const player = this.players.get(sender.id);
    if (!player) return;
    if (this.phase === "lobby") this.players.delete(sender.id);
    else player.connected = false;

    if (this.hostId === sender.id) {
      const next = [...this.players.values()].find((candidate) => candidate.connected);
      this.hostId = next?.id ?? null;
      if (next) next.isHost = true;
    }
    this.broadcastState();
    sender.close();
  }

  private privateState(playerId: string): PrivateWerewolfState {
    const secret = this.secrets.get(playerId);
    if (!secret) return emptyPrivateState();

    const teammates = secret.role === "wolf"
      ? [...this.secrets]
          .filter(([id, candidate]) => id !== playerId && candidate.role === "wolf")
          .map(([id]) => id)
      : [];
    const wolfChoices = secret.role === "wolf"
      ? [...this.secrets]
          .filter(([id, candidate]) => candidate.role === "wolf" && this.players.get(id)?.alive)
          .map(([wolfId, candidate]) => ({
            wolfId,
            targetId: candidate.lockedTargetId ?? candidate.previewTargetId,
            locked: candidate.lockedTargetId !== null,
          }))
      : [];

    return {
      role: secret.role,
      teammates,
      previewTargetId: secret.previewTargetId,
      lockedTargetId: secret.lockedTargetId,
      wolfChoices,
      witchVictimId: secret.role === "witch" && this.phase === "nightResolve"
        ? this.wolfVictimId
        : null,
      healAvailable: secret.healAvailable,
      poisonAvailable: secret.poisonAvailable,
      witchDecision: secret.witchDecision,
      seerHistory: secret.seerHistory,
      suspicionHistory: secret.suspicionHistory,
      lastGuardedPlayerId: secret.lastGuardedPlayerId,
      suspicionTargetId: secret.suspicionTargetId,
      voteTargetId: secret.voteTargetId,
      voteReason: secret.voteReason,
    };
  }

  private publicState(): PublicWerewolfState {
    return {
      roomId: this.party.id,
      phase: this.phase,
      day: this.day,
      hostId: this.hostId,
      players: [...this.players.values()],
      config: this.config,
      phaseEndsAt: this.phaseEndsAt,
      nightDeaths: this.nightDeaths,
      lastVoteResult: this.lastVoteResult,
      lastVotes: this.lastVotes,
      votedPlayerIds: this.phase === "voting"
        ? [...this.secrets].filter(([id, secret]) => this.players.get(id)?.alive && secret.voteTargetId).map(([id]) => id)
        : [],
      resultAckedIds: this.phase === "voteResult" ? [...this.resultAcks] : [],
      chat: this.chat,
      events: this.events,
      suspicionStats: this.suspicionStats,
      lastNightSuspicion: this.lastNightSuspicion,
      winner: this.winner,
    };
  }

  private stateMessage(): WerewolfServerMessage {
    return { type: "state", state: this.publicState() };
  }

  private broadcastState() {
    this.party.broadcast(JSON.stringify(this.stateMessage()));
  }

  private sendPrivate(id: string) {
    const connection = [...this.party.getConnections()].find((candidate) => candidate.id === id);
    if (!connection) return;
    connection.send(JSON.stringify({
      type: "private_state",
      state: this.privateState(id),
    } satisfies WerewolfServerMessage));
  }

  private sendAllPrivate() {
    for (const id of this.players.keys()) this.sendPrivate(id);
  }

  private sendPrivateToLivingWolves() {
    for (const [id, secret] of this.secrets) {
      if (secret.role === "wolf" && this.players.get(id)?.alive) this.sendPrivate(id);
    }
  }

  private async reportHistory() {
    if (this.historyReported || !this.winner) return;
    this.historyReported = true;

    try {
      const base = this.party.env.NEXT_APP_URL as string | undefined;
      if (!base) return;
      const winningRole = this.winner;
      const detail = [...this.players.values()].map((player) => {
        const role = this.secrets.get(player.id)?.role ?? "villager";
        const team = role === "wolf" ? "wolves" : "village";
        return {
          playerId: player.id,
          name: player.name,
          role,
          team,
          survived: player.alive,
          won: team === winningRole,
        };
      });

      await fetch(`${base.replace(/\/$/, "")}/api/game-history`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gameType: "werewolf",
          roomId: this.party.id,
          players: detail.map((player) => ({ name: player.name, score: player.won ? 1 : 0 })),
          mode: `${detail.length} người · ${this.day} ngày`,
          winningTeam: this.winner,
          detail: {
            players: detail,
            events: this.events,
            suspicionStats: this.suspicionStats,
            daysPlayed: this.day,
            startedAt: this.matchStartedAt,
          },
          playedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // History persistence is best-effort and must never stop the room.
    }
  }

  private calculateSuspicionStats(): SuspicionStatistic[] {
    const nightVotes = new Map<string, number>();
    const dayVotes = new Map<string, number>();

    for (const secret of this.secrets.values()) {
      for (const entry of secret.suspicionHistory) {
        nightVotes.set(entry.targetId, (nightVotes.get(entry.targetId) ?? 0) + 1);
      }
    }
    for (const round of this.voteHistory) {
      for (const result of round.results) {
        dayVotes.set(result.playerId, (dayVotes.get(result.playerId) ?? 0) + result.votes);
      }
    }

    const rows = [...this.players.keys()].map((playerId) => {
      const night = nightVotes.get(playerId) ?? 0;
      const day = dayVotes.get(playerId) ?? 0;
      return { playerId, nightVotes: night, dayVotes: day, weightedScore: night + day * 2 };
    });
    const totalScore = rows.reduce((total, row) => total + row.weightedScore, 0);
    return rows
      .map((row) => ({
        ...row,
        percentage: totalScore > 0 ? Math.round((row.weightedScore / totalScore) * 100) : 0,
      }))
      .sort((a, b) => b.weightedScore - a.weightedScore);
  }

  private calculateNightSuspicion(night: number): NightSuspicionResult {
    const counts = new Map<string, number>();
    for (const secret of this.secrets.values()) {
      const entry = secret.suspicionHistory.find((item) => item.night === night);
      if (entry) counts.set(entry.targetId, (counts.get(entry.targetId) ?? 0) + 1);
    }
    const totalVotes = [...counts.values()].reduce((total, votes) => total + votes, 0);
    const results = [...counts]
      .map(([playerId, votes]) => ({
        playerId,
        votes,
        percentage: totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0,
      }))
      .sort((a, b) => b.votes - a.votes);
    return { night, totalVotes, results };
  }
}

function emptyPrivateState(): PrivateWerewolfState {
  return {
    role: null,
    teammates: [],
    previewTargetId: null,
    lockedTargetId: null,
    wolfChoices: [],
    witchVictimId: null,
    healAvailable: true,
    poisonAvailable: true,
    witchDecision: null,
    seerHistory: [],
    suspicionHistory: [],
    lastGuardedPlayerId: null,
    suspicionTargetId: null,
    voteTargetId: null,
    voteReason: "",
  };
}
