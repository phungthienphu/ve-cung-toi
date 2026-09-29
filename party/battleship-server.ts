import type * as Party from "partykit/server";
import {
  DEFAULT_BATTLESHIP_CONFIG,
  MAX_BATTLESHIP_PLAYERS,
  MAX_TEAM_SIZE,
  MID_GAME_JOIN_MESSAGE,
  PLACEMENT_SECONDS,
  RECONNECT_GRACE_MS,
  REVEAL_MS,
  SHIP_LABEL,
  TEAM_LABELS,
  boardSizeFor,
  cellXY,
  fleetFor,
  isValidFleet,
  pickBotCell,
  randomFleet,
  shipCells,
  type BattleshipChatEntry,
  type BattleshipClientMessage,
  type BattleshipConfig,
  type BattleshipPhase,
  type BattleshipPlayer,
  type BattleshipRoomListing,
  type BattleshipServerMessage,
  type BattleshipStanding,
  type BattleshipTeam,
  type PrivateBattleshipState,
  type PublicBattleshipState,
  type PublicBoard,
  type ShipPlacement,
  type ShotEvent,
} from "../shared/battleshipTypes";

const BOT_NAMES = ["Râu Đen", "Mắt Chột", "Chân Gỗ", "Mỏ Neo", "Sóng Dữ", "Hải Âu", "Cá Mập", "Bão Tố"];
const COLS = "ABCDEFGHIJ";

interface BoardState {
  id: string;
  team: BattleshipTeam | null;
  size: number;
  ships: ShipPlacement[];
  hits: Set<number>;
  misses: Set<number>;
  sunk: Set<number>; // indexes into ships
  alive: boolean;
}

interface Aim {
  boardId: string;
  cells: number[];
}

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const cellName = (cell: number, size: number) => {
  const { x, y } = cellXY(cell, size);
  return `${COLS[x]}${y + 1}`;
};

export default class BattleshipRoom implements Party.Server {
  players = new Map<string, BattleshipPlayer>();
  hostId: string | null = null;
  config: BattleshipConfig = { ...DEFAULT_BATTLESHIP_CONFIG };
  phase: BattleshipPhase = "lobby";
  phaseEndsAt: number | null = null;
  boards = new Map<string, BoardState>();
  turnPlayerId: string | null = null;
  round = 0;
  revealUntil: number | null = null;
  aims = new Map<string, Aim>();
  locked = new Set<string>();
  lastShots: ShotEvent[] = [];
  log: { id: string; text: string }[] = [];
  chat: BattleshipChatEntry[] = [];
  teamChat: Record<BattleshipTeam, BattleshipChatEntry[]> = { A: [], B: [] };
  winnerIds: string[] = [];
  winnerTeam: BattleshipTeam | null = null;
  standings: BattleshipStanding[] = [];
  timer: ReturnType<typeof setTimeout> | null = null;
  botTimers = new Map<ReturnType<typeof setTimeout>, () => void>();
  disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  lastChatAt = new Map<string, number>();
  historyReported = false;
  lastListingKey = "";

  constructor(readonly party: Party.Party) {}

  // ---------- connection ----------

  onConnect(connection: Party.Connection) {
    connection.send(JSON.stringify(this.stateMessage()));
  }

  onClose(connection: Party.Connection) {
    const player = this.players.get(connection.id);
    if (!player) return;
    // A refresh opens the new socket before the old one closes — not a leave.
    if ([...this.party.getConnections()].some((other) => other.id === connection.id)) return;
    player.connected = false;
    player.disconnectedUntil = Date.now() + RECONNECT_GRACE_MS;
    const old = this.disconnectTimers.get(player.id);
    if (old) clearTimeout(old);
    this.disconnectTimers.set(player.id, setTimeout(() => this.finalizeDisconnect(player.id), RECONNECT_GRACE_MS));
    if (this.hostId === player.id) this.transferHost(player.id);
    this.broadcastState();
    this.recheckProgress();
  }

