

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

export interface WerewolfConfig {
  discussionSeconds: number;
  votingSeconds: number;
  revealRoleOnDeath: boolean;
  witchCanSelfSave: boolean;
  /** Bots added at game start to fill up the table (0 = humans only). */
  botCount: number;
}

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
  /** When the current phase began, and a per-phase random number shared by
   * every client so the narrator picks the same caption line everywhere. */
  phaseStartedAt: number | null;
  narrationSeed: number;
  nightDeaths: string[];
  lastVoteResult: VoteResult[];
  lastVotes: WerewolfBallot[];
  /** Who has already voted during the voting phase (not for whom). */
  votedPlayerIds: string[];
  /** Players who tapped "continue" on the vote-result screen; once every
   * living connected player has, the phase skips its remaining time. */
  resultAckedIds: string[];
  /** Living players who tapped "sẵn sàng bỏ phiếu" during discussion; once
   * every living, connected human has, the talk ends early. */
  readyToVoteIds: string[];
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
  /** Who the witch's chosen poison will hit (only set with decision "poison"). */
  witchPoisonTargetId: string | null;
  seerHistory: SeerResult[];
  suspicionHistory: SuspicionEntry[];
  lastGuardedPlayerId: string | null;
  suspicionTargetId: string | null;
  voteTargetId: string | null;
  voteReason: string;
  /** Explicitly chose "bỏ qua" (blank ballot) this vote — counts as voted. */
  voteSkipped: boolean;
  /** Only sent to dead players (spectators): every player's true role. */
  allRoles: Record<string, WerewolfRole> | null;
  /** Tapped "xong" for the current night step (see ack_night). */
  nightDone: boolean;
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
  | { type: "skip_vote" }
  | { type: "chat"; text: string }
  | { type: "ready_to_vote"; ready: boolean }
  | { type: "ack_night" }
  | { type: "ack_result" }
  | { type: "play_again" }
  | { type: "leave_room" };

export type WerewolfServerMessage =
  | { type: "state"; state: PublicWerewolfState }
  | { type: "private_state"; state: PrivateWerewolfState }
  | { type: "error"; message: string }
  | { type: "kicked" };
