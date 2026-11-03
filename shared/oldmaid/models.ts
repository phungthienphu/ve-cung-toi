import type { EMOTES } from "./config";

export type SkillType = "peek" | "radar" | "double" | "reverse" | "switch" | "return";

export interface SkillInfo {
  icon: string;
  name: string;
  /** One line on the card itself. */
  short: string;
  /** When it can be played, for the help text and the disabled button. */
  when: string;
  /** Everything it does, for the card's sheet. */
  detail: string;
}

export type PairRule = "rank" | "rankColor";

export type BotLevel = "easy" | "smart";

export interface OldMaidConfig {
  turnSeconds: number;
  /** "rank": any two of a rank pair up. "rankColor": same rank and same colour only (longer rounds). */
  pairRule: PairRule;
  /** Last round's pig deals and draws first. */
  pigDeals: boolean;
  /** Rounds in a set before the final podium; 0 = play on forever. */
  roundsToPlay: number;
  isPublic: boolean;
  botLevel: BotLevel;
  /** Skill cards shuffled into the deck (off = classic Old Maid)… */
  skillsOn: boolean;
  /** …which kinds… */
  skills: SkillType[];
  /** …and how many of each. */
  skillCopies: number;
}

export type Emote = keyof typeof EMOTES;

// ---------- state ----------

export type OldMaidPhase = "lobby" | "dealing" | "playing" | "roundEnd" | "final";

export interface OldMaidPlayer {
  id: string;
  name: string;
  /** 0–5 round the table, or null while watching (joined mid-round or the table is full). */
  seat: number | null;
  isBot: boolean;
  /** A bot playing a disconnected or departed human's hand until the round ends. */
  standIn: boolean;
  connected: boolean;
  disconnectedUntil: number | null;
  ready: boolean;
  cardCount: number;
  /** 1 = first out this round. */
  finishedRank: number | null;
  pigs: number;
  firsts: number;
  rounds: number;
}

export interface OldMaidTurn {
  drawerId: string;
  targetId: string;
  /** When this turn began: names the turn (endsAt moves when a skill adds time). */
  startedAt: number;
  endsAt: number;
  /** Players who have already played a skill card this turn (one each per turn). */
  skillUsers: string[];
  /** "🎭 Đánh tráo" is set: the drawer gets a random other card. */
  switchArmed: boolean;
  /** "🤲 Rút hai": this draw takes a second card too. */
  double: boolean;
  /** "↩️ Đổi hướng": drawing from the left this turn. */
  reversed: boolean;
}

export interface OldMaidRoundRow {
  id: string;
  name: string;
  /** Finishing place; the pig is last. */
  place: number;
  draws: number;
  jokerDraws: number;
}

export interface OldMaidRoundSummary {
  round: number;
  pigId: string;
  pigName: string;
  rows: OldMaidRoundRow[];
  /** Cards still in hand when the round ended (the pig's Joker, any unused skill cards), face up for everyone. */
  leftovers: Record<string, number[]>;
}

export interface OldMaidChatEntry {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  sentAt: number;
  system?: boolean;
}

export interface PublicOldMaidState {
  roomId: string;
  phase: OldMaidPhase;
  config: OldMaidConfig;
  hostId: string | null;
  players: OldMaidPlayer[];
  round: number;
  /** Whose draw it is; null between draws. */
  turn: OldMaidTurn | null;
  /** A card just drawn, still in the drawer's fingers while they check it against their hand. */
  pending: {
    drawerId: string;
    targetId: string;
    since: number;
    endsAt: number;
    /** "🤲 Rút hai": still choosing which of two cards to keep. */
    choosing: boolean;
    /** Players who've played a skill card since the draw (the drawer's own turn limit carries on). */
    skillUsers: string[];
  } | null;
  /** End of the current deal, or of the countdown to the next round. */
  phaseEndsAt: number | null;
  dealerId: string | null;
  /** Slot each player is dangling to tempt the drawer ("nhử"), by player id. */
  teased: Record<string, number>;
  /** Face-up cards thrown away in pairs, oldest first. */
  discard: number[];
  /** The reigning pig: wears the pig hat until a new one is crowned. */
  pigId: string | null;
  lastRound: OldMaidRoundSummary | null;
  nextReadyIds: string[];
  chat: OldMaidChatEntry[];
}

