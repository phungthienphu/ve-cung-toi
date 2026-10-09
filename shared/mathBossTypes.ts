// "Quái Máy Tính" — the opening-session game for Math Quest (see
// docs/math-quest-design-spec.md). The tutor's laptop is the shared "host"
// screen; students answer on their phones. It's a side-on shooter: each
// student's stick-figure archer/gunner stands on the left, the monster walks
// in from the right throwing every student a question from *their own*
// grade's current chapter (Kết nối tri thức): grade 8 — hằng đẳng thức,
// grade 9 — PT & BPT bậc nhất. A right answer fires a shot at it.

export type MathBossPhase =
  | "lobby"
  | "pick" // character select
  | "show" // tutor beats the calculator with a hằng đẳng thức, 3 times
  | "intro" // the formula cards for the next wave, or the rage warning (wave 4)
  | "question"
  | "result"
  | "victory"
  | "vote" // world theme + team name for Math Quest
  | "done";

export type Grade = 8 | 9;
export type HeroWeapon = "bow" | "gun";
export type HeroColor = "red" | "orange" | "green" | "cyan" | "blue" | "pink";

export interface HeroChoice {
  weapon: HeroWeapon;
  color: HeroColor;
}

export const WEAPONS: { id: HeroWeapon; name: string; icon: string; pitch: string }[] = [
  { id: "bow", name: "Cung thủ", icon: "🏹", pitch: "Bắn tên, bách phát bách trúng" },
  { id: "gun", name: "Xạ thủ", icon: "🔫", pitch: "Nã đạn nhanh như chớp" },
];

export const HERO_COLORS: Record<HeroColor, string> = {
  red: "#fb7185",
  orange: "#fb923c",
  green: "#4ade80",
  cyan: "#22d3ee",
  blue: "#818cf8",
  pink: "#f472b6",
};
export const GRADES: Grade[] = [8, 9];
export type ThemeId = "mage" | "arena" | "tamer";
/**
 * Question generators ("dạng"). Each powers the notebook's quick practice
 * of its lesson; the tutor picks which ones a boss fight drills.
 */
export type TopicId =
  | "g8-monomial" | "g8-polyadd" | "g8-polymul" | "g8-polydiv"
  | "g8-square" | "g8-diffsq" | "g8-evaluate" | "g8-cube" | "g8-sumcubes" | "g8-factor"
  | "g9-pairsol" | "g9-system" | "g9-wordsys"
  | "g9-product" | "g9-domain" | "g9-inequality" | "g9-ineqprop"
  | "g9-sqrt" | "g9-sqrtmul" | "g9-sqrtsimplify" | "g9-cbrt";

export interface TopicInfo {
  id: TopicId;
  grade: Grade;
  icon: string;
  name: string;
  formulas: string[];
  rule: string;
  example: { prompt: string; steps: string[] };
}

// SGK style: no separator up to 4 digits, a (narrow) space between groups
// above that — "10 000", never "10.000", which kids could read as a decimal.
const fmt = (n: number) => {
  const text = Math.abs(n) < 10_000 ? String(Math.abs(n)) : Math.abs(n).toLocaleString("en-US").replace(/,/g, "\u202f");
  return n < 0 ? `−${text}` : text;
};

