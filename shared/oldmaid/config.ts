import type { SkillType, SkillInfo, OldMaidConfig, PairRule, Emote } from "./models";

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

export const SKILL_ORDER: SkillType[] = ["peek", "radar", "double", "reverse", "switch", "return"];

export const SKILL_BASE = 60;

/** Copies of each chosen skill in the deck. */
export const SKILL_COPIES = [1, 2] as const;

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

export const EMOTES = { smirk: "😏", scared: "😱", shh: "🤫", please: "🙏", lol: "😂", oink: "🐷", eyes: "👀" } as const;

export const isEmote = (value: unknown): value is Emote => typeof value === "string" && value in EMOTES;
