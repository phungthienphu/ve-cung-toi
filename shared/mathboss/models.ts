

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

export type Draft = Omit<RevealedQuestion, "id" | "grade" | "topic" | "callout">;