/** What a boss wave's formula card shows for each dạng. */
export const TOPIC_CATALOG: Record<TopicId, TopicInfo> = Object.fromEntries(
  ([
    {
      id: "g8-monomial", grade: 8, icon: "🔹", name: "Đơn thức",
      formulas: ["xᵐ · xⁿ = xᵐ⁺ⁿ"],
      rule: "Nhân hệ số với hệ số, cộng số mũ của cùng một biến. Bậc là tổng số mũ các biến.",
      example: { prompt: "Thu gọn (3x²y)·(−2xy³)", steps: ["Hệ số: 3·(−2) = −6", "= −6x³y⁴"] },
    },
    {
      id: "g8-polyadd", grade: 8, icon: "➕", name: "Cộng, trừ đa thức",
      formulas: ["−(A − B + C) = −A + B − C"],
      rule: "Bỏ ngoặc (trước ngoặc có dấu trừ thì đổi dấu mọi hạng tử), rồi gom các hạng tử đồng dạng.",
      example: { prompt: "(3x² − 2x + 1) − (x² + 5x − 4)", steps: ["= 3x² − 2x + 1 − x² − 5x + 4", "= 2x² − 7x + 5"] },
    },
    {
      id: "g8-polymul", grade: 8, icon: "✖️", name: "Nhân đa thức",
      formulas: ["A(B + C) = AB + AC", "(A + B)(C + D) = AC + AD + BC + BD"],
      rule: "Nhân từng hạng tử của đa thức này với từng hạng tử của đa thức kia rồi thu gọn.",
      example: { prompt: "(x + 2)(x − 5)", steps: ["= x² − 5x + 2x − 10", "= x² − 3x − 10"] },
    },
    {
      id: "g8-polydiv", grade: 8, icon: "➗", name: "Chia đa thức cho đơn thức",
      formulas: ["(A + B) : C = A : C + B : C", "xᵐ : xⁿ = xᵐ⁻ⁿ"],
      rule: "Chia từng hạng tử cho đơn thức: chia hệ số, trừ số mũ của cùng biến.",
      example: { prompt: "(6x³ − 9x²) : 3x", steps: ["6x³ : 3x = 2x²; −9x² : 3x = −3x", "= 2x² − 3x"] },
    },
    {
      id: "g8-square", grade: 8, icon: "🔥", name: "Bình phương của một tổng, một hiệu",
      formulas: ["(a + b)² = a² + 2ab + b²", "(a − b)² = a² − 2ab + b²"],
      rule: "Bình phương số thứ nhất, cộng (hoặc trừ) hai lần tích, cộng bình phương số thứ hai.",
      example: { prompt: "Khai triển (x + 3)²", steps: ["(x + 3)² = x² + 2·x·3 + 3²", "= x² + 6x + 9"] },
    },
    {
      id: "g8-diffsq", grade: 8, icon: "🪞", name: "Hiệu hai bình phương",
      formulas: ["a² − b² = (a − b)(a + b)"],
      rule: "Hiệu hai bình phương bằng hiệu nhân tổng.",
      example: { prompt: "Viết x² − 16 thành tích", steps: ["x² − 16 = x² − 4²", "= (x − 4)(x + 4)"] },
    },
    {
      id: "g8-evaluate", grade: 8, icon: "🎯", name: "Tính nhanh bằng hằng đẳng thức",
      formulas: ["x² + 2ax + a² = (x + a)²", "x² − 2ax + a² = (x − a)²"],
      rule: "Nhận ra hằng đẳng thức, viết gọn thành bình phương rồi mới thay số.",
      example: { prompt: "Tính A = x² + 6x + 9 tại x = 7", steps: ["x² + 6x + 9 = (x + 3)²", "Tại x = 7: (7 + 3)² = 10² = 100"] },
    },
    {
      id: "g8-cube", grade: 8, icon: "🧊", name: "Lập phương của một tổng, một hiệu",
      formulas: ["(a + b)³ = a³ + 3a²b + 3ab² + b³", "(a − b)³ = a³ − 3a²b + 3ab² − b³"],
      rule: "Hệ số 1 – 3 – 3 – 1; với lập phương một hiệu thì dấu đan xen +, −, +, −.",
      example: { prompt: "Khai triển (x + 2)³", steps: ["= x³ + 3·x²·2 + 3·x·2² + 2³", "= x³ + 6x² + 12x + 8"] },
    },
    {
      id: "g8-sumcubes", grade: 8, icon: "🎁", name: "Tổng và hiệu hai lập phương",
      formulas: ["a³ + b³ = (a + b)(a² − ab + b²)", "a³ − b³ = (a − b)(a² + ab + b²)"],
      rule: "Ngoặc thứ hai chỉ có ab (không phải 2ab), dấu ngược với ngoặc đầu.",
      example: { prompt: "Viết x³ + 8 thành tích", steps: ["x³ + 8 = x³ + 2³", "= (x + 2)(x² − 2x + 4)"] },
    },
    {
      id: "g8-factor", grade: 8, icon: "🧩", name: "Phân tích đa thức thành nhân tử",
      formulas: ["AB + AC = A(B + C)"],
      rule: "Thử lần lượt: đặt nhân tử chung → dùng hằng đẳng thức → nhóm hạng tử.",
      example: { prompt: "Phân tích 2x² − 8", steps: ["= 2(x² − 4)", "= 2(x − 2)(x + 2)"] },
    },
    {
      id: "g9-pairsol", grade: 9, icon: "📍", name: "Nghiệm của phương trình hai ẩn",
      formulas: ["(x₀; y₀) là nghiệm ⇔ ax₀ + by₀ = c"],
      rule: "Thay x = x₀, y = y₀ vào phương trình; ra đẳng thức đúng thì là nghiệm.",
      example: { prompt: "(1; 3) có là nghiệm của 2x + y = 5?", steps: ["2·1 + 3 = 5", "Đúng ⇒ là nghiệm"] },
    },
    {
      id: "g9-system", grade: 9, icon: "🔗", name: "Giải hệ hai phương trình",
      formulas: ["Phương pháp thế", "Phương pháp cộng đại số"],
      rule: "Rút một ẩn rồi thế vào phương trình kia, hoặc cộng/trừ hai phương trình để khử một ẩn.",
      example: { prompt: "x + y = 5; x − y = 1", steps: ["Cộng hai phương trình: 2x = 6 ⇒ x = 3", "y = 5 − 3 = 2"] },
    },
    {
      id: "g9-wordsys", grade: 9, icon: "📝", name: "Giải toán bằng cách lập hệ",
      formulas: ["Chọn ẩn → lập hệ → giải → trả lời"],
      rule: "Gọi hai đại lượng chưa biết là x, y; dịch mỗi dữ kiện thành một phương trình.",
      example: { prompt: "36 con gà và chó, 100 chân. Bao nhiêu con chó?", steps: ["x + y = 36; 2x + 4y = 100", "2y = 100 − 72 = 28 ⇒ y = 14"] },
    },
    {
      id: "g9-product", grade: 9, icon: "⚡", name: "Phương trình tích",
      formulas: ["A·B = 0 ⇔ A = 0 hoặc B = 0"],
      rule: "Cho từng thừa số bằng 0 rồi giải từng phương trình nhỏ.",
      example: { prompt: "Giải (x − 2)(x + 5) = 0", steps: ["x − 2 = 0 ⇒ x = 2", "x + 5 = 0 ⇒ x = −5"] },
    },
    {
      id: "g9-domain", grade: 9, icon: "🛡️", name: "Điều kiện xác định",
      formulas: ["Mọi mẫu thức ≠ 0"],
      rule: "Phương trình chứa ẩn ở mẫu chỉ xác định khi mọi mẫu khác 0.",
      example: { prompt: "ĐKXĐ của 3/(x − 2) + 1/(x + 1) = 2", steps: ["x − 2 ≠ 0 ⇒ x ≠ 2", "x + 1 ≠ 0 ⇒ x ≠ −1"] },
    },
    {
      id: "g9-ineqprop", grade: 9, icon: "📐", name: "Tính chất của bất đẳng thức",
      formulas: ["a > b ⇒ a + c > b + c", "a > b, c < 0 ⇒ ac < bc"],
      rule: "Cộng, trừ hoặc nhân với số dương: giữ chiều. Nhân với số âm: đổi chiều.",
      example: { prompt: "Cho a > b. So sánh −3a và −3b", steps: ["Nhân hai vế với −3 < 0: đổi chiều", "−3a < −3b"] },
    },
    {
      id: "g9-inequality", grade: 9, icon: "⚖️", name: "Bất phương trình bậc nhất",
      formulas: ["ax + b > 0 ⇔ ax > −b", "Chia cho số âm thì đổi chiều"],
      rule: "Chuyển vế, rồi chia hai vế cho hệ số của x. Chia cho số âm phải đổi chiều bất đẳng thức.",
      example: { prompt: "Giải 2x − 6 > 0", steps: ["2x > 6", "x > 3 (chia cho 2 > 0, giữ chiều)"] },
    },
    {
      id: "g9-sqrt", grade: 9, icon: "🌱", name: "Căn bậc hai",
      formulas: ["√(A²) = |A|", "√A xác định ⇔ A ≥ 0"],
      rule: "Căn bậc hai số học của a là số không âm có bình phương bằng a.",
      example: { prompt: "ĐKXĐ của √(2x − 6)", steps: ["2x − 6 ≥ 0", "x ≥ 3"] },
    },
    {
      id: "g9-sqrtmul", grade: 9, icon: "✳️", name: "Khai căn với phép nhân, phép chia",
      formulas: ["√A · √B = √(AB)", "√A : √B = √(A : B)"],
      rule: "Gộp vào một dấu căn rồi khai căn số chính phương.",
      example: { prompt: "√3 · √12", steps: ["= √36", "= 6"] },
    },
    {
      id: "g9-sqrtsimplify", grade: 9, icon: "🧹", name: "Rút gọn biểu thức chứa căn",
      formulas: ["√(A²B) = |A|√B", "a/√b = a√b / b"],
      rule: "Đưa thừa số ra ngoài dấu căn để có các căn đồng dạng, rồi cộng trừ hệ số.",
      example: { prompt: "√12 + √27", steps: ["= 2√3 + 3√3", "= 5√3"] },
    },
    {
      id: "g9-cbrt", grade: 9, icon: "🧊", name: "Căn bậc ba",
      formulas: ["∛a = x ⇔ x³ = a", "∛(−a) = −∛a"],
      rule: "Mọi số (kể cả số âm) đều có đúng một căn bậc ba.",
      example: { prompt: "∛(−27)", steps: ["(−3)³ = −27", "⇒ ∛(−27) = −3"] },
    },
  ] satisfies TopicInfo[]).map((topic) => [topic.id, topic])
) as Record<TopicId, TopicInfo>;

