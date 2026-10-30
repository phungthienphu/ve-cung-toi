import { Server, getServerByName, type Connection } from "partyserver";
import type { Env } from "./env";
import {
  DEAL_MS,
  DECK,
  DEFAULT_OLDMAID_CONFIG,
  DRAW_RESOLVE_MS,
  EMOTE_COOLDOWN_MS,
  JOKER,
  MAX_ROOM_PEOPLE,
  MAX_SEATS,
  MIN_PLAYERS,
  NEXT_ROUND_MS,
  OPENING_PAIRS_MS,
  RECONNECT_GRACE_MS,
  ROUNDS_TO_PLAY,
  TURN_SECONDS,
  isEmote,
  isPair,
  seatAfter,
  seatBefore,
  splitPairs,
  type Emote,
  type OldMaidChatEntry,
  type OldMaidClientMessage,
  type OldMaidConfig,
  type OldMaidEvent,
  type OldMaidHandCard,
  type OldMaidPhase,
  type OldMaidPlayer,
  type OldMaidRoomListing,
  type OldMaidRoundSummary,
  type OldMaidServerMessage,
  type OldMaidTurn,
  type PublicOldMaidState,
} from "../shared/oldMaidTypes";

// Ai Là Heo room (party "oldmaid"). The server holds every hand and decides
// everything; clients only send intentions (draw slot k, shuffle, tease).
// Other players' hands go out as card counts — a hand is a row of numbered
// slots to everyone but its owner — so the Joker can't be found from DevTools.

const BOT_NAMES = ["Heo Quay", "Ỉn Con", "Bé Lợn Lì", "Heo Mập", "Ụt Ịt", "Heo Hồng", "Lợn Lém", "Heo Mọi"];
const BOT_EMOTES: Emote[] = ["smirk", "please", "shh", "scared", "oink"];

interface PlayerState extends OldMaidPlayer {
  /** Pressed "Rời phòng" mid-round: a bot finishes the round for them, then they're gone. */
  left: boolean;
  draws: number;
  jokerDraws: number;
  lastHoverAt: number;
  lastTeaseAt: number;
  lastShuffleAt: number;
  lastEmoteAt: number;
  lastChatAt: number;
}

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const token = () => Math.random().toString(36).slice(2, 10);
const rand = (min: number, max: number) => min + Math.random() * (max - min);

function randomInt(below: number): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % below;
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const isAuto = (player: PlayerState) => player.isBot || player.standIn;

export class OldMaidRoom extends Server<Env> {
  players = new Map<string, PlayerState>();
  hands = new Map<string, OldMaidHandCard[]>();
  hostId: string | null = null;
  config: OldMaidConfig = { ...DEFAULT_OLDMAID_CONFIG };
  phase: OldMaidPhase = "lobby";
  phaseEndsAt: number | null = null;
  round = 0;
  dealerId: string | null = null;
  turn: OldMaidTurn | null = null;
  hoverSlot: number | null = null;
  teased = new Map<string, number>();
  discard: number[] = [];
  finishOrder: string[] = [];
  pigId: string | null = null;
  lastRound: OldMaidRoundSummary | null = null;
  nextReady = new Set<string>();
  chat: OldMaidChatEntry[] = [];
  /** Deal → pairs → play, draw → next turn, round end → next round. */
  flowTimers = new Set<ReturnType<typeof setTimeout>>();
  botTimers = new Set<ReturnType<typeof setTimeout>>();
  turnTimer: ReturnType<typeof setTimeout> | null = null;
  disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  lastListingKey = "";

  // ---------- connection ----------

  onConnect(connection: Connection) {
    connection.send(JSON.stringify(this.stateMessage()));
  }

  onClose(connection: Connection) {
    const player = this.players.get(connection.id);
    if (!player) return;
    // A refresh opens the new socket before the old one closes — not a leave.
    if ([...this.getConnections()].some((other) => other.id === connection.id)) return;
    player.connected = false;
    player.disconnectedUntil = Date.now() + RECONNECT_GRACE_MS;
    const old = this.disconnectTimers.get(player.id);
    if (old) clearTimeout(old);
    this.disconnectTimers.set(player.id, setTimeout(() => this.finalizeDisconnect(player.id), RECONNECT_GRACE_MS));
    if (this.hostId === player.id) this.transferHost(player.id);
    this.broadcastState();
  }

