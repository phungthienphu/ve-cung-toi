// The brawler's room server — currently covers only the pre-game flow (join,
// character/weapon/headgear/team selection, host controls) and reports into
// the lobby the same way tank-server.ts's rooms do. Deliberately stops at
// `status: "playing"` with no tick loop / physics / combat resolution yet —
// see the ongoing design discussion (real-time platformer combat is the one
// genuinely hard part of this project) for why that's being built as its own
// follow-up rather than guessed at here. This file exists so the character
// →weapon→headgear→team→"start" flow can be built and tested end-to-end
// against a real server before any of that lands.

import type * as Party from "partykit/server";
import {
  BRAWLER_CHARACTERS,
  BRAWLER_HEADGEAR_OPTIONS,
  BRAWLER_WEAPONS,
  MAX_BRAWLER_PLAYERS,
  type BrawlerCharacter,
  type BrawlerClientMessage,
  type BrawlerHeadgear,
  type BrawlerPlayer,
  type BrawlerPublicState,
  type BrawlerRoomMode,
  type BrawlerRoomStatus,
  type BrawlerServerMessage,
  type BrawlerTeam,
  type BrawlerWeapon,
} from "../shared/brawlerTypes";

function isValidCharacter(v: string): v is BrawlerCharacter {
  return (BRAWLER_CHARACTERS as readonly string[]).includes(v);
}
function isValidWeapon(v: string): v is BrawlerWeapon {
  return (BRAWLER_WEAPONS as readonly string[]).includes(v);
}
function isValidHeadgear(v: string): v is BrawlerHeadgear {
  return (BRAWLER_HEADGEAR_OPTIONS as readonly string[]).includes(v);
}

export default class BrawlerRoom implements Party.Server {
  players = new Map<string, BrawlerPlayer>();
  hostId: string | null = null;
  status: BrawlerRoomStatus = "lobby";
  mode: BrawlerRoomMode = "ffa";

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

    const existing = this.disconnectTimers.get(player.id);
    if (existing) clearTimeout(existing);
    this.disconnectTimers.set(
      player.id,
      setTimeout(() => this.finalizeDisconnect(player.id), BrawlerRoom.DISCONNECT_GRACE_MS)
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
    let msg: BrawlerClientMessage;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    switch (msg.type) {
      case "join":
        return this.handleJoin(msg.playerId, msg.name, sender);
      case "choose_character":
        return this.handleChooseCharacter(msg.character, sender);
      case "choose_weapon":
        return this.handleChooseWeapon(msg.weapon, sender);
      case "choose_headgear":
        return this.handleChooseHeadgear(msg.headgear, sender);
      case "choose_team":
        return this.handleChooseTeam(msg.team, sender);
      case "set_mode":
        return this.handleSetMode(msg.mode, sender);
      case "start_game":
        return this.handleStartGame(sender);
      case "play_again":
        return this.handlePlayAgain(sender);
      case "leave_room":
        return this.handleLeaveRoom(sender);
    }
  }

  private leastFilledTeam(): BrawlerTeam {
    let a = 0;
    let b = 0;
    for (const p of this.players.values()) {
      if (p.team === "A") a += 1;
      else b += 1;
    }
    return a <= b ? "A" : "B";
  }

  private handleJoin(playerId: string, name: string, sender: Party.Connection) {
    const cleanName = name.trim().slice(0, 20) || "Người chơi";
    let player = this.players.get(playerId);

    if (!player) {
      if (this.players.size >= MAX_BRAWLER_PLAYERS) {
        sender.send(
          JSON.stringify({ type: "error", message: `Phòng đã đầy (tối đa ${MAX_BRAWLER_PLAYERS} người).` } satisfies BrawlerServerMessage)
        );
        return;
      }
      player = {
        id: playerId,
        name: cleanName,
        character: null,
        weapon: null,
        headgear: "none",
        team: this.leastFilledTeam(),
        isHost: this.players.size === 0,
        connected: true,
        ready: false,
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
    }

    if (!this.hostId || !this.players.get(this.hostId)?.connected) {
      this.hostId = playerId;
      player.isHost = true;
    }

    sender.send(JSON.stringify(this.stateMessage()));
    this.broadcastState();
  }

  private handleChooseCharacter(character: string, sender: Party.Connection) {
    if (this.status !== "lobby" || !isValidCharacter(character)) return;
    const player = this.players.get(sender.id);
    if (!player) return;
    player.character = character;
    player.ready = player.character !== null && player.weapon !== null;
    this.broadcastState();
  }

  private handleChooseWeapon(weapon: string, sender: Party.Connection) {
    if (this.status !== "lobby" || !isValidWeapon(weapon)) return;
    const player = this.players.get(sender.id);
    if (!player) return;
    player.weapon = weapon;
    player.ready = player.character !== null && player.weapon !== null;
    this.broadcastState();
  }

  private handleChooseHeadgear(headgear: string, sender: Party.Connection) {
    if (this.status !== "lobby" || !isValidHeadgear(headgear)) return;
    const player = this.players.get(sender.id);
    if (!player) return;
    player.headgear = headgear;
    this.broadcastState();
  }

  private handleChooseTeam(team: BrawlerTeam, sender: Party.Connection) {
    if (this.status !== "lobby") return;
    const player = this.players.get(sender.id);
    if (!player) return;
    player.team = team;
    this.broadcastState();
  }

  private handleSetMode(mode: BrawlerRoomMode, sender: Party.Connection) {
    if (this.status !== "lobby" || sender.id !== this.hostId) return;
    this.mode = mode;
    this.broadcastState();
  }

  private handleStartGame(sender: Party.Connection) {
    if (sender.id !== this.hostId) return;
    if (this.status === "playing") return;
    const connected = [...this.players.values()].filter((p) => p.connected);
    if (this.mode !== "practice" && connected.length < 2) {
      sender.send(JSON.stringify({ type: "error", message: "Cần ít nhất 2 người chơi để bắt đầu." } satisfies BrawlerServerMessage));
      return;
    }
    if (connected.some((p) => !p.ready)) {
      sender.send(
        JSON.stringify({ type: "error", message: "Còn người chơi chưa chọn xong nhân vật và vũ khí." } satisfies BrawlerServerMessage)
      );
      return;
    }
    // No match simulation yet — see this file's top doc. Flipping the status
    // is enough for the client to move past the lobby UI into a placeholder
    // screen while the real tick loop gets built.
    this.status = "playing";
    this.broadcastState();
  }

  private handlePlayAgain(sender: Party.Connection) {
    if (sender.id !== this.hostId) return;
    if (this.status !== "ended" && this.status !== "playing") return;
    this.status = "lobby";
    this.broadcastState();
  }

  private handleLeaveRoom(sender: Party.Connection) {
    const player = this.players.get(sender.id);
    if (!player) return;
    this.players.delete(sender.id);
    if (this.hostId === sender.id) {
      const next = [...this.players.values()].find((p) => p.connected);
      this.hostId = next ? next.id : null;
      if (next) next.isHost = true;
    }
    this.broadcastState();
    sender.close();
  }

  private publicState(): BrawlerPublicState {
    return {
      roomId: this.party.id,
      status: this.status,
      mode: this.mode,
      hostId: this.hostId,
      players: [...this.players.values()],
    };
  }

  private stateMessage(): BrawlerServerMessage {
    return { type: "state", state: this.publicState() };
  }

  private broadcastState() {
    this.party.broadcast(JSON.stringify(this.stateMessage()));
  }
}