/**
 * How a fight is set up: per grade, the dạng to drill — one wave each, in
 * this order — then a final "rage" wave mixing them all.
 */
export interface MathBossConfig {
  topics: Record<Grade, TopicId[]>;
  questionsPerWave: number;
  /** Open with the tutor-vs-calculator show. */
  showDemo: boolean;
}

export const QUESTIONS_PER_WAVE_OPTIONS = [3, 5, 7];
export const MAX_TOPICS_PER_GRADE = 8;
export const DEFAULT_MATH_BOSS_CONFIG: MathBossConfig = {
  topics: { 8: ["g8-square", "g8-diffsq", "g8-evaluate"], 9: ["g9-product", "g9-domain", "g9-inequality"] },
  questionsPerWave: 5,
  showDemo: true,
};

/** The wave after the last chosen dạng is the mixed, harder rage wave. */
export const isRageWave = (wave: number, topicWaves: number) => wave > topicWaves;

/**
 * The tutor's "magic show": the calculator grinds through the arithmetic
 * while the tutor spots the hằng đẳng thức and answers at once. The steps
 * are shown with the answer, so the kids see exactly how.
 */
export const DEMOS: { prompt: string; lcd: string; answer: number; steps: string[] }[] = [
  { prompt: "A = x² + 6x + 9 tại x = 97", lcd: "97²+6×97+9", answer: 10_000, steps: ["x² + 6x + 9 = (x + 3)²", `(97 + 3)² = 100² = ${fmt(10_000)}`] },
  { prompt: "B = x² − 25 tại x = 105", lcd: "105²−25", answer: 11_000, steps: ["x² − 25 = (x − 5)(x + 5)", `(105 − 5)(105 + 5) = 100 · 110 = ${fmt(11_000)}`] },
  { prompt: "C = x² − 4x + 4 tại x = 52", lcd: "52²−4×52+4", answer: 2500, steps: ["x² − 4x + 4 = (x − 2)²", "(52 − 2)² = 50² = 2500"] },
];

export const THEMES: { id: ThemeId; icon: string; name: string; pitch: string }[] = [
  { id: "mage", icon: "🧙", name: "Học viện Pháp sư", pitch: "Mỗi dạng toán là một câu thần chú." },
  { id: "arena", icon: "⚔️", name: "Đấu trường Tướng", pitch: "Mỗi thẻ là một vị tướng có kỹ năng riêng." },
  { id: "tamer", icon: "🐉", name: "Thu phục Quái thú", pitch: "Qua ải là thu phục được linh thú của dạng toán đó." },
];

/** Answer window per round. Generous: these are fresh topics, not a speed drill. */
export const QUESTION_MS = 35_000;
/** A bit longer when someone has to work out and type a number. */
export const NUMBER_QUESTION_MS = 42_000;
export const RESULT_MS = 9_000;
export const DAMAGE_PER_CORRECT = 10;
export const COMBO_BONUS = 10;
export const BOSS_HP_PER_PLAYER = 200;
export const MAX_MATH_BOSS_PLAYERS = 6;

export interface MathBossPlayer {
  id: string;
  name: string;
  grade: Grade;
  connected: boolean;
  /** Null until they pick (or the tutor moves on and one is dealt for them). */
  hero: HeroChoice | null;
}

/** A shot fired this round: a hit as soon as someone answers right, a miss when they answer wrong. */
export interface Shot {
  id: string;
  playerId: string;
  hit: boolean;
}

export interface PublicQuestion {
  id: string;
  grade: Grade;
  topic: TopicId;
  prompt: string;
  /** "choice": tap one of `options`; "number": type a whole number. */
  kind: "choice" | "number";
  options: string[];
  /** The boss's line for this student, e.g. "Đỡ này, Minh!". */
  callout: string;
}

export interface RevealedQuestion extends PublicQuestion {
  /** Index into `options` for a choice, the value itself for a number. */
  answer: number;
  answerText: string;
  steps: string[];
}

export interface PlayerOutcome {
  playerId: string;
  question: RevealedQuestion;
  given: number | null;
  correct: boolean;
}

export interface RoundOutcome {
  roundId: string;
  results: PlayerOutcome[];
  damage: number;
  combo: boolean;
  multiplier: number;
}

export interface PublicMathBossState {
  roomId: string;
  phase: MathBossPhase;
  players: MathBossPlayer[];
  /** Magic show: which demo (0–2) and whether its answer is up. */
  showIndex: number;
  showRevealed: boolean;
  config: MathBossConfig;
  /** How many dạng waves this fight has (the longest grade list); the wave after is the rage wave. */
  topicWaves: number;
  /** 1-based once the fight starts; wave n drills dạng n of each student's grade. */
  wave: number;
  questionIndex: number;
  bossHp: number;
  bossMaxHp: number;
  /** Each student's own question this round (by player id). */
  questions: Record<string, PublicQuestion>;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  /** Who has answered this round (not what). */
  answeredIds: string[];
  /** Answers are graded the moment they arrive, so each one fires a shot at once. */
  shots: Shot[];
  lastOutcome: RoundOutcome | null;
  /** Team totals only — the game never ranks the students against each other. */
  teamCorrect: number;
  teamAnswered: number;
  themeVotes: Record<string, ThemeId>;
  teamNameIdeas: Record<string, string>;
  chosenTheme: ThemeId | null;
  chosenTeamName: string | null;
}

export type MathBossClientMessage =
  | { type: "join"; playerId: string; name: string; grade: Grade; role: "host" | "player" }
  | { type: "set_grade"; grade: Grade }
  | { type: "pick_hero"; weapon: HeroWeapon; color: HeroColor }
  | { type: "answer"; value: number }
  | { type: "vote_theme"; theme: ThemeId }
  | { type: "team_name"; name: string }
  // Host (tutor screen) only:
  | { type: "configure"; config: MathBossConfig }
  | { type: "next" }
  | { type: "finish_boss" }
  | { type: "pick_theme"; theme: ThemeId }
  | { type: "pick_team_name"; name: string }
  | { type: "play_again" };

export type MathBossServerMessage =
  | { type: "state"; state: PublicMathBossState }
  | { type: "role"; role: "host" | "player" }
  | { type: "error"; message: string };

