import type * as Party from "partykit/server";
import {
  DEFAULT_ROOM_CONFIG,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  POST_ROUND_SECONDS,
  WORD_CHOICE_SECONDS,
  type ChatEntry,
  type ClientMessage,
  type Player,
  type PublicRoomState,
  type RoomConfig,
  type RoomStatus,
  type ServerMessage,
  type StrokeSegment,
} from "../shared/types";
import { getWordsForIds } from "../shared/wordlists";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeGuess(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function wordHint(word: string): string {
  return word.replace(/\S/g, "_");
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default class GameRoom implements Party.Server {
  players = new Map<string, Player>();
  hostId: string | null = null;
  status: RoomStatus = "lobby";
  config: RoomConfig = { ...DEFAULT_ROOM_CONFIG };

  wordPool: string[] = [];
  usedWords = new Set<string>();

  turnOrder: string[] = [];
  turnIndex = -1; // increments once per turn; drawer = turnOrder[turnIndex % turnOrder.length]
  totalTurns = 0;

  drawerId: string | null = null;
  word: string | null = null;
  wordChoices: string[] = [];

  turnEndsAt: number | null = null; // when the drawing phase ends
  phaseEndsAt: number | null = null; // when choosing/roundEnd/gameEnd auto-advances

  strokes: StrokeSegment[] = [];
  chatLog: ChatEntry[] = [];
  turnScoreDelta = new Map<string, number>();

  tickHandle: ReturnType<typeof setInterval> | null = null;

  constructor(readonly party: Party.Party) {}

  // ---------- connection lifecycle ----------

  onConnect(connection: Party.Connection) {
    // Player is registered on the "join" message so we know their name.
    connection.send(JSON.stringify(this.stateMessage()));
  }

  onClose(connection: Party.Connection) {
    const player = this.players.get(connection.id);
    if (!player) return;
    player.connected = false;
    this.systemMessage(`${player.name} đã rời phòng.`);

    if (this.status !== "lobby" && this.status !== "gameEnd" && this.drawerId === player.id) {
      this.systemMessage(`${player.name} (người vẽ) đã rời phòng, chuyển lượt.`);
      this.endTurn();
    }

    if (this.hostId === player.id) {
      const next = [...this.players.values()].find((p) => p.connected && p.id !== player.id);
      this.hostId = next ? next.id : null;
      if (next) next.isHost = true;
    }

    this.broadcastState();
  }

  onMessage(message: string, sender: Party.Connection) {
    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }
    try {
      this.handleMessage(parsed, sender);
    } catch (err) {
      sender.send(JSON.stringify({ type: "error", message: String(err instanceof Error ? err.message : err) } satisfies ServerMessage));
    }
  }

  // ---------- message handling ----------

  private handleMessage(msg: ClientMessage, sender: Party.Connection) {
    switch (msg.type) {
      case "join":
        return this.handleJoin(msg.playerId, msg.name, sender);
      case "start_game":
        return this.handleStartGame(msg.config, sender);
      case "choose_word":
        return this.handleChooseWord(msg.word, sender);
      case "stroke":
        return this.handleStroke(msg.segment, sender);
      case "stroke_point":
        return this.handleStrokePoint(msg.strokeId, msg.point, sender);
      case "stroke_end":
        return this.handleStrokeEnd(msg.strokeId, sender);
      case "clear_canvas":
        return this.handleClearCanvas(sender);
      case "chat":
        return this.handleChat(msg.text, sender);
      case "play_again":
        return this.handlePlayAgain(sender);
      case "kick_player":
        return this.handleKickPlayer(msg.playerId, sender);
      case "leave_room":
        return this.handleLeaveRoom(sender);
    }
  }

  private handleJoin(playerId: string, name: string, sender: Party.Connection) {
    const cleanName = name.trim().slice(0, 20) || "Người chơi";
    let player = this.players.get(playerId);

    if (!player) {
      if (this.players.size >= MAX_PLAYERS) {
        sender.send(JSON.stringify({ type: "error", message: "Phòng đã đầy (tối đa 8 người)." } satisfies ServerMessage));
        return;
      }
      player = {
        id: playerId,
        name: cleanName,
        score: 0,
        connected: true,
        hasGuessedCorrectly: false,
        isHost: this.players.size === 0,
      };
      this.players.set(playerId, player);
      if (player.isHost) this.hostId = playerId;
      this.systemMessage(`${cleanName} đã vào phòng.`);
    } else {
      player.connected = true;
      player.name = cleanName;
      this.systemMessage(`${cleanName} đã kết nối lại.`);
    }

    if (!this.hostId || !this.players.get(this.hostId)?.connected) {
      this.hostId = playerId;
      player.isHost = true;
    }

    // Resend private info to the reconnecting/joining player.
    sender.send(JSON.stringify(this.stateMessage()));
    if (this.drawerId === playerId && this.word) {
      sender.send(JSON.stringify({ type: "your_word", word: this.word } satisfies ServerMessage));
    }
    for (const s of this.strokes) {
      sender.send(JSON.stringify({ type: "stroke", segment: s } satisfies ServerMessage));
    }
    this.broadcastState();
  }

  private handleStartGame(config: RoomConfig, sender: Party.Connection) {
    if (sender.id !== this.hostId) return;
    if (this.status !== "lobby" && this.status !== "gameEnd") return;
    const connected = [...this.players.values()].filter((p) => p.connected);
    if (connected.length < MIN_PLAYERS_TO_START) {
      sender.send(JSON.stringify({ type: "error", message: `Cần ít nhất ${MIN_PLAYERS_TO_START} người chơi để bắt đầu.` } satisfies ServerMessage));
      return;
    }

    this.config = {
      rounds: Math.min(Math.max(1, Math.round(config.rounds) || 1), 10),
      drawSeconds: Math.min(Math.max(30, Math.round(config.drawSeconds) || 80), 240),
      wordlistIds: config.wordlistIds?.length ? config.wordlistIds : ["vi-default"],
      customWords: (config.customWords || []).map((w) => w.trim()).filter(Boolean),
    };

    this.wordPool = [...getWordsForIds(this.config.wordlistIds), ...this.config.customWords];
    if (this.wordPool.length < 3) {
      sender.send(JSON.stringify({ type: "error", message: "Cần ít nhất 3 từ trong bộ từ vựng đã chọn." } satisfies ServerMessage));
      return;
    }
    this.usedWords.clear();

    for (const p of this.players.values()) {
      p.score = 0;
      p.hasGuessedCorrectly = false;
    }

    this.turnOrder = shuffle(connected.map((p) => p.id));
    this.turnIndex = -1;
    this.totalTurns = this.turnOrder.length * this.config.rounds;

    this.chatLog = [];
    this.systemMessage("Ván chơi bắt đầu!");
    this.startNextTurn();
    this.ensureTicking();
  }

  private handleChooseWord(word: string, sender: Party.Connection) {
    if (this.status !== "choosing" || sender.id !== this.drawerId) return;
    if (!this.wordChoices.includes(word)) return;
    this.beginDrawingPhase(word);
  }

  private handleStroke(segment: StrokeSegment, sender: Party.Connection) {
    if (this.status !== "playing" || sender.id !== this.drawerId) return;
    this.strokes.push(segment);
    this.broadcast({ type: "stroke", segment }, [sender.id]);
  }

  private handleStrokePoint(strokeId: string, point: { x: number; y: number }, sender: Party.Connection) {
    if (this.status !== "playing" || sender.id !== this.drawerId) return;
    const seg = this.strokes.find((s) => s.strokeId === strokeId);
    if (seg) seg.points.push(point);
    this.broadcast({ type: "stroke_point", strokeId, point }, [sender.id]);
  }

  private handleStrokeEnd(strokeId: string, sender: Party.Connection) {
    if (this.status !== "playing" || sender.id !== this.drawerId) return;
    this.broadcast({ type: "stroke_end", strokeId }, [sender.id]);
  }

  private handleClearCanvas(sender: Party.Connection) {
    if (this.status !== "playing" || sender.id !== this.drawerId) return;
    this.strokes = [];
    this.broadcast({ type: "clear_canvas" }, [sender.id]);
  }

  private handlePlayAgain(sender: Party.Connection) {
    if (sender.id !== this.hostId) return;
    if (this.status !== "gameEnd") return;
    this.status = "lobby";
    this.drawerId = null;
    this.word = null;
    this.wordChoices = [];
    this.strokes = [];
    this.turnEndsAt = null;
    this.phaseEndsAt = null;
    this.broadcastState();
  }

  private handleKickPlayer(targetId: string, sender: Party.Connection) {
    if (sender.id !== this.hostId || targetId === sender.id) return;
    const target = this.players.get(targetId);
    if (!target) return;

    const targetConn = [...this.party.getConnections()].find((c) => c.id === targetId);
    if (targetConn) {
      targetConn.send(JSON.stringify({ type: "kicked" } satisfies ServerMessage));
      targetConn.close();
    }
    this.players.delete(targetId);
    this.systemMessage(`${target.name} đã bị chủ phòng mời ra khỏi phòng.`);

    if (this.status !== "lobby" && this.status !== "gameEnd" && this.drawerId === targetId) {
      this.endTurn();
    }
    this.broadcastState();
  }

  private handleLeaveRoom(sender: Party.Connection) {
    const player = this.players.get(sender.id);
    if (!player) return;

    this.players.delete(sender.id);
    this.systemMessage(`${player.name} đã rời phòng.`);

    if (this.hostId === sender.id) {
      const next = [...this.players.values()].find((p) => p.connected);
      this.hostId = next ? next.id : null;
      if (next) next.isHost = true;
    }
    if (this.status !== "lobby" && this.status !== "gameEnd" && this.drawerId === sender.id) {
      this.endTurn();
    }
    this.broadcastState();
    sender.close();
  }

  private handleChat(text: string, sender: Party.Connection) {
    const player = this.players.get(sender.id);
    if (!player) return;
    const trimmed = text.trim().slice(0, 200);
    if (!trimmed) return;

    const isDrawer = sender.id === this.drawerId;
    const isGuessingPhase = this.status === "playing" && !isDrawer && !player.hasGuessedCorrectly;

    if (isGuessingPhase && this.word && normalizeGuess(trimmed) === normalizeGuess(this.word)) {
      this.awardCorrectGuess(player);
      return;
    }

    // Players who already guessed correctly (or the drawer) chatting during
    // an active round could leak the answer — only show that message to
    // people who already know the word.
    if (this.status === "playing" && (isDrawer || player.hasGuessedCorrectly)) {
      const entry: ChatEntry = { id: makeId(), type: "chat", playerId: player.id, name: player.name, text: trimmed, ts: Date.now() };
      for (const conn of this.party.getConnections()) {
        const p = this.players.get(conn.id);
        if (p && (p.id === this.drawerId || p.hasGuessedCorrectly)) {
          conn.send(JSON.stringify({ type: "chat_message", entry } satisfies ServerMessage));
        }
      }
      return;
    }

    const entry: ChatEntry = { id: makeId(), type: "chat", playerId: player.id, name: player.name, text: trimmed, ts: Date.now() };
    this.broadcast({ type: "chat_message", entry });
  }

  // ---------- game flow ----------

  private startNextTurn() {
    this.turnIndex++;
    if (this.turnIndex >= this.totalTurns) {
      this.endGame();
      return;
    }

    for (const p of this.players.values()) p.hasGuessedCorrectly = false;
    this.strokes = [];
    this.word = null;
    this.turnScoreDelta.clear();
    this.broadcast({ type: "clear_canvas" });

    const candidateOrder = [...this.turnOrder.slice(this.turnIndex % this.turnOrder.length), ...this.turnOrder];
    const drawer = candidateOrder.find((id) => this.players.get(id)?.connected) ?? this.turnOrder[this.turnIndex % this.turnOrder.length];
    this.drawerId = drawer;

    const pool = this.wordPool.filter((w) => !this.usedWords.has(w));
    const source = pool.length >= 3 ? pool : this.wordPool;
    this.wordChoices = shuffle(source).slice(0, 3);

    this.status = "choosing";
    this.phaseEndsAt = Date.now() + WORD_CHOICE_SECONDS * 1000;
    this.turnEndsAt = null;

    const drawerConn = [...this.party.getConnections()].find((c) => c.id === this.drawerId);
    if (drawerConn) {
      drawerConn.send(JSON.stringify({ type: "word_choices", choices: this.wordChoices, deadline: this.phaseEndsAt } satisfies ServerMessage));
    }
    this.systemMessage(`${this.players.get(this.drawerId)?.name ?? "?"} đang chọn từ để vẽ...`);
    this.broadcastState();
  }

  private beginDrawingPhase(word: string) {
    this.word = word;
    this.usedWords.add(word);
    this.status = "playing";
    this.turnEndsAt = Date.now() + this.config.drawSeconds * 1000;
    this.phaseEndsAt = null;
    this.broadcastState();
    const drawer = this.players.get(this.drawerId!);
    if (drawer) {
      const conn = [...this.party.getConnections()].find((c) => c.id === drawer.id);
      conn?.send(JSON.stringify({ type: "your_word", word } satisfies ServerMessage));
    }
  }

  private awardCorrectGuess(player: Player) {
    player.hasGuessedCorrectly = true;
    const total = this.config.drawSeconds * 1000;
    const remaining = Math.max(0, (this.turnEndsAt ?? Date.now()) - Date.now());
    const ratio = total > 0 ? remaining / total : 0;
    const points = Math.max(10, Math.round(100 * ratio));
    player.score += points;
    this.turnScoreDelta.set(player.id, (this.turnScoreDelta.get(player.id) ?? 0) + points);

    const drawer = this.drawerId ? this.players.get(this.drawerId) : null;
    if (drawer) {
      const drawerBonus = Math.max(5, Math.round(points / 4));
      drawer.score += drawerBonus;
      this.turnScoreDelta.set(drawer.id, (this.turnScoreDelta.get(drawer.id) ?? 0) + drawerBonus);
    }

    const entry: ChatEntry = { id: makeId(), type: "correct", playerId: player.id, name: player.name, ts: Date.now() };
    this.chatLog.push(entry);
    this.broadcast({ type: "chat_message", entry });
    // Let the guesser (and anyone else who already knows the word) see what they typed.
    for (const conn of this.party.getConnections()) {
      const p = this.players.get(conn.id);
      if (p && (p.id === player.id || p.id === this.drawerId || p.hasGuessedCorrectly)) {
        const confirm: ChatEntry = { id: makeId(), type: "chat", playerId: player.id, name: player.name, text: this.word ?? "", ts: Date.now() };
        conn.send(JSON.stringify({ type: "chat_message", entry: confirm } satisfies ServerMessage));
      }
    }

    this.broadcastState();

    const everyoneGuessed = [...this.players.values()]
      .filter((p) => p.connected && p.id !== this.drawerId)
      .every((p) => p.hasGuessedCorrectly);
    if (everyoneGuessed) this.endTurn();
  }

  private endTurn() {
    if (this.status !== "playing" && this.status !== "choosing") return;
    const word = this.word;
    this.status = "roundEnd";
    this.turnEndsAt = null;
    this.phaseEndsAt = Date.now() + POST_ROUND_SECONDS * 1000;

    if (word) {
      this.systemMessage(`Đáp án là: ${word}`);
      this.broadcast({
        type: "round_result",
        word,
        scores: [...this.turnScoreDelta.entries()].map(([playerId, delta]) => ({ playerId, delta })),
      });
    }
    this.broadcastState();
  }

  private endGame() {
    this.status = "gameEnd";
    this.drawerId = null;
    this.word = null;
    this.wordChoices = [];
    this.turnEndsAt = null;
    this.phaseEndsAt = null;
    this.systemMessage("Ván chơi kết thúc! Cảm ơn mọi người đã chơi.");
    this.broadcast({ type: "game_result", players: [...this.players.values()].sort((a, b) => b.score - a.score) });
    this.broadcastState();
    this.saveGameHistory();
  }

  private async saveGameHistory() {
    try {
      const base = this.party.env.NEXT_APP_URL as string | undefined;
      if (!base) return;
      await fetch(`${base.replace(/\/$/, "")}/api/game-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: this.party.id,
          players: [...this.players.values()].map((p) => ({ name: p.name, score: p.score })),
          rounds: this.config.rounds,
          playedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // Best-effort only — history persistence must never break the game loop.
    }
  }

  private systemMessage(text: string) {
    const entry: ChatEntry = { id: makeId(), type: "system", text, ts: Date.now() };
    this.chatLog.push(entry);
    this.broadcast({ type: "chat_message", entry });
  }

  // ---------- ticking ----------

  private ensureTicking() {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this.tick(), 1000);
  }

  private stopTicking() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private tick() {
    const anyConnected = [...this.players.values()].some((p) => p.connected);
    if (!anyConnected && this.status !== "lobby") {
      this.stopTicking();
      return;
    }

    const now = Date.now();
    if (this.status === "choosing" && this.phaseEndsAt && now >= this.phaseEndsAt) {
      const fallback = this.wordChoices[0];
      if (fallback) this.beginDrawingPhase(fallback);
      return;
    }
    if (this.status === "playing" && this.turnEndsAt && now >= this.turnEndsAt) {
      this.endTurn();
      return;
    }
    if (this.status === "roundEnd" && this.phaseEndsAt && now >= this.phaseEndsAt) {
      this.startNextTurn();
      return;
    }
    if (this.status === "gameEnd" || this.status === "lobby") {
      this.stopTicking();
    }
  }

  // ---------- state broadcasting ----------

  private stateMessage(): ServerMessage {
    return { type: "state", state: this.publicState() };
  }

  private publicState(): PublicRoomState {
    return {
      roomId: this.party.id,
      status: this.status,
      players: [...this.players.values()],
      hostId: this.hostId,
      config: this.config,
      drawerId: this.drawerId,
      wordLength: this.word ? this.word.length : null,
      wordHint: this.word ? wordHint(this.word) : null,
      revealedWord: this.status === "roundEnd" || this.status === "gameEnd" ? this.word : null,
      round: Math.max(0, this.turnIndex) + (this.status === "lobby" ? 0 : 1),
      totalTurns: this.totalTurns,
      turnEndsAt: this.turnEndsAt,
      phaseEndsAt: this.phaseEndsAt,
      strokes: this.strokes,
    };
  }

  private broadcastState() {
    this.broadcast(this.stateMessage());
  }

  private broadcast(message: ServerMessage, exclude: string[] = []) {
    this.party.broadcast(JSON.stringify(message), exclude);
  }
}