  onMessage(sender: Connection, raw: string) {
    let msg: OldMaidClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case "join": return this.join(msg.playerId, msg.name, sender);
      case "take_seat": return this.takeSeat(sender.id, msg.seat);
      case "set_ready": return this.setReady(sender.id, msg.ready);
      case "update_config": return this.updateConfig(sender, msg.config);
      case "add_bot": return this.addBot(sender, msg.seat);
      case "remove_bot": return this.removeBot(sender, msg.playerId);
      case "start_game": return this.startGame(sender);
      case "quick_start": return this.quickStart(sender, msg.bots);
      case "hover": return this.hover(sender.id, msg.slot);
      case "draw": return this.draw(sender.id, msg.slot, false);
      case "shuffle_hand": return this.shuffleHand(sender.id);
      case "reorder": return this.reorder(sender.id, msg.order);
      case "tease": return this.tease(sender.id, msg.slot);
      case "emote": return this.emote(sender.id, msg.emote);
      case "chat": return this.sendChat(sender.id, msg.text);
      case "next_round": return this.nextRound(sender.id);
      case "back_to_lobby": return this.backToLobby(sender);
      case "new_set": return this.newSet(sender);
      case "leave_room": return this.leave(sender);
    }
  }

  private join(playerId: string, rawName: string, sender: Connection) {
    if (sender.id !== playerId) return this.sendError(sender, "Phiên người chơi không hợp lệ.");
    const name = String(rawName ?? "").trim().replace(/\s+/g, " ").slice(0, 20) || "Người chơi";
    let player = this.players.get(playerId);
    if (player) {
      // Back from a refresh or a dropped connection: take the seat (and the hand) back from any stand-in bot.
      const pending = this.disconnectTimers.get(playerId);
      if (pending) clearTimeout(pending);
      this.disconnectTimers.delete(playerId);
      const wasStandIn = player.standIn;
      player.connected = true;
      player.disconnectedUntil = null;
      player.standIn = false;
      player.left = false;
      player.name = name;
      if (wasStandIn) {
        this.systemChat(`${name} đã quay lại bàn 🐷`);
        // The bot may have been mid-thought on this player's turn; the turn timer still runs.
        if (this.turn && (this.turn.drawerId === playerId || this.turn.targetId === playerId)) this.clearBotTimers();
      }
    } else {
      if (this.players.size >= MAX_ROOM_PEOPLE) return this.sendError(sender, "Phòng đông quá rồi, thử phòng khác nhé.");
      const seat = this.phase === "lobby" ? this.freeSeat() : null;
      player = this.newPlayer(playerId, name, seat, false);
      this.players.set(playerId, player);
      if (seat === null && this.phase === "lobby") this.sendError(sender, "Bàn đã đủ 6 người — bạn đang xem, có ghế trống là ngồi được.");
      else if (seat === null) this.sendError(sender, "Ván đang chơi — bạn xem trước, ván sau sẽ được ngồi vào bàn.");
      this.systemChat(`${name} đã vào phòng 👋`);
    }
    if (!this.hostId || !this.players.get(this.hostId)?.connected) this.hostId = playerId;
    sender.send(JSON.stringify(this.stateMessage()));
    this.sendHand(playerId);
    this.broadcastState();
  }

  private newPlayer(id: string, name: string, seat: number | null, isBot: boolean): PlayerState {
    return {
      id,
      name,
      seat,
      isBot,
      standIn: false,
      connected: !isBot,
      disconnectedUntil: null,
      ready: isBot,
      cardCount: 0,
      finishedRank: null,
      pigs: 0,
      firsts: 0,
      rounds: 0,
      left: false,
      draws: 0,
      jokerDraws: 0,
      lastHoverAt: 0,
      lastTeaseAt: 0,
      lastShuffleAt: 0,
      lastEmoteAt: 0,
      lastChatAt: 0,
    };
  }

  private finalizeDisconnect(playerId: string) {
    this.disconnectTimers.delete(playerId);
    const player = this.players.get(playerId);
    if (!player || player.connected) return;
    player.disconnectedUntil = null;
    if (!this.humans().some((other) => other.connected)) return this.resetRoom();
    if (this.inRound() && player.seat !== null && this.hands.has(playerId)) {
      // Their cards still pair with everyone else's, so the hand stays in play: a bot holds it.
      this.handToBot(player, `${player.name} mất kết nối — 🤖 bot cầm bài giúp tới hết ván.`);
    } else {
      this.removePlayer(player, `${player.name} đã rời phòng 👋`);
    }
    this.broadcastState();
  }

  private handToBot(player: PlayerState, message: string) {
    player.standIn = true;
    this.systemChat(message);
    if (this.turn?.drawerId === player.id) this.planBotDraw(player);
  }

  private removePlayer(player: PlayerState, message: string) {
    this.players.delete(player.id);
    this.hands.delete(player.id);
    this.teased.delete(player.id);
    this.nextReady.delete(player.id);
    this.systemChat(message);
    if (this.hostId === player.id) this.transferHost(player.id);
  }

  private leave(sender: Connection) {
    const player = this.players.get(sender.id);
    if (player) {
      if (this.inRound() && player.seat !== null && this.hands.has(player.id)) {
        player.left = true;
        player.connected = false;
        this.handToBot(player, `${player.name} đã rời bàn — 🤖 bot cầm bài giúp tới hết ván.`);
        if (this.hostId === player.id) this.transferHost(player.id);
      } else {
        this.removePlayer(player, `${player.name} đã rời phòng 👋`);
      }
      if (!this.humans().some((other) => other.connected && other.id !== sender.id)) this.resetRoom();
      else this.broadcastState();
    }
    sender.close();
  }

  // ---------- lobby ----------

  private takeSeat(id: string, seat: number) {
    const player = this.players.get(id);
    if (!player || this.phase !== "lobby" || player.isBot) return;
    if (!Number.isInteger(seat) || seat < 0 || seat >= MAX_SEATS || this.seatTaken(seat)) return;
    player.seat = seat;
    player.ready = false;
    this.broadcastState();
  }

  private setReady(id: string, ready: boolean) {
    const player = this.players.get(id);
    if (!player || this.phase !== "lobby" || player.seat === null) return;
    player.ready = !!ready;
    this.broadcastState();
  }

  private updateConfig(sender: Connection, incoming: Partial<OldMaidConfig>) {
    if (sender.id !== this.hostId || this.phase !== "lobby" || !incoming) return;
    const next = { ...this.config };
    if ((TURN_SECONDS as readonly number[]).includes(incoming.turnSeconds as number)) next.turnSeconds = incoming.turnSeconds as number;
    if (incoming.pairRule === "rank" || incoming.pairRule === "rankColor") next.pairRule = incoming.pairRule;
    if (typeof incoming.pigDeals === "boolean") next.pigDeals = incoming.pigDeals;
    if ((ROUNDS_TO_PLAY as readonly number[]).includes(incoming.roundsToPlay as number)) next.roundsToPlay = incoming.roundsToPlay as number;
    if (typeof incoming.isPublic === "boolean") next.isPublic = incoming.isPublic;
    if (incoming.botLevel === "easy" || incoming.botLevel === "smart") next.botLevel = incoming.botLevel;
    this.config = next;
    this.broadcastState();
  }

  private addBot(sender: Connection, seat: number) {
    if (sender.id !== this.hostId || this.phase !== "lobby") return;
    if (!Number.isInteger(seat) || seat < 0 || seat >= MAX_SEATS || this.seatTaken(seat)) return;
    this.seatBot(seat);
    this.broadcastState();
  }

  private seatBot(seat: number) {
    const taken = new Set([...this.players.values()].map((player) => player.name));
    const name = shuffled(BOT_NAMES).find((candidate) => !taken.has(candidate)) ?? `Heo ${seat + 1}`;
    const id = `bot-${token()}`;
    this.players.set(id, this.newPlayer(id, name, seat, true));
  }

  private removeBot(sender: Connection, playerId: string) {
    const bot = this.players.get(playerId);
    if (sender.id !== this.hostId || this.phase !== "lobby" || !bot?.isBot) return;
    this.players.delete(playerId);
    this.broadcastState();
  }

  private startGame(sender: Connection) {
    if (sender.id !== this.hostId || this.phase !== "lobby") return;
    const seated = this.seated();
    if (seated.length < MIN_PLAYERS) return this.sendError(sender, "Cần ít nhất 2 người (có thể thêm bot) mới chia bài được.");
    const waiting = seated.filter((player) => !player.isBot && player.id !== this.hostId && (!player.ready || !player.connected));
    if (waiting.length) return this.sendError(sender, `Còn chờ ${waiting.map((player) => player.name).join(", ")} sẵn sàng.`);
    this.startRound();
  }

  /** "Chơi với bot ngay": a fresh private room, the host plus bots, dealt at once. */
  private quickStart(sender: Connection, bots: number) {
    const me = this.players.get(sender.id);
    if (sender.id !== this.hostId || this.phase !== "lobby" || !me || me.seat === null) return;
    if (this.seated().some((player) => player.id !== me.id)) return;
    this.config.isPublic = false;
    const count = Math.max(1, Math.min(MAX_SEATS - 1, Math.round(bots) || 3));
    // Spread the bots round the table rather than bunching them up next to the host.
    const seats = Array.from({ length: MAX_SEATS - 1 }, (_, index) => (me.seat! + 1 + index) % MAX_SEATS);
    const step = (MAX_SEATS - 1) / count;
    for (let index = 0; index < count; index++) this.seatBot(seats[Math.min(seats.length - 1, Math.round(index * step + step / 2 - 0.5))]);
    this.startRound();
  }

  // ---------- round flow ----------

  private startRound() {
    this.clearAllTimers();
    // Watchers sit down at any free seat; players who left for good don't come back.
    for (const player of this.players.values()) {
      if (player.seat === null && !player.isBot && player.connected) player.seat = this.freeSeat();
    }
    const seated = this.seated();
    if (seated.length < MIN_PLAYERS) return this.toLobby("Cần ít nhất 2 người để chia bài.");

    this.round += 1;
    this.hands.clear();
    this.teased.clear();
    this.discard = [];
    this.finishOrder = [];
    this.nextReady.clear();
    this.turn = null;
    this.hoverSlot = null;
    for (const player of seated) {
      player.finishedRank = null;
      player.draws = 0;
      player.jokerDraws = 0;
      player.ready = player.isBot;
      this.hands.set(player.id, []);
    }

    const pig = this.pigId ? this.players.get(this.pigId) : undefined;
    const dealer = this.config.pigDeals && pig?.seat != null ? pig : seated[randomInt(seated.length)];
    this.dealerId = dealer.id;
    // Deal the whole deck one at a time, starting with the player after the dealer.
    const order = this.turnOrderFrom(dealer.seat!, seated);
    shuffled(DECK).forEach((card, index) => this.hands.get(order[index % order.length].id)!.push({ id: token(), card }));

    this.enterPhase("dealing", DEAL_MS + OPENING_PAIRS_MS);
    this.broadcastEvent({ type: "deal", dealerId: dealer.id, counts: this.counts() });
    this.broadcastState();
    this.sendAllHands();
    this.flow(DEAL_MS, () => this.throwOpeningPairs());
  }

  private throwOpeningPairs() {
    const byPlayer: Record<string, number[]> = {};
    for (const player of this.seated()) {
      const { pairs, rest } = splitPairs(this.hands.get(player.id) ?? [], (item) => item.card, this.config.pairRule);
      this.hands.set(player.id, rest);
      byPlayer[player.id] = pairs.flat().map((item) => item.card);
      this.discard.push(...byPlayer[player.id]);
    }
    this.broadcastEvent({ type: "pairs", byPlayer });
    this.broadcastState();
    this.sendAllHands();
    this.flow(OPENING_PAIRS_MS, () => this.beginPlay());
  }

  private beginPlay() {
    const dealer = this.players.get(this.dealerId ?? "");
    const fromSeat = dealer?.seat ?? 0;
    // Anyone whose opening pairs emptied their hand is out already, in turn order from the dealer.
    for (const player of this.turnOrderFrom(fromSeat - 1, this.seated())) {
      if (!this.hands.get(player.id)?.length) this.finish(player);
    }
    if (this.active().length < MIN_PLAYERS) return this.endRound();
    this.enterPhase("playing", 0);
    const first = dealer && this.isActive(dealer) ? dealer : this.activeAfter(fromSeat);
    this.startTurn(first.id);
  }

  private startTurn(drawerId: string) {
    const drawer = this.players.get(drawerId);
    if (!drawer || drawer.seat === null || this.phase !== "playing") return;
    const target = this.activeBefore(drawer.seat);
    if (!target || target.id === drawer.id) return this.endRound();
    this.turn = { drawerId, targetId: target.id, endsAt: Date.now() + this.config.turnSeconds * 1000 };
    this.hoverSlot = null;
    this.broadcastState();
    this.clearTurnTimer();
    this.turnTimer = setTimeout(() => this.timeOut(), this.config.turnSeconds * 1000);
    if (isAuto(drawer)) this.planBotDraw(drawer);
    if (isAuto(target)) this.planBotDefense(target);
  }

  /** Out of time: take the card the drawer was pointing at, or any card. */
  private timeOut() {
    this.turnTimer = null;
    if (!this.turn) return;
    const size = this.hands.get(this.turn.targetId)?.length ?? 0;
    if (!size) return;
    const slot = this.hoverSlot !== null && this.hoverSlot < size ? this.hoverSlot : randomInt(size);
    this.draw(this.turn.drawerId, slot, true);
  }

  private draw(drawerId: string, slot: number, timedOut: boolean) {
    const turn = this.turn;
    if (this.phase !== "playing" || !turn || turn.drawerId !== drawerId) return;
    const targetHand = this.hands.get(turn.targetId);
    const drawerHand = this.hands.get(drawerId);
    if (!targetHand || !drawerHand || !Number.isInteger(slot) || slot < 0 || slot >= targetHand.length) return;
    this.clearTurnTimer();
    this.clearBotTimers();
    this.turn = null;
    this.hoverSlot = null;

    const [taken] = targetHand.splice(slot, 1);
    this.teased.delete(turn.targetId);
    this.teased.delete(drawerId);
    const drawer = this.players.get(drawerId)!;
    const target = this.players.get(turn.targetId)!;
    drawer.draws += 1;
    if (taken.card === JOKER) drawer.jokerDraws += 1;

    let pair: [number, number] | null = null;
    const mateIndex = drawerHand.findIndex((item) => isPair(item.card, taken.card, this.config.pairRule));
    if (mateIndex >= 0) {
      const [mate] = drawerHand.splice(mateIndex, 1);
      pair = [mate.card, taken.card];
      this.discard.push(...pair);
    } else {
      // Slipped in anywhere, so nobody watching can track where the new card sits.
      drawerHand.splice(randomInt(drawerHand.length + 1), 0, taken);
    }

    const event: OldMaidEvent = { type: "drew", drawerId, targetId: target.id, slot, pair, timedOut };
    for (const connection of this.getConnections()) {
      const privy = connection.id === drawerId || connection.id === target.id;
      connection.send(JSON.stringify({ type: "event", event: privy ? { ...event, card: taken.card } : event } satisfies OldMaidServerMessage));
    }
    if (!targetHand.length) this.finish(target);
    if (!drawerHand.length) this.finish(drawer);
    this.broadcastState();
    this.sendHand(drawerId, pair ? undefined : taken.id);
    this.sendHand(target.id);

    const fromSeat = drawer.seat!;
    this.flow(DRAW_RESOLVE_MS, () => {
      if (this.active().length < MIN_PLAYERS) return this.endRound();
      this.startTurn(this.activeAfter(fromSeat).id);
    });
  }

  private finish(player: PlayerState) {
    if (player.finishedRank !== null) return;
    this.finishOrder.push(player.id);
    player.finishedRank = this.finishOrder.length;
    this.teased.delete(player.id);
    this.broadcastEvent({ type: "out", playerId: player.id, place: player.finishedRank });
  }

  private endRound() {
    if (this.phase === "roundEnd" || this.phase === "final" || this.phase === "lobby") return;
    this.clearTurnTimer();
    this.clearBotTimers();
    this.turn = null;
    const seated = this.seated();
    // The last one holding cards holds the Joker.
    const pig =
      this.active()[0] ??
      seated.find((player) => this.hands.get(player.id)?.some((item) => item.card === JOKER)) ??
      seated[seated.length - 1];
    if (!pig) return this.toLobby();
    for (const player of seated) player.rounds += 1;
    pig.pigs += 1;
    const first = this.players.get(this.finishOrder[0] ?? "");
    if (first) first.firsts += 1;
    this.pigId = pig.id;
    const places = [...this.finishOrder.filter((id) => id !== pig.id), pig.id];
    this.lastRound = {
      round: this.round,
      pigId: pig.id,
      pigName: pig.name,
      rows: places.flatMap((id, index) => {
        const player = this.players.get(id);
        return player ? [{ id, name: player.name, place: index + 1, draws: player.draws, jokerDraws: player.jokerDraws }] : [];
      }),
    };
    this.broadcastEvent({ type: "pig", playerId: pig.id });
    void this.reportHistory(seated);

    // Stand-ins whose humans are gone leave the table now.
    for (const player of seated) {
      if (player.standIn && (player.left || !this.disconnectTimers.has(player.id))) {
        this.removePlayer(player, `${player.name} đã rời bàn.`);
      }
    }
    this.nextReady = new Set(this.seated().filter((player) => player.isBot).map((player) => player.id));
    if (this.config.roundsToPlay && this.round >= this.config.roundsToPlay) {
      this.enterPhase("final", 0);
    } else {
      this.enterPhase("roundEnd", NEXT_ROUND_MS);
      this.flow(NEXT_ROUND_MS, () => this.startRound());
    }
    this.broadcastState();
    this.sendAllHands();
  }

  private nextRound(id: string) {
    const player = this.players.get(id);
    if (!player || this.phase !== "roundEnd") return;
    this.nextReady.add(id);
    const waiting = this.seated().filter((other) => !other.isBot && other.connected && !this.nextReady.has(other.id));
    if (!waiting.length) this.startRound();
    else this.broadcastState();
  }

  private backToLobby(sender: Connection) {
    if (sender.id !== this.hostId || (this.phase !== "roundEnd" && this.phase !== "final")) return;
    this.toLobby();
  }

  /** From the final podium: scores back to zero, deal again. */
  private newSet(sender: Connection) {
    if (sender.id !== this.hostId || this.phase !== "final") return;
    for (const player of this.players.values()) {
      player.pigs = 0;
      player.firsts = 0;
      player.rounds = 0;
    }
    this.round = 0;
    this.pigId = null;
    this.lastRound = null;
    this.startRound();
  }

  private toLobby(message?: string) {
    this.clearAllTimers();
    this.hands.clear();
    this.teased.clear();
    this.turn = null;
    this.discard = [];
    for (const player of this.players.values()) {
      player.ready = player.isBot;
      player.finishedRank = null;
    }
    this.enterPhase("lobby", 0);
    if (message && this.hostId) this.sendErrorTo(this.hostId, message);
    this.broadcastState();
    this.sendAllHands();
  }

  private resetRoom() {
    this.clearAllTimers();
    for (const handle of this.disconnectTimers.values()) clearTimeout(handle);
    this.disconnectTimers.clear();
    this.players.clear();
    this.hands.clear();
    this.teased.clear();
    this.nextReady.clear();
    this.turn = null;
    this.discard = [];
    this.finishOrder = [];
    this.round = 0;
    this.pigId = null;
    this.lastRound = null;
    this.hostId = null;
    this.config = { ...DEFAULT_OLDMAID_CONFIG };
    this.phase = "lobby";
    this.phaseEndsAt = null;
    this.chat = [];
    this.broadcastState();
  }

  // ---------- table talk: hover, tease, shuffle, emote ----------

  private hover(id: string, slot: number | null) {
    const player = this.players.get(id);
    if (!player || !this.turn || this.turn.drawerId !== id) return;
    const size = this.hands.get(this.turn.targetId)?.length ?? 0;
    const next = slot === null ? null : Number.isInteger(slot) && slot >= 0 && slot < size ? slot : undefined;
    if (next === undefined || next === this.hoverSlot) return;
    const now = Date.now();
    if (now - player.lastHoverAt < 45) return;
    player.lastHoverAt = now;
    this.hoverSlot = next;
    this.broadcast(JSON.stringify({ type: "hover", drawerId: id, slot: next } satisfies OldMaidServerMessage));
  }

  private tease(id: string, slot: number | null) {
    const player = this.players.get(id);
    const hand = this.hands.get(id);
    if (!player || !hand?.length || this.phase !== "playing" || player.finishedRank !== null) return;
    const now = Date.now();
    if (now - player.lastTeaseAt < 120) return;
    player.lastTeaseAt = now;
    if (slot === null) this.teased.delete(id);
    else if (Number.isInteger(slot) && slot >= 0 && slot < hand.length) this.teased.set(id, slot);
    else return;
    this.broadcastState();
  }

  private shuffleHand(id: string) {
    const player = this.players.get(id);
    const hand = this.hands.get(id);
    if (!player || !hand || hand.length < 2 || (this.phase !== "playing" && this.phase !== "dealing")) return;
    const now = Date.now();
    if (now - player.lastShuffleAt < 450) return;
    player.lastShuffleAt = now;
    this.hands.set(id, shuffled(hand));
    this.teased.delete(id);
    this.broadcastEvent({ type: "shuffled", playerId: id });
    this.broadcastState();
    this.sendHand(id);
  }

  private reorder(id: string, order: string[]) {
    const hand = this.hands.get(id);
    if (!hand || !Array.isArray(order) || order.length !== hand.length) return;
    const byId = new Map(hand.map((item) => [item.id, item]));
    const next = order.map((cardId) => byId.get(cardId));
    if (next.some((item) => !item) || new Set(order).size !== order.length) return;
    this.hands.set(id, next as OldMaidHandCard[]);
    if (this.teased.delete(id)) this.broadcastState();
    this.sendHand(id);
  }

  private emote(id: string, emote: Emote) {
    const player = this.players.get(id);
    if (!player || !isEmote(emote)) return;
    const now = Date.now();
    if (now - player.lastEmoteAt < EMOTE_COOLDOWN_MS) return;
    player.lastEmoteAt = now;
    this.broadcast(JSON.stringify({ type: "emote", playerId: id, emote } satisfies OldMaidServerMessage));
  }

  private sendChat(id: string, rawText: string) {
    const player = this.players.get(id);
    if (!player) return;
    const text = String(rawText ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
    if (!text) return;
    const now = Date.now();
    if (now - player.lastChatAt < 400) return;
    player.lastChatAt = now;
    this.pushChat({ id: makeId(), playerId: id, playerName: player.name, text, sentAt: now });
    this.broadcastState();
  }

  private systemChat(text: string) {
    this.pushChat({ id: makeId(), playerId: "", playerName: "", text, sentAt: Date.now(), system: true });
  }

  private pushChat(entry: OldMaidChatEntry) {
    this.chat.push(entry);
    if (this.chat.length > 80) this.chat.splice(0, this.chat.length - 80);
  }

  // ---------- bots ----------

  /** Draws like a person thinking it over: points at a few cards (everyone sees), then takes one. */
  private planBotDraw(bot: PlayerState) {
    const turn = this.turn;
    if (!turn || turn.drawerId !== bot.id) return;
    const size = this.hands.get(turn.targetId)?.length ?? 0;
    if (!size) return;
    const smart = bot.standIn || this.config.botLevel === "smart";
    const looks = smart ? 2 + randomInt(3) : 1;
    let at = rand(500, 900);
    let slot = randomInt(size);
    for (let look = 0; look < looks; look++) {
      const pointAt = randomInt(size);
      slot = pointAt;
      this.botLater(at, () => this.hover(bot.id, pointAt));
      at += rand(450, 850);
    }
    const teased = this.teased.get(turn.targetId);
    if (smart && teased !== undefined && size > 1 && Math.random() < 0.6) {
      // Doesn't fall for the dangled card (most of the time).
      const others = Array.from({ length: size }, (_, index) => index).filter((index) => index !== teased);
      slot = others[randomInt(others.length)];
      this.botLater(at, () => this.hover(bot.id, slot));
      at += rand(350, 600);
    }
    const final = slot;
    // Never let a bot run out the clock.
    this.botLater(Math.min(at + rand(150, 400), this.config.turnSeconds * 1000 - 600), () => this.draw(bot.id, final, false));
  }

  /** While being drawn from: shuffle, dangle a card (the Joker or a decoy), pull a face. */
  private planBotDefense(bot: PlayerState) {
    const hand = this.hands.get(bot.id);
    if (!hand?.length) return;
    const smart = bot.standIn || this.config.botLevel === "smart";
    if (!smart) return;
    if (hand.length > 1 && Math.random() < 0.3) this.botLater(rand(200, 600), () => this.shuffleHand(bot.id));
    this.botLater(rand(700, 1300), () => {
      const current = this.hands.get(bot.id);
      if (!current?.length || this.turn?.targetId !== bot.id) return;
      const joker = current.findIndex((item) => item.card === JOKER);
      const roll = Math.random();
      if (joker >= 0 && roll < 0.5) this.tease(bot.id, joker);
      else if (current.length > 1 && roll < (joker >= 0 ? 0.75 : 0.25)) {
        const decoys = current.map((_, index) => index).filter((index) => index !== joker);
        this.tease(bot.id, decoys[randomInt(decoys.length)]);
      }
    });
    if (Math.random() < 0.3) this.botLater(rand(900, 2200), () => this.emote(bot.id, BOT_EMOTES[randomInt(BOT_EMOTES.length)]));
  }

  // ---------- helpers ----------

  private inRound() {
    return this.phase === "dealing" || this.phase === "playing";
  }

  private humans(): PlayerState[] {
    return [...this.players.values()].filter((player) => !player.isBot);
  }

  private seated(): PlayerState[] {
    return [...this.players.values()].filter((player) => player.seat !== null).sort((a, b) => a.seat! - b.seat!);
  }

  private isActive(player: PlayerState) {
    return player.seat !== null && player.finishedRank === null && (this.hands.get(player.id)?.length ?? 0) > 0;
  }

  private active(): PlayerState[] {
    return this.seated().filter((player) => this.isActive(player));
  }

  private seatTaken(seat: number) {
    return [...this.players.values()].some((player) => player.seat === seat);
  }

  private freeSeat(): number | null {
    for (let seat = 0; seat < MAX_SEATS; seat++) if (!this.seatTaken(seat)) return seat;
    return null;
  }

  /** `players` in turn order, starting with the first one seated after `seat`. */
  private turnOrderFrom(seat: number, players: PlayerState[]): PlayerState[] {
    const sorted = [...players].sort((a, b) => a.seat! - b.seat!);
    const start = sorted.findIndex((player) => player.seat! > seat);
    return start <= 0 ? sorted : [...sorted.slice(start), ...sorted.slice(0, start)];
  }

  private activeAfter(seat: number): PlayerState {
    const active = this.active();
    const next = seatAfter(active.map((player) => player.seat!), seat);
    return active.find((player) => player.seat === next) ?? active[0];
  }

  private activeBefore(seat: number): PlayerState | undefined {
    const active = this.active();
    const before = seatBefore(active.map((player) => player.seat!), seat);
    return active.find((player) => player.seat === before);
  }

  private counts(): Record<string, number> {
    return Object.fromEntries([...this.hands].map(([id, hand]) => [id, hand.length]));
  }

  private transferHost(fromId: string) {
    const candidates = this.humans().filter((player) => player.connected && player.id !== fromId);
    const next = candidates.find((player) => player.seat !== null) ?? candidates[0];
    this.hostId = next?.id ?? null;
    if (next) this.systemChat(`${next.name} trở thành chủ phòng 👑`);
  }

  private enterPhase(phase: OldMaidPhase, durationMs: number) {
    this.phase = phase;
    this.phaseEndsAt = durationMs > 0 ? Date.now() + durationMs : null;
  }

  private flow(delayMs: number, fn: () => void) {
    const handle = setTimeout(() => {
      this.flowTimers.delete(handle);
      fn();
    }, delayMs);
    this.flowTimers.add(handle);
  }

  private botLater(delayMs: number, fn: () => void) {
    const handle = setTimeout(() => {
      this.botTimers.delete(handle);
      fn();
    }, delayMs);
    this.botTimers.add(handle);
  }

  private clearTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
  }

  private clearBotTimers() {
    for (const handle of this.botTimers) clearTimeout(handle);
    this.botTimers.clear();
  }

  private clearAllTimers() {
    this.clearTurnTimer();
    this.clearBotTimers();
    for (const handle of this.flowTimers) clearTimeout(handle);
    this.flowTimers.clear();
  }

  // ---------- state ----------

  private publicState(): PublicOldMaidState {
    return {
      roomId: this.name,
      phase: this.phase,
      config: this.config,
      hostId: this.hostId,
      players: [...this.players.values()].map((player) => ({
        id: player.id,
        name: player.name,
        seat: player.seat,
        isBot: player.isBot,
        standIn: player.standIn,
        connected: player.connected,
        disconnectedUntil: player.disconnectedUntil,
        ready: player.ready,
        cardCount: this.hands.get(player.id)?.length ?? 0,
        finishedRank: player.finishedRank,
        pigs: player.pigs,
        firsts: player.firsts,
        rounds: player.rounds,
      })),
      round: this.round,
      turn: this.turn,
      phaseEndsAt: this.phaseEndsAt,
      dealerId: this.dealerId,
      teased: Object.fromEntries(this.teased),
      discard: this.discard,
      pigId: this.pigId,
      lastRound: this.lastRound,
      nextReadyIds: [...this.nextReady],
      chat: this.chat,
    };
  }

  private stateMessage(): OldMaidServerMessage {
    return { type: "state", state: this.publicState() };
  }

  private broadcastState() {
    this.broadcast(JSON.stringify(this.stateMessage()));
    this.reportToDirectory();
  }

  private broadcastEvent(event: OldMaidEvent) {
    this.broadcast(JSON.stringify({ type: "event", event } satisfies OldMaidServerMessage));
  }

  // Every open connection of the player: after a refresh the old socket can still be open.
  private sendHand(id: string, drawnId?: string) {
    const message = JSON.stringify({ type: "hand", round: this.round, cards: this.hands.get(id) ?? [], drawnId } satisfies OldMaidServerMessage);
    for (const connection of this.getConnections()) if (connection.id === id) connection.send(message);
  }

  private sendAllHands() {
    for (const id of this.players.keys()) this.sendHand(id);
  }

  private sendError(connection: Connection, message: string) {
    connection.send(JSON.stringify({ type: "error", message } satisfies OldMaidServerMessage));
  }

  private sendErrorTo(id: string, message: string) {
    for (const connection of this.getConnections()) if (connection.id === id) this.sendError(connection, message);
  }

  private reportToDirectory() {
    const host = this.hostId ? this.players.get(this.hostId) : undefined;
    const listing: OldMaidRoomListing = {
      roomId: this.name,
      hostName: host?.name ?? "",
      playerCount: this.humans().filter((player) => player.connected).length,
      maxPlayers: MAX_SEATS,
      status: this.phase === "lobby" ? "lobby" : "playing",
      hidden: !this.config.isPublic || !this.humans().some((player) => player.connected),
    };
    const key = JSON.stringify(listing);
    if (key === this.lastListingKey) return;
    this.lastListingKey = key;
    getServerByName(this.env.Oldmaidlobby, "main")
      .then((lobby) => lobby.fetch("https://lobby/", { method: "POST", headers: { "content-type": "application/json" }, body: key }))
      .catch(() => {});
  }

  private async reportHistory(seated: PlayerState[]) {
    if (seated.some((player) => player.isBot) || !this.lastRound) return; // bot games are practice
    try {
      const base = this.env.NEXT_APP_URL;
      if (!base) return;
      const rows = this.lastRound.rows;
      await fetch(`${base.replace(/\/$/, "")}/api/game-history`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gameType: "oldmaid",
          roomId: this.name,
          players: rows.map((row) => ({ name: row.name, score: rows.length - row.place })),
          rounds: this.round,
          mode: `${rows.length} người`,
          winnerName: rows[0]?.name ?? null,
          detail: rows.map((row) => ({ name: row.name, place: row.place, pig: row.id === this.lastRound!.pigId, draws: row.draws, jokerDraws: row.jokerDraws })),
          playedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // Best-effort; never break the room.
    }
  }
}