// ---------- question generators ----------

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const shuffle = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
/** A non-zero integer in ±[1, max]. */
const nonZero = (max: number) => pick(range(1, max)) * (Math.random() < 0.5 ? 1 : -1);
/** Two non-zero roots whose sizes differ, so every sign-flip distractor is a different answer. */
const twoRoots = (max: number): [number, number] => {
  const first = nonZero(max);
  let second = nonZero(max);
  while (Math.abs(second) === Math.abs(first)) second = nonZero(max);
  return [first, second];
};

/** "x − 3" for root 3, "x + 5" for root −5. */
const factor = (root: number) => (root > 0 ? `x − ${root}` : `x + ${-root}`);
/** "2x", "x", "−x", "−3x". */
const xTerm = (coefficient: number) => `${coefficient < 0 ? "−" : ""}${Math.abs(coefficient) === 1 ? "" : Math.abs(coefficient)}x`;
/** "2x − 6", "−3x + 9". */
const linear = (a: number, b: number) => (b === 0 ? xTerm(a) : `${xTerm(a)} ${b > 0 ? "+" : "−"} ${Math.abs(b)}`);
const FLIP: Record<string, string> = { ">": "<", "<": ">", "≥": "≤", "≤": "≥" };
/** "x²", "3x²" — a coefficient of 1 is left out. */
const mono = (coefficient: number, variable: string) => `${coefficient === 1 ? "" : coefficient}${variable}`;
const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (power: number) => (power === 1 ? "" : String(power).split("").map((digit) => SUPERSCRIPT[Number(digit)]).join(""));
/** "−6x³y⁴": a signed monomial; a ±1 coefficient is dropped when there are variables. */
const monomial = (coefficient: number, xPower = 0, yPower = 0) => {
  const variables = `${xPower ? `x${sup(xPower)}` : ""}${yPower ? `y${sup(yPower)}` : ""}`;
  const size = Math.abs(coefficient);
  return `${coefficient < 0 ? "−" : ""}${variables && size === 1 ? "" : size}${variables}`;
};
/** "2x² − 7x + 5" from [coefficient, power of x] pairs; zero terms are dropped. */
const polynomial = (terms: [number, number][]) => {
  const parts = terms.filter(([coefficient]) => coefficient !== 0);
  if (!parts.length) return "0";
  return parts
    .map(([coefficient, power], index) => {
      const body = monomial(Math.abs(coefficient), power);
      return index === 0 ? (coefficient < 0 ? `−${body}` : body) : `${coefficient < 0 ? "−" : "+"} ${body}`;
    })
    .join(" ");
};
/** A negative number in parentheses, for products like 3·(−2). */
const paren = (n: number) => (n < 0 ? `(${fmt(n)})` : fmt(n));
/** "2x + y", "x − 3y". */
const linear2 = (a: number, b: number) => `${xTerm(a)} ${b < 0 ? "−" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}y`;
const pair = (x: number, y: number) => `(${fmt(x)}; ${fmt(y)})`;
/** "k√m", or just "√m" when k = 1. */
const surd = (k: number, m: number) => `${k === 1 ? "" : k}√${m}`;

const CALLOUTS = ["Tiếp chiêu này, {name}!", "Đỡ này, {name}!", "{name}, phá chiêu này xem!", "Đến lượt {name} đấy!", "Chiêu này dành cho {name}!"];

function choice(correct: string, distractors: string[]): { options: string[]; answer: number } {
  const options = shuffle([...new Set([correct, ...distractors])].slice(0, 4));
  return { options, answer: options.indexOf(correct) };
}

type Draft = Omit<RevealedQuestion, "id" | "grade" | "topic" | "callout">;

/**
 * One question of a topic. `step` is how far into its wave the round is
 * (0-based): the first two stay at the very simplest form of the dạng.
 */
export function makeQuestion(topic: TopicId, step: number, hard: boolean, playerName: string): RevealedQuestion {
  const easy = !hard && step < 2;
  const draft = DRAFTERS[topic](easy, hard);
  return {
    ...draft,
    id: Math.random().toString(36).slice(2, 10),
    grade: topic.startsWith("g8") ? 8 : 9,
    topic,
    callout: pick(CALLOUTS).replace("{name}", playerName),
  };
}

