// Ai Là Heo — Old Maid with a Joker as the "heo" (pig). Rules, constants and
// the messages shared by party/oldmaid-server.ts and the client. Spec:
// docs/ai-la-heo-spec.md.
//
// A card is 0–51 as in a French deck (suit = floor(id / 13): ♠ ♥ ♦ ♣,
// rank = id % 13: A … K), plus JOKER = 52, the pig nobody can pair, plus
// (when the room turns them on) skill cards from SKILL_BASE up: shuffled in
// like any card, used once by whoever holds them, never paired.

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
/** With skill cards in play the check lasts longer for everyone, so a "🛡️ Trả lại" decision fits and its timing gives nothing away. */
export const SKILL_PEEK_MS = 2600;
/** "🤲 Rút hai": time to pick which of the two cards to keep. */
export const DOUBLE_CHOOSE_MS = 6000;
/** A skill used on your own turn tops the clock up to at least this much. */
export const SKILL_TIME_FLOOR_MS = 8000;
/** The "tung chiêu" moment every screen shows when a skill card is played; a turn it ends waits this long. */
export const SKILL_SHOW_MS = 1800;

// ---------- skill cards ----------

export type SkillType = "peek" | "radar" | "double" | "reverse" | "switch" | "return";
export const SKILL_ORDER: SkillType[] = ["peek", "radar", "double", "reverse", "switch", "return"];
export const SKILL_BASE = 60;
/** Copies of each chosen skill in the deck. */
export const SKILL_COPIES = [1, 2] as const;

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

export const SKILLS: Record<SkillType, SkillInfo> = {
  peek: {
    icon: "🔍",
    name: "Kính lúp",
    short: "Soi trước 1 lá",
    when: "Dùng khi tới lượt bạn rút",
    detail: "Chạm vào 1 lá của người bị rút để xem trước (chỉ bạn thấy), rồi rút lá đó hay đổi lá tùy bạn. Cả bàn thấy bạn soi lá nào — người kia có thể xào để phá.",
  },
  radar: {
    icon: "📡",
    name: "Radar heo",
    short: "Ai đang giữ heo?",
    when: "Dùng khi tới lượt bạn rút",
    detail: "Chọn 1 người: bạn biết họ CÓ hay KHÔNG giữ con heo (không biết ở lá nào).",
  },
  double: {
    icon: "🤲",
    name: "Rút hai",
    short: "Rút 2, giữ 1",
    when: "Dùng khi tới lượt bạn rút",
    detail: "Lượt này bạn rút lá đã chọn và thêm 1 lá ngẫu nhiên, xem cả hai rồi giữ 1 lá, lá kia trả về.",
  },
  reverse: {
    icon: "↩️",
    name: "Đổi hướng",
    short: "Rút người bên trái",
    when: "Dùng khi tới lượt bạn rút",
    detail: "Lượt này bạn rút bài người bên trái thay vì bên phải — né người đang nghi giữ heo.",
  },
  switch: {
    icon: "🎭",
    name: "Đánh tráo",
    short: "Họ nhận lá khác",
    when: "Dùng khi đang có người rút bài bạn",
    detail: "Giăng bẫy trước khi họ bấm: lá họ chọn bị tráo thành 1 lá ngẫu nhiên khác trên tay bạn. Cả bàn thấy bẫy được giăng.",
  },
  return: {
    icon: "🛡️",
    name: "Trả lại",
    short: "Trả lá vừa rút",
    when: "Dùng lúc đang dò lá vừa rút",
    detail: "Vừa rút xong, bấm để trả lá đó về tay người kia. Không ai biết chắc đó có phải con heo — dùng để né heo, hay để lừa cả bàn.",
  },
};

export const isSkill = (card: number) => card >= SKILL_BASE;
export const skillOf = (card: number): SkillType => SKILL_ORDER[(card - SKILL_BASE) % SKILL_ORDER.length];

/** Skill cards are in play this round: switched on, with at least one kind chosen. */
export const skillsInPlay = (config: OldMaidConfig) => config.skillsOn && config.skills.length > 0;

/** The skill cards of a deck: each chosen kind, `copies` times. Ids are unique per deck. */
export function skillDeck(config: OldMaidConfig): number[] {
  if (!skillsInPlay(config)) return [];
  return Array.from({ length: config.skillCopies }, (_, copy) =>
    config.skills.map((type) => SKILL_BASE + copy * SKILL_ORDER.length + SKILL_ORDER.indexOf(type)),
  ).flat();
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

export const DEFAULT_OLDMAID_CONFIG: OldMaidConfig = {
  turnSeconds: 15,
  pairRule: "rank",
  pigDeals: true,
  roundsToPlay: 0,
  isPublic: true,
  botLevel: "smart",
  skillsOn: true,
  skills: [...SKILL_ORDER],
  skillCopies: 1,
};

export const PAIR_RULE_LABELS: Record<PairRule, string> = { rank: "Cùng số", rankColor: "Cùng số & cùng màu" };

export const rankOf = (card: number) => card % 13;
export const isRed = (card: number) => {
  const suit = Math.floor(card / 13);
  return suit === 1 || suit === 2;
};

/** What two cards must share to pair up, or null for the Joker and skill cards. */
export function pairKey(card: number, rule: PairRule): string | null {
  if (card === JOKER || isSkill(card)) return null;
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