// ---------- messages ----------

/** A card in your own hand. Ids are random per round, so they say nothing about the card. */
export interface OldMaidHandCard {
  id: string;
  card: number;
}

export type OldMaidEvent =
  | { type: "deal"; dealerId: string; counts: Record<string, number> }
  | { type: "pairs"; byPlayer: Record<string, number[]> }
  | {
      type: "drew";
      drawerId: string;
      targetId: string;
      /** The slot actually taken (after any "🎭 Đánh tráo"). */
      slot: number;
      /** The card itself — only sent to the drawer and the one drawn from. */
      card?: number;
      timedOut: boolean;
      /** "🎭 Đánh tráo" sprang: a random other card was taken instead of the one picked. */
      switched: boolean;
      /** "🤲 Rút hai": a second, random card came with it… */
      extraSlot?: number;
      /** …which only the drawer and the one drawn from see. */
      extraCard?: number;
    }
  /** "🤲 Rút hai" settled: one card kept, the other back in the target's hand. Cards only for those who held them. */
  | { type: "kept"; drawerId: string; targetId: string; kept?: number; returned?: number }
  /** The drawn card has been checked: thrown down with its mate (face up for all), kept, or (🛡️) handed back. */
  | { type: "resolved"; drawerId: string; targetId: string; pair: [number, number] | null; returned: boolean }
  /** A skill card played (it goes face up to the middle). */
  | { type: "skill"; playerId: string; skill: SkillType; card: number; targetId?: string; slot?: number }
  /** "🔍 Kính lúp" result — only to the one who used it. */
  | { type: "peeked"; targetId: string; slot: number; card: number }
  /** "📡 Radar heo" result — only to the one who used it. */
  | { type: "radar"; targetId: string; hasJoker: boolean }
  | { type: "shuffled"; playerId: string }
  | { type: "out"; playerId: string; place: number }
  | { type: "pig"; playerId: string };

export type OldMaidClientMessage =
  | { type: "join"; playerId: string; name: string }
  | { type: "take_seat"; seat: number }
  | { type: "set_ready"; ready: boolean }
  | { type: "update_config"; config: Partial<OldMaidConfig> }
  | { type: "add_bot"; seat: number }
  | { type: "remove_bot"; playerId: string }
  | { type: "start_game" }
  | { type: "quick_start"; bots: number }
  | { type: "hover"; slot: number | null }
  | { type: "draw"; slot: number }
  | { type: "shuffle_hand" }
  | { type: "reorder"; order: string[] }
  | { type: "tease"; slot: number | null }
  /** Play a skill card from your hand: a slot for 🔍, a player for 📡. */
  | { type: "use_skill"; cardId: string; slot?: number; targetId?: string }
  /** "🤲 Rút hai": keep the picked card (0) or the extra one (1). */
  | { type: "keep"; which: 0 | 1 }
  | { type: "emote"; emote: Emote }
  | { type: "chat"; text: string }
  | { type: "next_round" }
  | { type: "back_to_lobby" }
  | { type: "new_set" }
  | { type: "leave_room" };

export type OldMaidServerMessage =
  | { type: "state"; state: PublicOldMaidState }
  | { type: "hand"; round: number; cards: OldMaidHandCard[]; drawnId?: string }
  | { type: "event"; event: OldMaidEvent }
  | { type: "hover"; drawerId: string; slot: number | null }
  | { type: "emote"; playerId: string; emote: Emote }
  | { type: "error"; message: string };

export interface OldMaidRoomListing {
  roomId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: "lobby" | "playing";
  /** True to drop the room from the list (it went private or closed). */
  hidden?: boolean;
}
