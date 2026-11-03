

export type BattleshipMode = "solo" | "ffa" | "team";

export type BattleshipTeam = "A" | "B";

export type BattleshipPhase = "lobby" | "placement" | "battle" | "gameEnd";

export type BotLevel = "easy" | "normal";

// ---------- fleet ----------

export type ShipKind = "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";

export interface ShipPlacement {
  kind: ShipKind;
  x: number;
  y: number;
  vertical: boolean;
}

// ---------- room state ----------

export interface BattleshipConfig {
  mode: BattleshipMode;
  /** Seconds per turn (solo) or per round (hỗn chiến / đồng đội). */
  turnSeconds: number;
  /** Ships may not touch each other, even diagonally. */
  noTouching: boolean;
  /** Solo: a hit earns another shot. */
  hitAgain: boolean;
  botCount: number;
  botLevel: BotLevel;
}

export interface BattleshipPlayer {
  id: string;
  name: string;
  connected: boolean;
  disconnectedUntil: number | null;
  isHost: boolean;
  isBot: boolean;
  /** Lobby: "sẵn sàng". Placement: "đã xếp xong". */
  ready: boolean;
  team: BattleshipTeam | null;
  /** Round in which this player's fleet went down (hỗn chiến), or null. */
  eliminatedRound: number | null;
  shots: number;
  hits: number;
  sinks: number;
}

export interface PublicBoard {
  /** Player id in solo/hỗn chiến, "team-A" / "team-B" in đồng đội. */
  id: string;
  ownerIds: string[];
  team: BattleshipTeam | null;
  size: number;
  hits: number[];
  misses: number[];
  sunk: ShipPlacement[];
  shipsTotal: number;
  alive: boolean;
}

export interface ShotEvent {
  id: string;
  shooterId: string;
  boardId: string;
  cell: number;
  result: "miss" | "hit" | "sunk";
  sunkKind?: ShipKind;
}

export interface BattleshipChatEntry {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  sentAt: number;
  system?: boolean;
}

export interface BattleshipStanding {
  playerId: string;
  place: number;
}

export interface PublicBattleshipState {
  roomId: string;
  phase: BattleshipPhase;
  config: BattleshipConfig;
  hostId: string | null;
  players: BattleshipPlayer[];
  phaseEndsAt: number | null;
  boards: PublicBoard[];
  /** Solo: whose turn it is. */
  turnPlayerId: string | null;
  /** Hỗn chiến / đồng đội: round number and the post-round reveal pause. */
  round: number;
  revealUntil: number | null;
  /** Hỗn chiến: how many shots are aimed at each board this round (for the cap). */
  aimCounts: Record<string, number>;
  /** Max shots a single board can take per round (hỗn chiến). */
  aimCap: number;
  lockedPlayerIds: string[];
  lastShots: ShotEvent[];
  log: { id: string; text: string }[];
  chat: BattleshipChatEntry[];
  winnerIds: string[];
  winnerTeam: BattleshipTeam | null;
  standings: BattleshipStanding[];
  /** Every fleet, only once the game is over. */
  revealedFleets: Record<string, ShipPlacement[]> | null;
}

export interface PrivateBattleshipState {
  myBoardId: string | null;
  /** Your fleet (or your team's shared fleet). */
  ships: ShipPlacement[];
  /** This round's aims (your own). */
  aimBoardId: string | null;
  aimCells: number[];
  shotsAllowed: number;
  locked: boolean;
  /** Đồng đội: where teammates are aiming right now. */
  teamAims: Array<{ playerId: string; cells: number[] }>;
  teamChat: BattleshipChatEntry[];
  /** Knocked-out players watch with every fleet visible. */
  spectatorFleets: Record<string, ShipPlacement[]> | null;
}

export interface BattleshipRoomListing {
  roomId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  mode: BattleshipMode;
  status: "lobby" | "playing";
}

export type BattleshipClientMessage =
  | { type: "join"; playerId: string; name: string }
  | { type: "chat"; text: string; teamOnly?: boolean }
  | { type: "set_ready"; ready: boolean }
  | { type: "update_config"; config: BattleshipConfig }
  | { type: "choose_team"; team: BattleshipTeam }
  | { type: "shuffle_teams" }
  | { type: "start_game" }
  | { type: "place_ships"; ships: ShipPlacement[] }
  | { type: "random_ships" }
  | { type: "shoot"; cell: number }
  | { type: "aim"; boardId: string; cell: number }
  | { type: "lock_aim" }
  | { type: "play_again" }
  | { type: "leave_room" };

export type BattleshipServerMessage =
  | { type: "state"; state: PublicBattleshipState }
  | { type: "private_state"; state: PrivateBattleshipState }
  | { type: "error"; message: string };