  onMessage(raw: string, sender: Party.Connection) {
    let msg: BattleshipClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case "join": return this.join(msg.playerId, msg.name, sender);
      case "chat": return this.sendChat(sender.id, msg.text, !!msg.teamOnly);
      case "set_ready": return this.setReady(sender.id, msg.ready);
      case "update_config": return this.updateConfig(sender, msg.config);
      case "choose_team": return this.chooseTeam(sender.id, msg.team);
      case "shuffle_teams": return this.shuffleTeams(sender);
      case "start_game": return this.startGame(sender);
      case "place_ships": return this.placeShips(sender.id, msg.ships);
      case "random_ships": return this.randomShips(sender.id);
      case "shoot": return this.shoot(sender.id, msg.cell);
      case "aim": return this.aim(sender.id, msg.boardId, msg.cell);
      case "lock_aim": return this.lockAim(sender.id);
      case "play_again": return this.playAgain(sender);
      case "leave_room": return this.leave(sender);
    }
  }

  private join(playerId: string, name: string, sender: Party.Connection) {
    if (sender.id !== playerId) return this.sendError(sender, "Phiên người chơi không hợp lệ.");
    const cleanName = String(name ?? "").trim().slice(0, 20) || "Thuyền trưởng";
    let player = this.players.get(playerId);
    if (!player) {
      if (this.phase !== "lobby") return this.sendError(sender, MID_GAME_JOIN_MESSAGE);
      if (this.humans().length >= MAX_BATTLESHIP_PLAYERS) return this.sendError(sender, "Phòng đã đầy.");
      player = {
        id: playerId,
        name: cleanName,
        connected: true,
        disconnectedUntil: null,
        isHost: this.players.size === 0,
        isBot: false,
        ready: false,
        team: this.smallerTeam(),
        eliminatedRound: null,
        shots: 0,
        hits: 0,
        sinks: 0,
      };
      this.players.set(playerId, player);
      if (player.isHost) this.hostId = playerId;
      else this.systemChat(`${player.name} đã lên tàu ⚓`);
    } else {
      player.connected = true;
      player.disconnectedUntil = null;
      player.name = cleanName;
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
    player.disconnectedUntil = null;

    if (this.phase === "lobby") {
      this.players.delete(playerId);
      this.systemChat(`${player.name} đã rời tàu 👋`);
      if (this.hostId === playerId) this.transferHost(playerId);
    } else if (this.phase !== "gameEnd") {
      if (!this.humans().some((other) => other.connected)) {
        this.resetRoom();
        return;
      }
      this.dropFromMatch(player);
      if (this.phase !== "battle" && this.phase !== "placement") return; // match ended inside
    }
    this.broadcastState();
    this.sendAllPrivate();
    this.recheckProgress();
  }

  /** A player gone for good mid-match: their fleet is scuttled (solo / hỗn
   * chiến) or they simply stop shooting for their team (đồng đội). */
  private dropFromMatch(player: BattleshipPlayer) {
    this.players.delete(player.id);
    this.aims.delete(player.id);
    this.locked.delete(player.id);
    if (this.hostId === player.id) this.transferHost(player.id);
    this.pushLog(`${player.name} đã rời trận.`);

    if (this.config.mode === "team") {
      const team = player.team;
      if (team && !this.teamMembers(team).length) {
        const board = this.boards.get(`team-${team}`);
        if (board) board.alive = false;
        this.endGame(team === "A" ? "B" : "A");
      }
      return;
    }
    const board = this.boards.get(player.id);
    if (board) board.alive = false;
    if (this.config.mode === "solo") {
      const other = [...this.players.values()][0];
      this.endGame(other ? [other.id] : []);
      return;
    }
    this.checkFfaEnd();
  }

  // ---------- lobby ----------

  private setReady(id: string, ready: boolean) {
    const player = this.players.get(id);
    if (!player) return;
    if (this.phase === "lobby") {
      player.ready = !!ready;
      this.broadcastState();
    } else if (this.phase === "placement") {
      player.ready = !!ready;
      this.broadcastState();
      this.recheckProgress();
    }
  }

  private updateConfig(sender: Party.Connection, incoming: BattleshipConfig) {
    if (sender.id !== this.hostId || this.phase !== "lobby") return;
    const mode = incoming.mode === "ffa" || incoming.mode === "team" ? incoming.mode : "solo";
    this.config = {
      mode,
      turnSeconds: [10, 15, 20].includes(incoming.turnSeconds) ? incoming.turnSeconds : 15,
      noTouching: !!incoming.noTouching,
      hitAgain: !!incoming.hitAgain,
      botCount: Math.max(0, Math.min(MAX_BATTLESHIP_PLAYERS - 1, Math.round(incoming.botCount) || 0)),
      botLevel: incoming.botLevel === "easy" ? "easy" : "normal",
    };
    for (const player of this.players.values()) if (!player.team) player.team = this.smallerTeam();
    this.broadcastState();
  }

  private chooseTeam(id: string, team: BattleshipTeam) {
    const player = this.players.get(id);
    if (this.phase !== "lobby" || !player || (team !== "A" && team !== "B")) return;
    if (this.humans().filter((other) => other.team === team).length >= MAX_TEAM_SIZE) return;
    player.team = team;
    this.broadcastState();
  }

  private shuffleTeams(sender: Party.Connection) {
    if (sender.id !== this.hostId || this.phase !== "lobby") return;
    const humans = shuffled(this.humans());
    humans.forEach((player, index) => { player.team = index % 2 === 0 ? "A" : "B"; });
    this.broadcastState();
  }

  private startGame(sender: Party.Connection) {
    if (sender.id !== this.hostId || this.phase !== "lobby") return;
    const mode = this.config.mode;
    const humans = this.humans().filter((player) => player.connected);
    if (humans.some((player) => !player.ready && player.id !== this.hostId)) return this.sendError(sender, "Mọi người cần bấm Sẵn sàng.");

    const maxBots = MAX_BATTLESHIP_PLAYERS - humans.length;
    let botCount = Math.max(0, Math.min(this.config.botCount, maxBots));
    if (mode === "solo") botCount = Math.max(0, 2 - humans.length);
    const total = humans.length + botCount;

    if (mode === "solo" && total !== 2) return this.sendError(sender, "Solo cần đúng 2 người (hoặc 1 người + bot).");
    if (mode === "ffa" && total < 3) return this.sendError(sender, "Hỗn chiến cần ít nhất 3 người (tính cả bot).");
    if (mode === "team") {
      const counts = { A: humans.filter((p) => p.team === "A").length, B: humans.filter((p) => p.team === "B").length };
      for (let i = 0; i < botCount; i++) counts[counts.A <= counts.B ? "A" : "B"] += 1;
      if (counts.A < 1 || counts.B < 1) return this.sendError(sender, "Mỗi đội cần ít nhất 1 người (có thể thêm bot).");
      if (counts.A > MAX_TEAM_SIZE || counts.B > MAX_TEAM_SIZE) return this.sendError(sender, `Mỗi đội tối đa ${MAX_TEAM_SIZE} người.`);
      if (Math.abs(counts.A - counts.B) > 1) return this.sendError(sender, "Hai đội chỉ được chênh nhau tối đa 1 người.");
    }

    // Seat the bots and deal everyone a random fleet to rearrange.
    this.removeBots();
    for (const player of [...this.players.values()]) if (!player.connected) this.players.delete(player.id);
    shuffled(BOT_NAMES).slice(0, botCount).forEach((name, index) => {
      const team = mode === "team" ? this.smallerTeam() : null;
      this.players.set(`bot-${index + 1}`, {
        id: `bot-${index + 1}`,
        name: `🤖 ${name}`,
        connected: true,
        disconnectedUntil: null,
        isHost: false,
        isBot: true,
        ready: true,
        team,
        eliminatedRound: null,
        shots: 0,
        hits: 0,
        sinks: 0,
      });
    });

    const size = boardSizeFor(mode);
    const fleet = fleetFor(mode);
    this.boards.clear();
    if (mode === "team") {
      for (const team of ["A", "B"] as const) {
        this.boards.set(`team-${team}`, this.newBoard(`team-${team}`, team, randomFleet(fleet, size, this.config.noTouching), size));
      }
    } else {
      for (const player of this.players.values()) {
        this.boards.set(player.id, this.newBoard(player.id, null, randomFleet(fleet, size, this.config.noTouching), size));
      }
    }
    for (const player of this.players.values()) {
      player.ready = player.isBot;
      player.eliminatedRound = null;
      player.shots = player.hits = player.sinks = 0;
    }
    this.chat = [];
    this.teamChat = { A: [], B: [] };
    this.log = [];
    this.lastShots = [];
    this.round = 0;
    this.winnerIds = [];
    this.winnerTeam = null;
    this.standings = [];
    this.historyReported = false;
    this.enterPhase("placement", PLACEMENT_SECONDS * 1000, () => this.startBattle());
    this.pushLog(`Bắt đầu xếp tàu — ${PLACEMENT_SECONDS} giây.`);
  }

  private newBoard(id: string, team: BattleshipTeam | null, ships: ShipPlacement[], size: number): BoardState {
    return { id, team, size, ships, hits: new Set(), misses: new Set(), sunk: new Set(), alive: true };
  }

  // ---------- placement ----------

  private placeShips(id: string, ships: ShipPlacement[]) {
    if (this.phase !== "placement") return;
    const board = this.boardOf(id);
    if (!board) return;
    const clean = (Array.isArray(ships) ? ships : []).map((ship) => ({ kind: ship.kind, x: Math.round(ship.x), y: Math.round(ship.y), vertical: !!ship.vertical }));
    if (!isValidFleet(clean, fleetFor(this.config.mode), board.size, this.config.noTouching)) return;
    board.ships = clean;
    this.sendPrivateToBoard(board.id);
  }

  private randomShips(id: string) {
    if (this.phase !== "placement") return;
    const board = this.boardOf(id);
    if (!board) return;
    board.ships = randomFleet(fleetFor(this.config.mode), board.size, this.config.noTouching);
    this.sendPrivateToBoard(board.id);
  }

  private startBattle() {
    if (this.phase !== "placement") return;
    for (const player of this.players.values()) player.ready = false;
    this.pushLog("⚔️ Khai chiến!");
    if (this.config.mode === "solo") {
      const ids = [...this.players.keys()];
      this.phase = "battle";
      this.startTurn(ids[Math.floor(Math.random() * ids.length)]);
    } else {
      this.phase = "battle";
      this.startRound();
    }
  }

  // ---------- solo: turns ----------

  private startTurn(playerId: string) {
    this.turnPlayerId = playerId;
    this.enterPhase("battle", this.config.turnSeconds * 1000, () => {
      const player = this.players.get(playerId);
      this.pushLog(`${player?.name ?? "?"} hết giờ, mất lượt.`);
      this.startTurn(this.opponentOf(playerId));
    });
    const player = this.players.get(playerId);
    if (player?.isBot) {
      this.later(rand(900, 1800), () => {
        const target = this.boards.get(this.opponentOf(playerId));
        if (!target) return;
        const cell = pickBotCell(this.publicBoard(target), this.config.botLevel, this.config.noTouching);
        if (cell !== null) this.shoot(playerId, cell);
      });
    }
  }

  private opponentOf(playerId: string): string {
    return [...this.players.keys()].find((id) => id !== playerId) ?? playerId;
  }

  private shoot(id: string, cell: number) {
    if (this.phase !== "battle" || this.config.mode !== "solo" || this.turnPlayerId !== id) return;
    const board = this.boards.get(this.opponentOf(id));
    if (!board || !this.cellOpen(board, cell)) return;
    this.clearBotTimers();
    const events = this.applyShots([{ shooterId: id, board, cell }]);
    this.lastShots = events;
    const event = events[0];
    if (!board.alive) {
      this.endGame([id]);
      return;
    }
    const again = event.result !== "miss" && this.config.hitAgain;
    this.startTurn(again ? id : this.opponentOf(id));
  }

  // ---------- hỗn chiến / đồng đội: simultaneous rounds ----------

  private startRound() {
    this.round += 1;
    this.aims.clear();
    this.locked.clear();
    this.revealUntil = null;
    this.enterPhase("battle", this.config.turnSeconds * 1000, () => this.resolveRound());
    for (const player of this.shooters()) {
      if (!player.isBot) continue;
      this.later(rand(1500, 4500), () => this.botAim(player.id));
    }
  }

  private shooters(): BattleshipPlayer[] {
    return [...this.players.values()].filter((player) => {
      const board = this.boardOf(player.id);
      return board?.alive;
    });
  }

  private shotsAllowed(playerId: string): number {
    const player = this.players.get(playerId);
    if (!player || this.phase !== "battle") return 0;
    if (this.config.mode === "ffa") return this.boardOf(playerId)?.alive ? 1 : 0;
    if (this.config.mode !== "team" || !player.team) return 0;
    // The smaller team gets extra shots so both fire the same total per round.
    const mine = this.teamMembers(player.team).sort((a, b) => a.id.localeCompare(b.id));
    const theirs = this.teamMembers(player.team === "A" ? "B" : "A");
    const target = Math.max(mine.length, theirs.length);
    const extra = Math.max(0, target - mine.length);
    const index = mine.findIndex((member) => member.id === playerId);
    return 1 + Math.floor(extra / mine.length) + (index < extra % mine.length ? 1 : 0);
  }

  /** Hỗn chiến: most shots a single board can take in one round. */
  private aimCap(): number {
    const alive = this.shooters().length;
    return Math.max(1, alive - 2);
  }

  private aimCount(boardId: string, exceptPlayer?: string): number {
    let count = 0;
    for (const [playerId, aim] of this.aims) if (aim.boardId === boardId && playerId !== exceptPlayer) count += aim.cells.length;
    return count;
  }

  private aim(id: string, boardId: string, cell: number) {
    if (this.phase !== "battle" || this.config.mode === "solo" || this.revealUntil) return;
    if (this.locked.has(id)) return;
    const allowed = this.shotsAllowed(id);
    const board = this.boards.get(boardId);
    const own = this.boardOf(id);
    if (!allowed || !board || !own || board === own || !board.alive || !this.cellOpen(board, cell)) return;
    if (this.config.mode === "team" && board.team === own.team) return;

    const current = this.aims.get(id);
    if (this.config.mode === "ffa") {
      if (this.aimCount(boardId, id) >= this.aimCap()) {
        return this.sendErrorTo(id, "Mục tiêu này đã nhận đủ số phát trong vòng. Chọn người khác nhé.");
      }
      this.aims.set(id, { boardId, cells: [cell] });
    } else {
      const cells = current?.boardId === boardId ? [...current.cells] : [];
      const at = cells.indexOf(cell);
      if (at >= 0) cells.splice(at, 1);
      else {
        cells.push(cell);
        while (cells.length > allowed) cells.shift();
      }
      this.aims.set(id, { boardId, cells });
    }
    this.broadcastState();
    this.sendAimUpdate(id);
  }

  private lockAim(id: string) {
    if (this.phase !== "battle" || this.config.mode === "solo" || this.revealUntil) return;
    const aim = this.aims.get(id);
    if (!aim?.cells.length) return;
    this.locked.add(id);
    this.broadcastState();
    this.sendPrivate(id);
    this.recheckProgress();
  }

  private botAim(id: string) {
    const bot = this.players.get(id);
    if (!bot || this.phase !== "battle" || this.revealUntil) return;
    const own = this.boardOf(id);
    if (!own?.alive) return;
    let target: BoardState | undefined;
    if (this.config.mode === "team") {
      target = [...this.boards.values()].find((board) => board.team !== own.team);
    } else {
      // Finish wounded ships first, otherwise hit whoever has the most left.
      const cap = this.aimCap();
      const options = [...this.boards.values()].filter((board) => board !== own && board.alive && this.aimCount(board.id, id) < cap);
      const wounded = options.filter((board) => this.openHitCount(board) > 0);
      const pool = wounded.length ? wounded : options;
      pool.sort((a, b) => this.cellsLeft(b) - this.cellsLeft(a));
      target = pool[Math.random() < 0.7 ? 0 : Math.floor(Math.random() * pool.length)];
    }
    if (!target) return;
    const teammatesAims = this.config.mode === "team"
      ? [...this.aims].filter(([playerId]) => this.players.get(playerId)?.team === bot.team).flatMap(([, a]) => a.cells)
      : [];
    const cells: number[] = [];
    for (let i = 0; i < this.shotsAllowed(id); i++) {
      const cell = pickBotCell(this.publicBoard(target), this.config.botLevel, this.config.noTouching, [...teammatesAims, ...cells]);
      if (cell !== null) cells.push(cell);
    }
    if (!cells.length) return;
    this.aims.set(id, { boardId: target.id, cells });
    this.locked.add(id);
    this.broadcastState();
    if (this.config.mode === "team") this.sendPrivateToBoard(own.id);
    this.recheckProgress();
  }

  private resolveRound() {
    if (this.phase !== "battle" || this.config.mode === "solo" || this.revealUntil) return;
    this.flushBots();
    const shots: Array<{ shooterId: string; board: BoardState; cell: number }> = [];
    for (const [shooterId, aim] of this.aims) {
      const board = this.boards.get(aim.boardId);
      if (!board?.alive || !this.boardOf(shooterId)?.alive) continue;
      for (const cell of aim.cells) if (this.cellOpen(board, cell)) shots.push({ shooterId, board, cell });
    }
    const aliveBefore = new Set([...this.boards.values()].filter((board) => board.alive).map((board) => board.id));
    this.lastShots = this.applyShots(shots);
    if (!shots.length) this.pushLog(`Vòng ${this.round}: không ai khai hỏa.`);

    for (const board of this.boards.values()) {
      if (!aliveBefore.has(board.id) || board.alive) continue;
      if (this.config.mode === "ffa") {
        const owner = this.players.get(board.id);
        if (owner) {
          owner.eliminatedRound = this.round;
          this.pushLog(`💀 ${owner.name} mất toàn bộ hạm đội!`);
        }
      }
    }

    this.aims.clear();
    this.locked.clear();
    this.revealUntil = Date.now() + REVEAL_MS;
    this.enterPhase("battle", 0, null);
    this.timer = setTimeout(() => {
      this.revealUntil = null;
      if (this.config.mode === "team") {
        const dead = [...this.boards.values()].filter((board) => !board.alive);
        if (dead.length === 2) return this.endGame(null);
        if (dead.length === 1) return this.endGame(dead[0].team === "A" ? "B" : "A");
        return this.startRound();
      }
      if (!this.checkFfaEnd()) this.startRound();
    }, REVEAL_MS);
  }

  /** Hỗn chiến ends when at most one fleet is still afloat. */
  private checkFfaEnd(): boolean {
    if (this.config.mode !== "ffa" || (this.phase !== "battle" && this.phase !== "placement")) return false;
    const alive = [...this.boards.values()].filter((board) => board.alive && this.players.has(board.id));
    if (alive.length > 1) return false;
    if (alive.length === 1) this.endGame([alive[0].id]);
    else {
      // Everyone left went down in the same final round: shared win.
      const lastRound = Math.max(...[...this.players.values()].map((player) => player.eliminatedRound ?? 0));
      this.endGame([...this.players.values()].filter((player) => player.eliminatedRound === lastRound).map((player) => player.id));
    }
    return true;
  }

  // ---------- shots ----------

  private cellOpen(board: BoardState, cell: number): boolean {
    return Number.isInteger(cell) && cell >= 0 && cell < board.size * board.size && !board.hits.has(cell) && !board.misses.has(cell);
  }

  /** Applies a batch of shots "at the same time": two shots on the same cell
   * both count, and everyone who hit a ship in the batch shares its sinking. */
  private applyShots(shots: Array<{ shooterId: string; board: BoardState; cell: number }>): ShotEvent[] {
    const events: ShotEvent[] = [];
    const hitters = new Map<string, Set<string>>(); // `${board}:${shipIndex}` -> shooters
    for (const { shooterId, board, cell } of shots) {
      const shooter = this.players.get(shooterId);
      if (shooter) shooter.shots += 1;
      const shipIndex = board.ships.findIndex((ship) => shipCells(ship, board.size).includes(cell));
      const event: ShotEvent = { id: makeId(), shooterId, boardId: board.id, cell, result: shipIndex >= 0 ? "hit" : "miss" };
      events.push(event);
      if (shipIndex >= 0) {
        if (shooter) shooter.hits += 1;
        const key = `${board.id}:${shipIndex}`;
        if (!hitters.has(key)) hitters.set(key, new Set());
        hitters.get(key)!.add(shooterId);
      }
    }
    for (const { board, cell } of shots) {
      const isHit = board.ships.some((ship) => shipCells(ship, board.size).includes(cell));
      (isHit ? board.hits : board.misses).add(cell);
    }
    for (const board of new Set(shots.map((shot) => shot.board))) {
      board.ships.forEach((ship, index) => {
        if (board.sunk.has(index)) return;
        if (!shipCells(ship, board.size).every((cell) => board.hits.has(cell))) return;
        board.sunk.add(index);
        const sinkers = hitters.get(`${board.id}:${index}`) ?? new Set();
        for (const id of sinkers) {
          const player = this.players.get(id);
          if (player) player.sinks += 1;
        }
        for (const event of events) {
          if (event.boardId === board.id && event.result === "hit" && shipCells(ship, board.size).includes(event.cell)) {
            event.result = "sunk";
            event.sunkKind = ship.kind;
          }
        }
        const names = [...sinkers].map((id) => this.players.get(id)?.name ?? "?").join(", ");
        this.pushLog(`🔥 ${names} đánh chìm ${SHIP_LABEL[ship.kind]} của ${this.boardName(board)}!`);
      });
      if (board.sunk.size === board.ships.length) board.alive = false;
    }
    if (this.config.mode === "solo") {
      for (const event of events) {
        if (event.result === "sunk") continue;
        const shooter = this.players.get(event.shooterId)?.name ?? "?";
        const board = this.boards.get(event.boardId)!;
        this.pushLog(`${shooter} bắn ${cellName(event.cell, board.size)}: ${event.result === "hit" ? "trúng! 💥" : "trượt"}`);
      }
    } else if (events.length) {
      const hits = events.filter((event) => event.result !== "miss").length;
      this.pushLog(`Vòng ${this.round}: ${events.length} phát, ${hits} trúng.`);
    }
    return events;
  }

  // ---------- end ----------

  private endGame(winner: string[] | BattleshipTeam | null) {
    this.clearTimer();
    this.clearBotTimers();
    this.phase = "gameEnd";
    this.phaseEndsAt = null;
    this.revealUntil = null;
    this.turnPlayerId = null;
    if (Array.isArray(winner)) {
      this.winnerIds = winner;
      this.winnerTeam = null;
    } else {
      this.winnerTeam = winner;
      this.winnerIds = winner ? this.teamMembers(winner).map((player) => player.id) : [];
    }
    this.standings = this.computeStandings();
    const winnerText = this.winnerTeam
      ? `Đội ${TEAM_LABELS[this.winnerTeam]} chiến thắng!`
      : this.winnerIds.length
        ? `${this.winnerIds.map((id) => this.players.get(id)?.name ?? "?").join(", ")} chiến thắng!`
        : "Hòa — cả hai hạm đội cùng chìm!";
    this.pushLog(`🏆 ${winnerText}`);
    this.broadcastState();
    this.sendAllPrivate();
    void this.reportHistory();
  }

  private computeStandings(): BattleshipStanding[] {
    if (this.config.mode !== "ffa") {
      return [...this.players.values()].map((player) => ({ playerId: player.id, place: this.winnerIds.includes(player.id) ? 1 : 2 }));
    }
    const rows: BattleshipStanding[] = this.winnerIds.map((playerId) => ({ playerId, place: 1 }));
    const rounds = [...new Set([...this.players.values()]
      .filter((player) => !this.winnerIds.includes(player.id))
      .map((player) => player.eliminatedRound ?? 0))].sort((a, b) => b - a);
    let place = rows.length + 1;
    for (const round of rounds) {
      const group = [...this.players.values()].filter((player) => !this.winnerIds.includes(player.id) && (player.eliminatedRound ?? 0) === round);
      for (const player of group) rows.push({ playerId: player.id, place });
      place += group.length;
    }
    return rows;
  }

  private playAgain(sender: Party.Connection) {
    if (sender.id !== this.hostId || this.phase !== "gameEnd") return;
    this.resetMatchState();
    this.removeBots();
    for (const [id, player] of [...this.players]) if (!player.connected) this.players.delete(id);
    for (const player of this.players.values()) {
      player.ready = false;
      player.eliminatedRound = null;
      player.shots = player.hits = player.sinks = 0;
      if (this.config.mode === "team" && !player.team) player.team = this.smallerTeam();
    }
    this.broadcastState();
    this.sendAllPrivate();
  }

  private resetMatchState() {
    this.clearTimer();
    this.clearBotTimers();
    this.phase = "lobby";
    this.phaseEndsAt = null;
    this.boards.clear();
    this.turnPlayerId = null;
    this.round = 0;
    this.revealUntil = null;
    this.aims.clear();
    this.locked.clear();
    this.lastShots = [];
    this.log = [];
    this.chat = [];
    this.teamChat = { A: [], B: [] };
    this.winnerIds = [];
    this.winnerTeam = null;
    this.standings = [];
  }

  private resetRoom() {
    this.resetMatchState();
    this.players.clear();
    this.hostId = null;
    this.broadcastState();
  }

  private leave(sender: Party.Connection) {
    const player = this.players.get(sender.id);
    if (player && this.phase === "lobby") {
      this.players.delete(sender.id);
      this.systemChat(`${player.name} đã rời tàu 👋`);
      if (this.hostId === sender.id) this.transferHost(sender.id);
      this.broadcastState();
    }
    // Mid-match, closing starts the usual 30s reconnect window (see onClose).
    sender.close();
  }

  /** Advances early when everyone who still has to act has acted. */
  private recheckProgress() {
    if (this.phase === "placement") {
      const waiting = [...this.players.values()].filter((player) => !player.isBot && player.connected);
      if (waiting.length && waiting.every((player) => player.ready)) this.startBattle();
      return;
    }
    if (this.phase === "battle" && this.config.mode !== "solo" && !this.revealUntil) {
      const shooters = this.shooters();
      const waiting = shooters.filter((player) => !player.isBot && player.connected);
      const humansDone = waiting.every((player) => this.locked.has(player.id));
      // Only bots left afloat (everyone human is out or offline): don't sit
      // through the full timer — resolve as soon as the bots have fired.
      if (humansDone && (waiting.length > 0 || shooters.every((player) => this.locked.has(player.id)))) this.resolveRound();
    }
  }

  // ---------- chat ----------

  private sendChat(id: string, rawText: string, teamOnly: boolean) {
    const player = this.players.get(id);
    if (!player) return;
    const text = String(rawText ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
    if (!text) return;
    const now = Date.now();
    if (now - (this.lastChatAt.get(id) ?? 0) < 400) return;
    this.lastChatAt.set(id, now);
    const entry: BattleshipChatEntry = { id: makeId(), playerId: id, playerName: player.name, text, sentAt: now };
    if (teamOnly && this.config.mode === "team" && player.team && this.phase !== "lobby") {
      const list = this.teamChat[player.team];
      list.push(entry);
      if (list.length > 60) list.splice(0, list.length - 60);
      for (const member of this.teamMembers(player.team)) this.sendPrivate(member.id);
      return;
    }
    this.chat.push(entry);
    if (this.chat.length > 80) this.chat.splice(0, this.chat.length - 80);
    this.broadcastState();
  }

  private systemChat(text: string) {
    if (this.phase !== "lobby") return;
    this.chat.push({ id: makeId(), playerId: "", playerName: "", text, sentAt: Date.now(), system: true });
    if (this.chat.length > 80) this.chat.splice(0, this.chat.length - 80);
  }

  private pushLog(text: string) {
    this.log.push({ id: makeId(), text });
    if (this.log.length > 40) this.log.splice(0, this.log.length - 40);
  }

  // ---------- helpers ----------

  private humans(): BattleshipPlayer[] {
    return [...this.players.values()].filter((player) => !player.isBot);
  }

  private teamMembers(team: BattleshipTeam): BattleshipPlayer[] {
    return [...this.players.values()].filter((player) => player.team === team);
  }

  private smallerTeam(): BattleshipTeam {
    const a = this.teamMembers("A").length;
    const b = this.teamMembers("B").length;
    return a <= b ? "A" : "B";
  }

  private boardOf(playerId: string): BoardState | undefined {
    if (this.config.mode === "team") {
      const team = this.players.get(playerId)?.team;
      return team ? this.boards.get(`team-${team}`) : undefined;
    }
    return this.boards.get(playerId);
  }

  private boardName(board: BoardState): string {
    return board.team ? `đội ${TEAM_LABELS[board.team]}` : this.players.get(board.id)?.name ?? "?";
  }

  private openHitCount(board: BoardState): number {
    const sunkCells = new Set([...board.sunk].flatMap((index) => shipCells(board.ships[index], board.size)));
    return [...board.hits].filter((cell) => !sunkCells.has(cell)).length;
  }

  private cellsLeft(board: BoardState): number {
    return board.ships.reduce((total, ship) => total + shipCells(ship, board.size).length, 0) - board.hits.size;
  }

  private transferHost(fromId: string) {
    const from = this.players.get(fromId);
    if (from) from.isHost = false;
    const next = [...this.players.values()].find((player) => player.connected && !player.isBot && player.id !== fromId);
    this.hostId = next?.id ?? null;
    if (next) {
      next.isHost = true;
      this.systemChat(`${next.name} trở thành chủ phòng 👑`);
    }
  }

  private removeBots() {
    for (const [id, player] of [...this.players]) if (player.isBot) this.players.delete(id);
  }

  private enterPhase(phase: BattleshipPhase, durationMs: number, onTimeout: (() => void) | null) {
    this.clearTimer();
    this.phase = phase;
    this.phaseEndsAt = durationMs > 0 ? Date.now() + durationMs : null;
    this.broadcastState();
    this.sendAllPrivate();
    if (durationMs > 0 && onTimeout) this.timer = setTimeout(onTimeout, durationMs);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private later(delayMs: number, fn: () => void) {
    const handle = setTimeout(() => {
      this.botTimers.delete(handle);
      fn();
    }, delayMs);
    this.botTimers.set(handle, fn);
  }

  private clearBotTimers() {
    for (const handle of this.botTimers.keys()) clearTimeout(handle);
    this.botTimers.clear();
  }

  private flushBots() {
    const pending = [...this.botTimers];
    this.botTimers.clear();
    for (const [handle, fn] of pending) {
      clearTimeout(handle);
      fn();
    }
  }

  // ---------- state ----------

  private publicBoard(board: BoardState): PublicBoard {
    return {
      id: board.id,
      ownerIds: board.team ? this.teamMembers(board.team).map((player) => player.id) : [board.id],
      team: board.team,
      size: board.size,
      hits: [...board.hits],
      misses: [...board.misses],
      sunk: [...board.sunk].map((index) => board.ships[index]),
      shipsTotal: board.ships.length,
      alive: board.alive,
    };
  }

  private publicState(): PublicBattleshipState {
    const aimCounts: Record<string, number> = {};
    if (this.config.mode === "ffa") for (const board of this.boards.values()) aimCounts[board.id] = this.aimCount(board.id);
    return {
      roomId: this.party.id,
      phase: this.phase,
      config: this.config,
      hostId: this.hostId,
      players: [...this.players.values()],
      phaseEndsAt: this.phaseEndsAt,
      boards: [...this.boards.values()].map((board) => this.publicBoard(board)),
      turnPlayerId: this.turnPlayerId,
      round: this.round,
      revealUntil: this.revealUntil,
      aimCounts,
      aimCap: this.config.mode === "ffa" && this.phase === "battle" ? this.aimCap() : 0,
      lockedPlayerIds: [...this.locked],
      lastShots: this.lastShots,
      log: this.log,
      chat: this.chat,
      winnerIds: this.winnerIds,
      winnerTeam: this.winnerTeam,
      standings: this.standings,
      revealedFleets: this.phase === "gameEnd" ? this.allFleets() : null,
    };
  }

  private allFleets(): Record<string, ShipPlacement[]> {
    return Object.fromEntries([...this.boards.values()].map((board) => [board.id, board.ships]));
  }

  private privateState(playerId: string): PrivateBattleshipState {
    const player = this.players.get(playerId);
    const board = this.boardOf(playerId);
    const aim = this.aims.get(playerId);
    const team = player?.team ?? null;
    const knockedOut = this.phase === "battle" && this.config.mode === "ffa" && board && !board.alive;
    return {
      myBoardId: board?.id ?? null,
      ships: board?.ships ?? [],
      aimBoardId: aim?.boardId ?? null,
      aimCells: aim?.cells ?? [],
      shotsAllowed: this.shotsAllowed(playerId),
      locked: this.locked.has(playerId),
      teamAims: this.config.mode === "team" && team
        ? [...this.aims].filter(([id]) => id !== playerId && this.players.get(id)?.team === team).map(([id, a]) => ({ playerId: id, cells: a.cells }))
        : [],
      teamChat: this.config.mode === "team" && team ? this.teamChat[team] : [],
      spectatorFleets: knockedOut ? this.allFleets() : null,
    };
  }

  private stateMessage(): BattleshipServerMessage {
    return { type: "state", state: this.publicState() };
  }

  private broadcastState() {
    this.party.broadcast(JSON.stringify(this.stateMessage()));
    this.reportToDirectory();
  }

  // Every open connection for this player, not just the first: after a page
  // refresh the old socket can still be open, and sending only to it left the
  // new tab without its private state (it then couldn't tell which board was
  // its own).
  private sendPrivate(id: string) {
    const message = JSON.stringify({ type: "private_state", state: this.privateState(id) } satisfies BattleshipServerMessage);
    for (const connection of this.party.getConnections()) if (connection.id === id) connection.send(message);
  }

  private sendAllPrivate() {
    for (const id of this.players.keys()) this.sendPrivate(id);
  }

  private sendPrivateToBoard(boardId: string) {
    const board = this.boards.get(boardId);
    if (!board) return;
    if (board.team) for (const member of this.teamMembers(board.team)) this.sendPrivate(member.id);
    else this.sendPrivate(board.id);
  }

  private sendAimUpdate(id: string) {
    const player = this.players.get(id);
    if (this.config.mode === "team" && player?.team) {
      for (const member of this.teamMembers(player.team)) this.sendPrivate(member.id);
    } else this.sendPrivate(id);
  }

  private sendError(connection: Party.Connection, message: string) {
    connection.send(JSON.stringify({ type: "error", message } satisfies BattleshipServerMessage));
  }

  private sendErrorTo(id: string, message: string) {
    const connection = [...this.party.getConnections()].find((candidate) => candidate.id === id);
    if (connection) this.sendError(connection, message);
  }

  private reportToDirectory() {
    const humans = this.humans().filter((player) => player.connected);
    const host = this.hostId ? this.players.get(this.hostId) : undefined;
    const listing: BattleshipRoomListing = {
      roomId: this.party.id,
      hostName: host?.name ?? "",
      playerCount: humans.length,
      maxPlayers: MAX_BATTLESHIP_PLAYERS,
      mode: this.config.mode,
      status: this.phase === "lobby" ? "lobby" : "playing",
    };
    const key = JSON.stringify(listing);
    if (key === this.lastListingKey) return;
    this.lastListingKey = key;
    this.party.context.parties["battleshiplobby"]
      .get("main")
      .fetch({ method: "POST", headers: { "content-type": "application/json" }, body: key })
      .catch(() => {});
  }

  private async reportHistory() {
    if (this.historyReported) return;
    this.historyReported = true;
    if ([...this.players.values()].some((player) => player.isBot)) return; // bot games are practice
    try {
      const base = this.party.env.NEXT_APP_URL as string | undefined;
      if (!base) return;
      const players = [...this.players.values()];
      await fetch(`${base.replace(/\/$/, "")}/api/game-history`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gameType: "battleship",
          roomId: this.party.id,
          players: players.map((player) => ({ name: player.name, score: player.sinks })),
          mode: this.config.mode,
          winnerName: this.winnerTeam ? null : this.winnerIds.map((id) => this.players.get(id)?.name).join(", ") || null,
          winningTeam: this.winnerTeam,
          detail: players.map((player) => ({
            name: player.name,
            team: player.team,
            place: this.standings.find((row) => row.playerId === player.id)?.place ?? null,
            shots: player.shots,
            hits: player.hits,
            sinks: player.sinks,
          })),
          playedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // Best-effort; never break the room.
    }
  }
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