const DRAFTERS: Record<TopicId, (easy: boolean, hard: boolean) => Draft> = {
  "g8-monomial": (easy) => {
    if (easy || Math.random() < 0.3) {
      const [p, q, c] = [pick([1, 2, 3, 4]), pick([1, 2, 3]), nonZero(9)];
      return {
        prompt: `Bậc của đơn thức ${monomial(c, p, q)} là bao nhiêu?`,
        kind: "number",
        options: [],
        answer: p + q,
        answerText: String(p + q),
        steps: ["Bậc của đơn thức = tổng số mũ các biến", `${p} + ${q} = ${p + q}`],
      };
    }
    const a = pick([2, 3, 4, 5]) * (Math.random() < 0.5 ? 1 : -1);
    const b = pick([2, 3, 4, 5]) * (Math.random() < 0.5 ? 1 : -1);
    const [p1, q1, p2, q2] = [pick([1, 2, 3]), pick([1, 2]), pick([1, 2, 3]), pick([1, 2, 3])];
    const correct = monomial(a * b, p1 + p2, q1 + q2);
    return {
      prompt: `Thu gọn: (${monomial(a, p1, q1)})·(${monomial(b, p2, q2)})`,
      kind: "choice",
      ...choice(correct, [monomial(a + b || 2 * a * b, p1 + p2, q1 + q2), monomial(a * b, p1 * p2, q1 * q2), monomial(-a * b, p1 + p2, q1 + q2)]),
      answerText: correct,
      steps: [`Nhân hệ số: ${fmt(a)}·${paren(b)} = ${fmt(a * b)}`, "Nhân lũy thừa cùng biến: cộng số mũ", `= ${correct}`],
    };
  },

  "g8-polyadd": (easy) => {
    const P: [number, number][] = [[nonZero(5), 2], [nonZero(6), 1], [nonZero(9), 0]];
    const Q: [number, number][] = [[nonZero(5), 2], [nonZero(6), 1], [nonZero(9), 0]];
    const minus = !easy && Math.random() < 0.6;
    if (P[0][0] === (minus ? Q[0][0] : -Q[0][0])) Q[0][0] += Q[0][0] > 0 ? 1 : -1;
    const combine = (signs: number[]) => P.map(([c, power], index) => [c + signs[index] * Q[index][0], power] as [number, number]);
    const s = minus ? -1 : 1;
    const correct = polynomial(combine([s, s, s]));
    const distractors = minus
      ? [polynomial(combine([1, 1, 1])), polynomial(combine([-1, 1, 1])), polynomial(combine([-1, -1, 1]))]
      : [polynomial(combine([-1, -1, -1])), polynomial(combine([1, -1, 1])), polynomial(combine([1, 1, -1]))];
    const negatedQ = Q.map(([c, power]) => `${-c < 0 ? "−" : "+"} ${monomial(Math.abs(c), power)}`).join(" ");
    return {
      prompt: `Cho P = ${polynomial(P)} và Q = ${polynomial(Q)}. Tính P ${minus ? "−" : "+"} Q`,
      kind: "choice",
      ...choice(correct, distractors),
      answerText: correct,
      steps: minus
        ? [`P − Q = ${polynomial(P)} ${negatedQ} (bỏ ngoặc, đổi dấu Q)`, `Gom hạng tử đồng dạng: ${correct}`]
        : [`P + Q = ${polynomial(P)} + ${polynomial(Q)}`, `Gom hạng tử đồng dạng: ${correct}`],
    };
  },

  "g8-polymul": (easy) => {
    if (easy || Math.random() < 0.5) {
      const [k, power, a, b] = [pick([2, 3, 4, 5]), pick([1, 2]), nonZero(5), nonZero(9)];
      const correct = polynomial([[k * a, power + 1], [k * b, power]]);
      return {
        prompt: `Nhân: ${monomial(k, power)}(${polynomial([[a, 1], [b, 0]])})`,
        kind: "choice",
        ...choice(correct, [polynomial([[k * a, power + 1], [b, 0]]), polynomial([[k * a, power], [k * b, power]]), polynomial([[k * a, power + 1], [-k * b, power]])]),
        answerText: correct,
        steps: [`Nhân ${monomial(k, power)} với từng hạng tử trong ngoặc`, `= ${correct}`],
      };
    }
    const [a, b] = twoRoots(6);
    const correct = polynomial([[1, 2], [a + b, 1], [a * b, 0]]);
    return {
      prompt: `Nhân: (${polynomial([[1, 1], [a, 0]])})(${polynomial([[1, 1], [b, 0]])})`,
      kind: "choice",
      ...choice(correct, [polynomial([[1, 2], [a * b, 0]]), polynomial([[1, 2], [a * b, 1], [a + b, 0]]), polynomial([[1, 2], [-(a + b), 1], [a * b, 0]])]),
      answerText: correct,
      steps: [`= x·x + x·${paren(b)} + ${paren(a)}·x + ${paren(a)}·${paren(b)}`, `= ${correct}`],
    };
  },

  "g8-polydiv": () => {
    const [k, m1, m2] = [pick([2, 3, 4, 5]), nonZero(5), nonZero(6)];
    const correct = polynomial([[m1, 2], [m2, 1]]);
    return {
      prompt: `Chia: (${polynomial([[k * m1, 3], [k * m2, 2]])}) : ${monomial(k, 1)}`,
      kind: "choice",
      ...choice(correct, [polynomial([[m1, 3], [m2, 2]]), polynomial([[m1, 2], [k * m2, 2]]), polynomial([[m1, 1], [m2, 0]])]),
      answerText: correct,
      steps: [`Chia từng hạng tử cho ${monomial(k, 1)}: chia hệ số, trừ số mũ`, `${monomial(k * m1, 3)} : ${monomial(k, 1)} = ${monomial(m1, 2)}; ${monomial(k * m2, 2)} : ${monomial(k, 1)} = ${monomial(m2, 1)}`, `= ${correct}`],
    };
  },

  "g9-pairsol": () => {
    const [x0, y0] = [pick(range(-3, 4)), pick(range(-3, 4))];
    const [a, b] = [nonZero(4), nonZero(4)];
    const c = a * x0 + b * y0;
    const satisfies = (x: number, y: number) => a * x + b * y === c;
    const correct = pair(x0, y0);
    const distractors = [pair(y0, x0), pair(x0, y0 + 1), pair(x0 + 1, y0), pair(-x0, y0), pair(x0, -y0 - 1)]
      .filter((option, index) => option !== correct && !satisfies(...([[y0, x0], [x0, y0 + 1], [x0 + 1, y0], [-x0, y0], [x0, -y0 - 1]][index] as [number, number])));
    return {
      prompt: `Cặp số nào là nghiệm của phương trình ${linear2(a, b)} = ${fmt(c)}?`,
      kind: "choice",
      ...choice(correct, distractors),
      answerText: correct,
      steps: [`Thay x = ${fmt(x0)}, y = ${fmt(y0)}: ${fmt(a)}·${paren(x0)} + ${paren(b)}·${paren(y0)} = ${fmt(c)}`, "Đẳng thức đúng ⇒ là nghiệm"],
    };
  },

  "g9-system": (easy) => {
    const [x0, y0] = [nonZero(5), nonZero(5)];
    const solution = (x: number, y: number) => `(x; y) = ${pair(x, y)}`;
    if (easy) {
      const [s, d] = [x0 + y0, x0 - y0];
      const correct = solution(x0, y0);
      return {
        prompt: `Giải hệ: x + y = ${fmt(s)}; x − y = ${fmt(d)}`,
        kind: "choice",
        ...choice(correct, [solution(y0, x0), solution(-x0, y0), solution(x0, -y0)].filter((option) => option !== correct)),
        answerText: correct,
        steps: [`Cộng hai phương trình: 2x = ${fmt(s + d)} ⇒ x = ${fmt(x0)}`, `y = ${fmt(s)} − ${paren(x0)} = ${fmt(y0)}`],
      };
    }
    // a1·x + y = c1 (easy to rearrange for y), a2·x + b2·y = c2.
    let [a1, a2, b2] = [pick([1, 2, 3]), pick([1, 2, 3]), nonZero(3)];
    while (a2 - a1 * b2 === 0) b2 = nonZero(3);
    const [c1, c2] = [a1 * x0 + y0, a2 * x0 + b2 * y0];
    const satisfiesBoth = (x: number, y: number) => a1 * x + y === c1 && a2 * x + b2 * y === c2;
    const correct = solution(x0, y0);
    const swaps: [number, number][] = [[y0, x0], [-x0, y0], [x0, -y0], [-x0, -y0]];
    return {
      prompt: `Giải hệ: ${linear2(a1, 1)} = ${fmt(c1)}; ${linear2(a2, b2)} = ${fmt(c2)}`,
      kind: "choice",
      ...choice(correct, swaps.filter(([x, y]) => !satisfiesBoth(x, y)).map(([x, y]) => solution(x, y))),
      answerText: correct,
      steps: [`Từ phương trình đầu: y = ${fmt(c1)} − ${mono(a1, "x")}`, `Thế vào phương trình sau, giải được x = ${fmt(x0)}`, `Suy ra y = ${fmt(y0)}`],
    };
  },

  "g9-wordsys": (easy) => {
    const template = easy ? pick(["sumdiff", "animals"]) : pick(["sumdiff", "animals", "shop"]);
    if (template === "sumdiff") {
      const big = pick(range(20, 60));
      const small = pick(range(5, big - 5));
      return {
        prompt: `Tổng của hai số là ${big + small}, hiệu của chúng là ${big - small}. Tìm số lớn hơn.`,
        kind: "number",
        options: [],
        answer: big,
        answerText: String(big),
        steps: [`Gọi số lớn là x, số nhỏ là y: x + y = ${big + small}; x − y = ${big - small}`, `Cộng hai phương trình: 2x = ${2 * big} ⇒ x = ${big}`],
      };
    }
    if (template === "animals") {
      const [chickens, dogs] = [pick(range(10, 30)), pick(range(5, 20))];
      const [heads, legs] = [chickens + dogs, 2 * chickens + 4 * dogs];
      return {
        prompt: `Vừa gà vừa chó có ${heads} con, đếm được ${legs} chân. Hỏi có bao nhiêu con chó?`,
        kind: "number",
        options: [],
        answer: dogs,
        answerText: String(dogs),
        steps: [`Gọi số gà là x, số chó là y: x + y = ${heads}; 2x + 4y = ${legs}`, `Lấy phương trình sau trừ 2 lần phương trình đầu: 2y = ${legs - 2 * heads} ⇒ y = ${dogs}`],
      };
    }
    const [notebook, pen] = [pick(range(5, 12)), pick(range(3, 9))];
    let [a1, b1, a2, b2] = [pick([2, 3, 4]), pick([1, 2, 3]), pick([1, 2, 3]), pick([2, 3, 4])];
    while (a1 * b2 - a2 * b1 === 0) b2 += 1;
    const [total1, total2] = [a1 * notebook + b1 * pen, a2 * notebook + b2 * pen];
    return {
      prompt: `Mua ${a1} quyển vở và ${b1} cái bút hết ${total1} nghìn đồng; mua ${a2} quyển vở và ${b2} cái bút hết ${total2} nghìn đồng. Giá một quyển vở là bao nhiêu nghìn đồng?`,
      kind: "number",
      options: [],
      answer: notebook,
      answerText: String(notebook),
      steps: [`Gọi giá vở là x, giá bút là y (nghìn đồng): ${a1}x + ${b1}y = ${total1}; ${a2}x + ${b2}y = ${total2}`, `Giải hệ được x = ${notebook}, y = ${pen}`],
    };
  },

  "g9-sqrt": (easy) => {
    const pattern = easy ? pick(["value", "domain"]) : pick(["value", "domain", "abs"]);
    if (pattern === "value") {
      const n = pick(range(4, 20));
      return {
        prompt: `Tính √${n * n}`,
        kind: "number",
        options: [],
        answer: n,
        answerText: String(n),
        steps: [`${n}² = ${n * n}`, `⇒ √${n * n} = ${n}`],
      };
    }
    if (pattern === "domain") {
      const [a, r] = [pick([1, 2, 3, 4, 5]), nonZero(6)];
      const inside = linear(a, -a * r);
      const correct = `x ≥ ${fmt(r)}`;
      return {
        prompt: `Điều kiện xác định của √(${inside})`,
        kind: "choice",
        ...choice(correct, [`x > ${fmt(r)}`, `x ≤ ${fmt(r)}`, `x ≥ ${fmt(-r)}`]),
        answerText: correct,
        steps: [`Cần ${inside} ≥ 0`, `⇒ ${correct}`],
      };
    }
    const r = pick(range(1, 6));
    const correct = `${r} − x`;
    return {
      prompt: `Rút gọn √((x − ${r})²) với x < ${r}`,
      kind: "choice",
      ...choice(correct, [`x − ${r}`, `x + ${r}`, `−x − ${r}`]),
      answerText: correct,
      steps: ["√(A²) = |A|", `x < ${r} nên x − ${r} < 0 ⇒ |x − ${r}| = ${correct}`],
    };
  },

  "g9-sqrtmul": () => {
    const [m, k] = [pick([2, 3, 5, 6, 7]), pick([2, 3, 4, 5])];
    if (Math.random() < 0.5) {
      return {
        prompt: `Tính √${m} · √${m * k * k}`,
        kind: "number",
        options: [],
        answer: m * k,
        answerText: String(m * k),
        steps: [`√${m} · √${m * k * k} = √${m * m * k * k}`, `= √(${m * k}²) = ${m * k}`],
      };
    }
    return {
      prompt: `Tính √${m * k * k} : √${m}`,
      kind: "number",
      options: [],
      answer: k,
      answerText: String(k),
      steps: [`√${m * k * k} : √${m} = √(${m * k * k} : ${m}) = √${k * k}`, `= ${k}`],
    };
  },

  "g9-sqrtsimplify": (easy) => {
    const pattern = easy ? "out" : pick(["out", "sum", "rationalize"]);
    const m = pick([2, 3, 5, 6, 7]);
    if (pattern === "out") {
      const k = pick([2, 3, 4, 5, 6]);
      const correct = surd(k, m);
      return {
        prompt: `Đưa thừa số ra ngoài dấu căn: √${k * k * m}`,
        kind: "choice",
        ...choice(correct, [surd(m, k), surd(k * k, m), surd(k, k * m)]),
        answerText: correct,
        steps: [`${k * k * m} = ${k}²·${m}`, `√${k * k * m} = ${correct}`],
      };
    }
    if (pattern === "sum") {
      const [k1, k2] = twoRoots(4).map(Math.abs) as [number, number];
      const small = pick([2, 3, 5]);
      const correct = surd(k1 + k2, small);
      return {
        prompt: `Rút gọn √${k1 * k1 * small} + √${k2 * k2 * small}`,
        kind: "choice",
        ...choice(correct, [`√${(k1 * k1 + k2 * k2) * small}`, surd(k1 * k2, small), surd(k1 + k2, 2 * small)]),
        answerText: correct,
        steps: [`√${k1 * k1 * small} = ${surd(k1, small)}; √${k2 * k2 * small} = ${surd(k2, small)}`, `Cộng các căn đồng dạng: ${correct}`],
      };
    }
    const k = pick([1, 2, 3, 4]);
    const n = k * m;
    const correct = surd(k, m);
    return {
      prompt: `Trục căn thức ở mẫu: ${n}/√${m}`,
      kind: "choice",
      ...choice(correct, [surd(n, m), `√${m}/${m}`, surd(m, k === 1 ? 2 : k)]),
      answerText: correct,
      steps: [`Nhân cả tử và mẫu với √${m}: ${n}/√${m} = ${n}√${m}/${m}`, `= ${correct}`],
    };
  },

  "g9-cbrt": (easy) => {
    const n = pick([2, 3, 4, 5, 6]);
    if (easy || Math.random() < 0.5) {
      return {
        prompt: `Tính ∛${n ** 3}`,
        kind: "number",
        options: [],
        answer: n,
        answerText: String(n),
        steps: [`${n}³ = ${n ** 3}`, `⇒ ∛${n ** 3} = ${n}`],
      };
    }
    const correct = `−${n}`;
    return {
      prompt: `Tính ∛(−${n ** 3})`,
      kind: "choice",
      ...choice(correct, [String(n), "Không tồn tại", `−${n * n}`]),
      answerText: correct,
      steps: [`(−${n})³ = −${n ** 3}`, `⇒ ∛(−${n ** 3}) = ${correct}`],
    };
  },

  "g8-square": (easy, hard) => {
    const a = hard ? pick(range(4, 9)) : easy ? pick([2, 3]) : pick(range(2, 6));
    const plus = easy ? Math.random() < 0.7 : Math.random() < 0.5;
    const op = plus ? "+" : "−";
    const correct = `x² ${op} ${2 * a}x + ${a * a}`;
    const distractors = plus
      ? [`x² + ${a * a}`, `x² + ${a}x + ${a * a}`, `x² + ${2 * a}x + ${a}`]
      : [`x² − ${a * a}`, `x² − ${a}x + ${a * a}`, `x² + ${2 * a}x + ${a * a}`];
    return {
      prompt: `Khai triển (x ${op} ${a})²`,
      kind: "choice",
      ...choice(correct, distractors),
      answerText: correct,
      steps: [`(x ${op} ${a})² = x² ${op} 2·x·${a} + ${a}²`, `= ${correct}`],
    };
  },

  "g8-diffsq": (easy, hard) => {
    const a = hard ? pick(range(6, 12)) : easy ? pick(range(2, 5)) : pick(range(3, 9));
    if (Math.random() < 0.6) {
      const correct = `(x − ${a})(x + ${a})`;
      return {
        prompt: `Viết x² − ${a * a} thành tích`,
        kind: "choice",
        ...choice(correct, [`(x − ${a})²`, `(x − ${a * a})(x + ${a * a})`, `(x + ${a})²`]),
        answerText: correct,
        steps: [`x² − ${a * a} = x² − ${a}²`, `= ${correct}`],
      };
    }
    const correct = `x² − ${a * a}`;
    return {
      prompt: `Rút gọn (x − ${a})(x + ${a})`,
      kind: "choice",
      ...choice(correct, [`x² + ${a * a}`, `x² − ${2 * a}x + ${a * a}`, `x² − ${a}`]),
      answerText: correct,
      steps: [`(x − ${a})(x + ${a}) = x² − ${a}²`, `= ${correct}`],
    };
  },

  "g8-evaluate": (easy, hard) => {
    const a = hard ? pick(range(2, 6)) : easy ? pick([1, 2, 3]) : pick(range(1, 5));
    const s = hard ? pick([40, 50, 60, 70, 80, 90, 100]) : easy ? pick([10, 20]) : pick([10, 20, 30, 50, 100]);
    const plus = Math.random() < 0.6;
    const expr = `x² ${plus ? "+" : "−"} ${2 * a}x + ${a * a}`;
    const x = plus ? s - a : s + a;
    const answer = s * s;
    return {
      prompt: `Tính A = ${expr} tại x = ${x}`,
      kind: "number",
      options: [],
      answer,
      answerText: fmt(answer),
      steps: [`${expr} = (x ${plus ? "+" : "−"} ${a})²`, `Tại x = ${x}: (${x} ${plus ? "+" : "−"} ${a})² = ${s}² = ${fmt(answer)}`],
    };
  },

  "g8-cube": (easy) => {
    const a = easy ? pick([2, 3]) : pick([2, 3, 4]);
    const plus = Math.random() < 0.5;
    const op = plus ? "+" : "−";
    const correct = `x³ ${op} ${mono(3 * a, "x²")} + ${mono(3 * a * a, "x")} ${op} ${a ** 3}`;
    const distractors = plus
      ? [`x³ + ${a ** 3}`, `x³ + ${mono(a, "x²")} + ${mono(a * a, "x")} + ${a ** 3}`, `x³ + ${mono(3 * a, "x²")} + ${mono(3 * a, "x")} + ${a ** 3}`]
      : [`x³ − ${a ** 3}`, `x³ − ${mono(3 * a, "x²")} − ${mono(3 * a * a, "x")} − ${a ** 3}`, `x³ + ${mono(3 * a, "x²")} + ${mono(3 * a * a, "x")} + ${a ** 3}`];
    return {
      prompt: `Khai triển (x ${op} ${a})³`,
      kind: "choice",
      ...choice(correct, distractors),
      answerText: correct,
      steps: [`(x ${op} ${a})³ = x³ ${op} 3·x²·${a} + 3·x·${a}² ${op} ${a}³`, `= ${correct}`],
    };
  },

  "g8-sumcubes": () => {
    const a = pick([2, 3, 4, 5]);
    const plus = Math.random() < 0.5;
    const op = plus ? "+" : "−";
    const correct = plus ? `(x + ${a})(x² − ${a}x + ${a * a})` : `(x − ${a})(x² + ${a}x + ${a * a})`;
    const distractors = plus
      ? [`(x + ${a})(x² + ${a}x + ${a * a})`, `(x + ${a})³`, `(x − ${a})(x² + ${a}x + ${a * a})`]
      : [`(x − ${a})(x² − ${a}x + ${a * a})`, `(x − ${a})³`, `(x + ${a})(x² − ${a}x + ${a * a})`];
    return {
      prompt: `Viết x³ ${op} ${a ** 3} thành tích`,
      kind: "choice",
      ...choice(correct, distractors),
      answerText: correct,
      steps: [`x³ ${op} ${a ** 3} = x³ ${op} ${a}³`, `= ${correct}`],
    };
  },

  "g8-factor": (easy) => {
    const pattern = easy ? pick(["common", "square"]) : pick(["common", "square", "diff", "group"]);
    if (pattern === "common") {
      const k = pick([2, 3, 4, 5]);
      const m = pick([1, 2, 3, 5, 7].filter((value) => value % k !== 0));
      const op = Math.random() < 0.5 ? "+" : "−";
      const other = op === "+" ? "−" : "+";
      const correct = `${k}x(x ${op} ${m})`;
      return {
        prompt: `Phân tích thành nhân tử: ${k}x² ${op} ${mono(k * m, "x")}`,
        kind: "choice",
        ...choice(correct, [`${k}(x² ${op} ${mono(m, "x")})`, `x(${k}x ${op} ${k * m})`, `${k}x(x ${other} ${m})`]),
        answerText: correct,
        steps: [`Nhân tử chung là ${k}x`, `${k}x² ${op} ${mono(k * m, "x")} = ${correct}`],
      };
    }
    if (pattern === "square") {
      const a = pick([2, 3, 4, 5, 6]);
      const op = Math.random() < 0.5 ? "+" : "−";
      const other = op === "+" ? "−" : "+";
      const correct = `(x ${op} ${a})²`;
      return {
        prompt: `Phân tích thành nhân tử: x² ${op} ${2 * a}x + ${a * a}`,
        kind: "choice",
        ...choice(correct, [`(x ${other} ${a})²`, `(x − ${a})(x + ${a})`, `(x ${op} ${2 * a})²`]),
        answerText: correct,
        steps: [`x² ${op} ${2 * a}x + ${a * a} = x² ${op} 2·x·${a} + ${a}²`, `= ${correct}`],
      };
    }
    if (pattern === "diff") {
      const k = pick([2, 3, 5]);
      const a = pick([2, 3, 4, 5]);
      const correct = `${k}(x − ${a})(x + ${a})`;
      return {
        prompt: `Phân tích thành nhân tử: ${k}x² − ${k * a * a}`,
        kind: "choice",
        ...choice(correct, [`${k}(x² − ${a * a})`, `${k}(x − ${a})²`, `(${k}x − ${a})(${k}x + ${a})`]),
        answerText: correct,
        steps: [`${k}x² − ${k * a * a} = ${k}(x² − ${a * a})`, `= ${correct}`],
      };
    }
    const c = pick([2, 3, 4, 5]);
    const correct = `(x − y)(x + ${c})`;
    return {
      prompt: `Phân tích thành nhân tử: x² − xy + ${c}x − ${c}y`,
      kind: "choice",
      ...choice(correct, [`(x + y)(x − ${c})`, `(x − y)(x − ${c})`, `x(x − y + ${c})`]),
      answerText: correct,
      steps: [`= (x² − xy) + (${c}x − ${c}y)`, `= x(x − y) + ${c}(x − y)`, `= ${correct}`],
    };
  },

  "g9-product": (easy, hard) => {
    const [r1, r2] = twoRoots(easy ? 5 : 9);
    // The rage wave puts a coefficient on the first factor: (2x − 6)(x + 1) = 0.
    const k = hard ? pick([2, 3]) : 1;
    const first = k === 1 ? factor(r1) : linear(k, -k * r1);
    const solution = (p: number, q: number) => `x = ${fmt(p)} hoặc x = ${fmt(q)}`;
    const correct = solution(r1, r2);
    const distractors = [solution(-r1, -r2), solution(r1, -r2), solution(-r1, r2)];
    if (k !== 1) distractors.unshift(solution(k * r1, r2));
    return {
      prompt: `Giải phương trình (${first})(${factor(r2)}) = 0`,
      kind: "choice",
      ...choice(correct, distractors),
      answerText: correct,
      steps: [`${first} = 0 ⇒ x = ${fmt(r1)}`, `${factor(r2)} = 0 ⇒ x = ${fmt(r2)}`],
    };
  },

  "g9-domain": (easy) => {
    if (easy) {
      const r = nonZero(6);
      const p = pick(range(1, 5));
      const correct = `x ≠ ${fmt(r)}`;
      return {
        prompt: `Điều kiện xác định của phương trình ${p}/(${factor(r)}) = 1`,
        kind: "choice",
        ...choice(correct, [`x ≠ ${fmt(-r)}`, `x ≠ ${p}`, "x ≠ 0"]),
        answerText: correct,
        steps: [`Mẫu ${factor(r)} ≠ 0`, `⇒ ${correct}`],
      };
    }
    const [r1, r2] = twoRoots(7);
    const [p, q, c] = [pick(range(1, 5)), pick(range(1, 5)), pick(range(1, 4))];
    const condition = (u: number, v: number) => `x ≠ ${fmt(u)} và x ≠ ${fmt(v)}`;
    const correct = condition(r1, r2);
    return {
      prompt: `Điều kiện xác định của phương trình ${p}/(${factor(r1)}) + ${q}/(${factor(r2)}) = ${c}`,
      kind: "choice",
      ...choice(correct, [condition(-r1, -r2), condition(r1, -r2), condition(-r1, r2)]),
      answerText: correct,
      steps: [`${factor(r1)} ≠ 0 ⇒ x ≠ ${fmt(r1)}`, `${factor(r2)} ≠ 0 ⇒ x ≠ ${fmt(r2)}`],
    };
  },

  "g9-ineqprop": () => {
    const rel = pick([">", "<"]);
    const c = pick(range(1, 9));
    const k = pick(range(2, 7));
    const n = pick(range(2, 7));
    // One true statement and the flipped (false) form of all three rules.
    const rules = [
      { right: `a − ${c} ${rel} b − ${c}`, wrong: `a − ${c} ${FLIP[rel]} b − ${c}`, why: `Trừ cùng một số ở hai vế: giữ chiều` },
      { right: `${k}a ${rel} ${k}b`, wrong: `${k}a ${FLIP[rel]} ${k}b`, why: `Nhân hai vế với ${k} > 0: giữ chiều` },
      { right: `−${n}a ${FLIP[rel]} −${n}b`, wrong: `−${n}a ${rel} −${n}b`, why: `Nhân hai vế với −${n} < 0: đổi chiều` },
    ];
    const truth = pick(rules);
    return {
      prompt: `Cho a ${rel} b. Khẳng định nào đúng?`,
      kind: "choice",
      ...choice(truth.right, rules.map((rule) => rule.wrong)),
      answerText: truth.right,
      steps: [truth.why, `⇒ ${truth.right}`],
    };
  },

  "g9-inequality": (easy, hard) => {
    const c = nonZero(6);
    // Early on the x-coefficient is positive; later it can be negative —
    // that's the "đổi chiều" trap this dạng is really about.
    const a = easy ? pick([2, 3, 4, 5]) : hard ? pick([-2, -3, -4, -5, 3]) : pick([2, 3, 4, 5, -2, -3]);
    const sign = easy ? pick([">", "<"]) : pick([">", "<", "≥", "≤"]);
    const b = -a * c;
    const solved = a > 0 ? sign : FLIP[sign];
    const answerOf = (s: string, v: number) => `x ${s} ${fmt(v)}`;
    const correct = answerOf(solved, c);
    return {
      prompt: `Giải bất phương trình ${linear(a, b)} ${sign} 0`,
      kind: "choice",
      ...choice(correct, [answerOf(FLIP[solved], c), answerOf(solved, -c), answerOf(FLIP[solved], -c)]),
      answerText: correct,
      steps: [
        `${xTerm(a)} ${sign} ${fmt(-b)}`,
        a > 0
          ? `Chia hai vế cho ${a} (số dương, giữ chiều): ${correct}`
          : `Chia hai vế cho ${fmt(a)} (số âm, đổi chiều): ${correct}`,
      ],
    };
  },
};

/**
 * The dạng a student gets this round: their grade's wave-th pick; in the rage
 * wave — or once a grade has run out of picks — a rotation through all of them.
 */
export function topicFor(topics: TopicId[], wave: number, topicWaves: number, index: number): TopicId {
  if (!isRageWave(wave, topicWaves) && wave <= topics.length) return topics[wave - 1];
  return topics[index % topics.length];
}

export function formatNumber(n: number): string {
  return fmt(n);
}
