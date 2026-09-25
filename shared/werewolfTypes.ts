export const MIN_WEREWOLF_PLAYERS = 5;
export const MAX_WEREWOLF_PLAYERS = 12;

export type WerewolfRole = "villager" | "wolf" | "seer" | "guardian" | "witch";
export type WerewolfTeam = "village" | "wolves";
export type WerewolfPhase =
  | "lobby"
  | "roleReveal"
  | "nightExplore"
  | "wolfLock"
  | "nightResolve"
  | "dawn"
  | "discussion"
  | "voting"
  | "voteResult"
  | "gameEnd";

export const ROLE_LABELS: Record<WerewolfRole, string> = {
  villager: "Dân làng",
  wolf: "Ma sói",
  seer: "Tiên tri",
  guardian: "Bảo vệ",
  witch: "Phù thủy",
};

export const ROLE_EMOJI: Record<WerewolfRole, string> = {
  villager: "🧑‍🌾",
  wolf: "🐺",
  seer: "🔮",
  guardian: "🛡️",
  witch: "🧪",
};

export interface WerewolfConfig {
  discussionSeconds: number;
  votingSeconds: number;
  revealRoleOnDeath: boolean;
  witchCanSelfSave: boolean;
  /** Bots added at game start to fill up the table (0 = humans only). */
  botCount: number;
}

export const DEFAULT_WEREWOLF_CONFIG: WerewolfConfig = {
  discussionSeconds: 120,
  votingSeconds: 30,
  revealRoleOnDeath: true,
  witchCanSelfSave: true,
  botCount: 0,
};

export interface WerewolfPlayer {
  id: string;
  name: string;
  avatarSeed: string;
  connected: boolean;
  /** Set while the player is offline: when their reconnect grace period ends. */
  disconnectedUntil: number | null;
  alive: boolean;
  ready: boolean;
  isHost: boolean;
  revealedRole: WerewolfRole | null;
  isBot?: boolean;
}

export interface VoteResult {
  playerId: string;
  votes: number;
}

/** One villager's ballot, revealed to everyone once voting closes — so the
 * table can call people out ("sao bạn bầu tôi?") instead of only seeing totals. */
export interface WerewolfBallot {
  voterId: string;
  targetId: string | null;
  reason: string;
}

/** One open lobby as shown on the home screen's room list. */
export interface WerewolfRoomListing {
  roomId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: "lobby" | "playing";
}

export const MAX_VOTE_REASON_LENGTH = 120;
export const RECONNECT_GRACE_MS = 30_000;
export const MID_GAME_JOIN_MESSAGE = "Ngôi làng này đang yên ổn, bạn đừng vào :)))";

export interface WerewolfChatEntry {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  sentAt: number;
  /** Server-generated notice (someone joined/left), not a player message. */
  system?: boolean;
}

export interface WerewolfGameEvent {
  id: string;
  day: number;
  type: "night_death" | "vote_elimination" | "peaceful_night";
  playerIds: string[];
}

export interface SuspicionStatistic {
  playerId: string;
  nightVotes: number;
  dayVotes: number;
  weightedScore: number;
  percentage: number;
}

export interface NightSuspicionResult {
  night: number;
  totalVotes: number;
  results: Array<{
    playerId: string;
    votes: number;
    percentage: number;
  }>;
}

export interface PublicWerewolfState {
  roomId: string;
  phase: WerewolfPhase;
  day: number;
  hostId: string | null;
  players: WerewolfPlayer[];
  config: WerewolfConfig;
  phaseEndsAt: number | null;
  nightDeaths: string[];
  lastVoteResult: VoteResult[];
  lastVotes: WerewolfBallot[];
  /** Who has already voted during the voting phase (not for whom). */
  votedPlayerIds: string[];
  /** Players who tapped "continue" on the vote-result screen; once every
   * living connected player has, the phase skips its remaining time. */
  resultAckedIds: string[];
  chat: WerewolfChatEntry[];
  events: WerewolfGameEvent[];
  suspicionStats: SuspicionStatistic[];
  lastNightSuspicion: NightSuspicionResult | null;
  winner: WerewolfTeam | null;
}

export interface WolfChoice {
  wolfId: string;
  targetId: string | null;
  locked: boolean;
}

export interface SeerResult {
  night: number;
  targetId: string;
  isWolf: boolean;
}

export interface SuspicionEntry {
  night: number;
  targetId: string;
}

export interface PrivateWerewolfState {
  role: WerewolfRole | null;
  teammates: string[];
  previewTargetId: string | null;
  lockedTargetId: string | null;
  wolfChoices: WolfChoice[];
  witchVictimId: string | null;
  healAvailable: boolean;
  poisonAvailable: boolean;
  witchDecision: "heal" | "poison" | "skip" | null;
  seerHistory: SeerResult[];
  suspicionHistory: SuspicionEntry[];
  lastGuardedPlayerId: string | null;
  suspicionTargetId: string | null;
  voteTargetId: string | null;
  voteReason: string;
  /** Only sent to dead players (spectators): every player's true role. */
  allRoles: Record<string, WerewolfRole> | null;
}

export type WerewolfClientMessage =
  | { type: "join"; playerId: string; name: string }
  | { type: "set_ready"; ready: boolean }
  | { type: "update_config"; config: WerewolfConfig }
  | { type: "start_game" }
  | { type: "ack_role" }
  | { type: "preview_target"; targetId: string }
  | { type: "lock_target"; targetId: string }
  | { type: "set_suspicion"; targetId: string }
  | { type: "witch_decision"; decision: "heal" | "poison" | "skip"; targetId?: string }
  | { type: "cast_vote"; targetId: string | null; reason?: string }
  | { type: "chat"; text: string }
  | { type: "end_discussion" }
  | { type: "ack_result" }
  | { type: "play_again" }
  | { type: "leave_room" };

export type WerewolfServerMessage =
  | { type: "state"; state: PublicWerewolfState }
  | { type: "private_state"; state: PrivateWerewolfState }
  | { type: "error"; message: string }
  | { type: "kicked" };

const ROLE_PRESETS: Record<number, WerewolfRole[]> = {
  5: ["wolf", "seer", "villager", "villager", "villager"],
  6: ["wolf", "seer", "guardian", "villager", "villager", "villager"],
  7: ["wolf", "wolf", "seer", "villager", "villager", "villager", "villager"],
  8: ["wolf", "wolf", "seer", "guardian", "villager", "villager", "villager", "villager"],
  9: ["wolf", "wolf", "seer", "guardian", "witch", "villager", "villager", "villager", "villager"],
  10: ["wolf", "wolf", "wolf", "seer", "guardian", "villager", "villager", "villager", "villager", "villager"],
};

export function rolesForPlayerCount(count: number): WerewolfRole[] {
  const preset = ROLE_PRESETS[count];
  if (preset) return [...preset];

  const fixedRoles: WerewolfRole[] = ["wolf", "wolf", "wolf", "seer", "guardian", "witch"];
  const villagers = Array<WerewolfRole>(Math.max(0, count - fixedRoles.length)).fill("villager");
  return [...fixedRoles, ...villagers];
}
