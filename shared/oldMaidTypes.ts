// Ai Là Heo — Old Maid with a Joker as the "heo" (pig). Rules, constants and
// the messages shared by party/oldmaid-server.ts and the client. Spec:
// docs/ai-la-heo-spec.md.
//
// A card is 0–51 as in a French deck (suit = floor(id / 13): ♠ ♥ ♦ ♣,
// rank = id % 13: A … K), plus JOKER = 52, the pig nobody can pair.

export const JOKER = 52;
export const DECK = Array.from({ length: 53 }, (_, id) => id);
export const MAX_SEATS = 6;
export const MIN_PLAYERS = 2;
/** Watchers allowed on top of the seats, so a public room can't be flooded. */
export const MAX_ROOM_PEOPLE = 12;

export const RECONNECT_GRACE_MS = 30_000;
/** Cards flying out to every hand. */
export const DEAL_MS = 3200;
/** The opening pairs flying to the middle of the table. */
export const OPENING_PAIRS_MS = 2200;
/** A drawn card stays in the drawer's fingers while they check it against their hand ("dò lá"). */
export const DRAW_PEEK_MS = 1600;
/** After the check: a pair thrown slowly down to the middle… */
export const PAIR_THROW_MS = 1300;
/** …or an unmatched card slipped into the hand. Then the next turn starts. */
export const KEEP_SETTLE_MS = 600;
export const NEXT_ROUND_MS = 15_000;
export const TURN_SECONDS = [10, 15, 20] as const;
export const ROUNDS_TO_PLAY = [0, 5, 10] as const;
export const EMOTE_COOLDOWN_MS = 1500;

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
}

export const DEFAULT_OLDMAID_CONFIG: OldMaidConfig = {
  turnSeconds: 15,
  pairRule: "rank",
  pigDeals: true,
  roundsToPlay: 0,
  isPublic: true,
  botLevel: "smart",
};

export const PAIR_RULE_LABELS: Record<PairRule, string> = { rank: "Cùng số", rankColor: "Cùng số & cùng màu" };

export const rankOf = (card: number) => card % 13;
export const isRed = (card: number) => {
  const suit = Math.floor(card / 13);
  return suit === 1 || suit === 2;
};

/** What two cards must share to pair up, or null for the Joker. */
export function pairKey(card: number, rule: PairRule): string | null {
  if (card === JOKER) return null;
  return rule === "rank" ? String(rankOf(card)) : `${rankOf(card)}${isRed(card) ? "r" : "b"}`;
}

export function isPair(a: number, b: number, rule: PairRule): boolean {
  const key = pairKey(a, rule);
  return a !== b && key !== null && key === pairKey(b, rule);
}

/** Splits a hand into the pairs it can throw away and the cards it keeps (in their order). */
export function splitPairs<T>(hand: T[], cardOf: (item: T) => number, rule: PairRule): { pairs: [T, T][]; rest: T[] } {
  const open = new Map<string, T>();
  const pairs: [T, T][] = [];
  const paired = new Set<T>();
  for (const item of hand) {
    const key = pairKey(cardOf(item), rule);
    if (key === null) continue;
    const mate = open.get(key);
    if (mate === undefined) {
      open.set(key, item);
      continue;
    }
    pairs.push([mate, item]);
    paired.add(mate);
    paired.add(item);
    open.delete(key);
  }
  return { pairs, rest: hand.filter((item) => !paired.has(item)) };
}

/** Turn order runs up the seat numbers (clockwise round the table, to each player's left). The next of `seats` after `seat`. */
export function seatAfter(seats: number[], seat: number): number | undefined {
  const sorted = [...seats].sort((a, b) => a - b);
  return sorted.find((candidate) => candidate > seat) ?? sorted[0];
}

/** The previous of `seats` before `seat` — the player on your right, whose cards you draw from. */
export function seatBefore(seats: number[], seat: number): number | undefined {
  const sorted = [...seats].sort((a, b) => b - a);
  return sorted.find((candidate) => candidate < seat) ?? sorted[0];
}

export const EMOTES = { smirk: "😏", scared: "😱", shh: "🤫", please: "🙏", lol: "😂", oink: "🐷", eyes: "👀" } as const;
export type Emote = keyof typeof EMOTES;
export const isEmote = (value: unknown): value is Emote => typeof value === "string" && value in EMOTES;

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
  endsAt: number;
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
  pending: { drawerId: string; targetId: string; since: number } | null;
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
      slot: number;
      /** The card itself — only sent to the drawer and the one drawn from. */
      card?: number;
      timedOut: boolean;
    }
  /** The drawn card has been checked: thrown down with its mate (face up for all), or kept. */
  | { type: "resolved"; drawerId: string; pair: [number, number] | null }
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
