import type * as Party from "partykit/server";
import {
  COMBO_BONUS,
  DAMAGE_PER_CORRECT,
  DEFAULT_MATH_BOSS_CONFIG,
  DEMOS,
  GRADES,
  HERO_COLORS,
  MAX_MATH_BOSS_PLAYERS,
  MAX_TOPICS_PER_GRADE,
  NUMBER_QUESTION_MS,
  QUESTIONS_PER_WAVE_OPTIONS,
  QUESTION_MS,
  RESULT_MS,
  THEMES,
  TOPIC_CATALOG,
  WEAPONS,
  isRageWave,
  makeQuestion,
  topicFor,
  type Grade,
  type HeroChoice,
  type HeroColor,
  type HeroWeapon,
  type MathBossClientMessage,
  type MathBossConfig,
  type MathBossPhase,
  type MathBossPlayer,
  type MathBossServerMessage,
  type PublicMathBossState,
  type PublicQuestion,
  type RevealedQuestion,
  type RoundOutcome,
  type Shot,
  type ThemeId,
  type TopicId,
} from "../shared/mathBossTypes";

const toGrade = (value: unknown): Grade => (GRADES.includes(value as Grade) ? (value as Grade) : 8);
const COLOR_IDS = Object.keys(HERO_COLORS) as HeroColor[];
/** How long a shot is in the air on the tutor's screen before it lands. */
const SHOT_FLIGHT_MS = 900;

// The tutor's screen ("host") drives the pace: it advances the magic show,
// starts each wave after going over the formulas, and settles the final vote.
// Inside a wave, rounds run on their own timers. Each round every student
// gets their own question from their own grade.
export default class MathBossRoom implements Party.Server {
  players = new Map<string, MathBossPlayer>();
  hostId: string | null = null;
  phase: MathBossPhase = "lobby";
  config: MathBossConfig = structuredClone(DEFAULT_MATH_BOSS_CONFIG);
  /** Fixed when the fight starts: the longest grade's list of chosen dạng. */
  topicWaves = 1;
  hpPerPlayer = 0;
  showIndex = 0;
  showRevealed = false;
  wave = 0;
  questionIndex = 0;
  bossHp = 0;
  bossMaxHp = 0;
  questions = new Map<string, RevealedQuestion>();
  questionStartedAt: number | null = null;
  questionEndsAt: number | null = null;
  answers = new Map<string, number>();
  shots: Shot[] = [];
  lastOutcome: RoundOutcome | null = null;
  teamCorrect = 0;
  teamAnswered = 0;
  /** `${playerId}|${prompt}` — nobody gets the same question twice in a game. */
  usedPrompts = new Set<string>();
  themeVotes = new Map<string, ThemeId>();
  teamNameIdeas = new Map<string, string>();
  chosenTheme: ThemeId | null = null;
  chosenTeamName: string | null = null;
  timer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly party: Party.Party) {}

  // ---------- connection ----------

  onConnect(connection: Party.Connection) {
    connection.send(JSON.stringify(this.stateMessage()));
  }

  onClose(connection: Party.Connection) {
    // A refresh opens the new socket before the old one closes — not a leave.
    if (this.isOnline(connection.id)) return;
    if (connection.id === this.hostId) return;
    const player = this.players.get(connection.id);
    if (!player) return;
    // In the lobby a closed tab just leaves; mid-game the seat is kept so a
    // phone that went to sleep comes straight back into the fight.
    if (this.phase === "lobby") this.players.delete(player.id);
    else player.connected = false;
    this.broadcastState();
    this.maybeEndRoundEarly();
  }

  onMessage(raw: string, sender: Party.Connection) {
    let msg: MathBossClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case "join": return this.join(msg.playerId, msg.name, msg.grade, msg.role, sender);
      case "set_grade": return this.setGrade(sender.id, msg.grade);
      case "pick_hero": return this.pickHero(sender.id, msg.weapon, msg.color);
      case "answer": return this.answer(sender.id, msg.value);
      case "vote_theme": return this.voteTheme(sender.id, msg.theme);
      case "team_name": return this.suggestTeamName(sender.id, msg.name);
    }

    if (sender.id !== this.hostId) return;
    switch (msg.type) {
      case "configure": return this.configure(sender, msg.config);
      case "next": return this.next(sender);
      case "finish_boss": return this.finishBoss();
      case "pick_theme": return this.pickTheme(msg.theme);
      case "pick_team_name": return this.pickTeamName(msg.name);
      case "play_again": return this.playAgain();
    }
  }

  private join(playerId: string, rawName: string, grade: Grade, role: "host" | "player", sender: Party.Connection) {
    if (sender.id !== playerId) return this.sendError(sender, "Phiên kết nối không hợp lệ.");

    if (role === "host") {
      // A second tutor screen may take over only once the first has gone
      // (e.g. switching laptops); otherwise two screens would fight.
      if (this.hostId && this.hostId !== playerId && this.isOnline(this.hostId)) {
        return this.sendError(sender, "Phòng này đã có màn hình gia sư.");
      }
      this.hostId = playerId;
      sender.send(JSON.stringify({ type: "role", role: "host" } satisfies MathBossServerMessage));
      return this.broadcastState();
    }

    const name = String(rawName ?? "").trim().slice(0, 20) || "Pháp sư nhí";
    const existing = this.players.get(playerId);
    if (existing) {
      existing.connected = true;
      existing.name = name;
    } else {
      if (this.players.size >= MAX_MATH_BOSS_PLAYERS) return this.sendError(sender, "Phòng đã đủ người.");
      // Arriving after character select: deal a hero so they can fight at once.
      const hero = this.phase === "lobby" || this.phase === "pick" ? null : this.randomHero();
      this.players.set(playerId, { id: playerId, name, grade: toGrade(grade), connected: true, hero });
      // Joining after the fight started still counts toward the boss: give it
      // a bit more health so the late arrival isn't just a spectator.
      if (this.bossMaxHp > 0) {
        this.bossMaxHp += this.hpPerPlayer;
        this.bossHp += this.hpPerPlayer;
      }
    }
    sender.send(JSON.stringify({ type: "role", role: "player" } satisfies MathBossServerMessage));
    this.broadcastState();
  }

  // Fixing a mis-tapped grade is fine any time outside a live round.
  private setGrade(playerId: string, grade: Grade) {
    const player = this.players.get(playerId);
    if (!player || this.phase === "question" || this.phase === "result") return;
    player.grade = toGrade(grade);
    this.broadcastState();
  }

  private pickHero(playerId: string, weapon: HeroWeapon, color: HeroColor) {
    const player = this.players.get(playerId);
    if (!player || !WEAPONS.some((option) => option.id === weapon) || !COLOR_IDS.includes(color)) return;
    if (this.phase === "question" || this.phase === "result") return;
    player.hero = { weapon, color };
    this.broadcastState();
  }

  /** A hero for someone who didn't pick, avoiding colours already taken. */
  private randomHero(): HeroChoice {
    const taken = new Set([...this.players.values()].map((player) => player.hero?.color));
    const free = COLOR_IDS.filter((color) => !taken.has(color));
    const pool = free.length ? free : COLOR_IDS;
    return {
      weapon: WEAPONS[Math.floor(Math.random() * WEAPONS.length)].id,
      color: pool[Math.floor(Math.random() * pool.length)],
    };
  }

  // ---------- host flow ----------

  /** The tutor's choice of dạng (per grade, in wave order), questions per wave and opening show. */
  private configure(sender: Party.Connection, raw: MathBossConfig) {
    if (this.phase !== "lobby" && this.phase !== "pick") return this.sendError(sender, "Chỉ đổi nội dung trận được trước khi bắt đầu.");
    const topics = {} as Record<Grade, TopicId[]>;
    for (const grade of GRADES) {
      const picked = Array.isArray(raw?.topics?.[grade]) ? raw.topics[grade] : [];
      topics[grade] = [...new Set(picked)]
        .filter((id): id is TopicId => TOPIC_CATALOG[id as TopicId]?.grade === grade)
        .slice(0, MAX_TOPICS_PER_GRADE);
    }
    this.config = {
      topics,
      questionsPerWave: QUESTIONS_PER_WAVE_OPTIONS.includes(raw?.questionsPerWave) ? raw.questionsPerWave : DEFAULT_MATH_BOSS_CONFIG.questionsPerWave,
      showDemo: raw?.showDemo !== false,
    };
    this.broadcastState();
  }

  private next(sender: Party.Connection) {
    switch (this.phase) {
      case "lobby":
        if (this.players.size === 0) return this.sendError(sender, "Chưa có học sinh nào vào phòng.");
        this.phase = "pick";
        return this.broadcastState();
      case "pick": {
        const missing = GRADES.filter((grade) => this.config.topics[grade].length === 0 && [...this.players.values()].some((player) => player.grade === grade));
        if (missing.length) return this.sendError(sender, `Chưa chọn dạng toán nào cho lớp ${missing.join(", ")} — bấm "Đổi nội dung trận".`);
        for (const player of this.players.values()) if (!player.hero) player.hero = this.randomHero();
        return this.beginFight();
      }
      case "show":
        if (!this.showRevealed) this.showRevealed = true;
        else if (this.showIndex < DEMOS.length - 1) {
          this.showIndex += 1;
          this.showRevealed = false;
        } else return this.startIntro(1);
        return this.broadcastState();
      case "intro":
        return this.startRound();
      case "question":
        return this.endRound();
      case "result":
        return this.advanceAfterResult();
      case "victory":
        this.phase = "vote";
        return this.broadcastState();
      case "vote":
        return this.finishVote(sender);
      case "done":
        return;
    }
  }

  private beginFight() {
    this.clearTimer();
    const grades = new Set([...this.players.values()].map((player) => player.grade));
    this.topicWaves = Math.max(1, ...[...grades].map((grade) => this.config.topics[grade].length));
    // Enough health that every chosen dạng gets its wave: roughly what a
    // student could deal in all the dạng waves, plus a third.
    this.hpPerPlayer = Math.max(100, Math.round((this.topicWaves * this.config.questionsPerWave * DAMAGE_PER_CORRECT * 4) / 3 / 10) * 10);
    this.bossMaxHp = this.hpPerPlayer * Math.max(1, this.players.size);
    this.bossHp = this.bossMaxHp;
    this.teamCorrect = 0;
    this.teamAnswered = 0;
    this.usedPrompts.clear();
    if (!this.config.showDemo) return this.startIntro(1);
    this.phase = "show";
    this.showIndex = 0;
    this.showRevealed = false;
    this.broadcastState();
  }

  private startIntro(wave: number) {
    this.clearTimer();
    this.phase = "intro";
    this.wave = wave;
    this.questionIndex = 0;
    this.questions.clear();
    this.lastOutcome = null;
    this.broadcastState();
  }

  private startRound() {
    this.clearTimer();
    this.questions.clear();
    this.answers.clear();
    this.shots = [];
    const hard = isRageWave(this.wave, this.topicWaves);
    for (const player of this.players.values()) {
      // A grade nobody configured (e.g. a late joiner) falls back to the defaults.
      const chosen = this.config.topics[player.grade];
      const topics = chosen.length ? chosen : DEFAULT_MATH_BOSS_CONFIG.topics[player.grade];
      const topic = topicFor(topics, this.wave, this.topicWaves, this.questionIndex);
      let question = makeQuestion(topic, this.questionIndex, hard, player.name);
      for (let tries = 0; tries < 20 && this.usedPrompts.has(`${player.id}|${question.prompt}`); tries++) {
        question = makeQuestion(topic, this.questionIndex, hard, player.name);
      }
      this.usedPrompts.add(`${player.id}|${question.prompt}`);
      this.questions.set(player.id, question);
    }
    this.phase = "question";
    const duration = [...this.questions.values()].some((question) => question.kind === "number") ? NUMBER_QUESTION_MS : QUESTION_MS;
    this.questionStartedAt = Date.now();
    this.questionEndsAt = this.questionStartedAt + duration;
    this.timer = setTimeout(() => this.endRound(), duration);
    this.broadcastState();
  }

  private answer(playerId: string, value: number) {
    const question = this.questions.get(playerId);
    if (this.phase !== "question" || !question || this.answers.has(playerId)) return;
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    if (question.kind === "choice" && (value < 0 || value >= question.options.length)) return;
    const given = Math.round(value);
    this.answers.set(playerId, given);
    // Graded on arrival: a right answer is a shot that lands right away.
    const hit = given === question.answer;
    this.shots.push({ id: Math.random().toString(36).slice(2, 10), playerId, hit });
    if (hit) this.applyDamage(DAMAGE_PER_CORRECT * this.multiplier());
    this.broadcastState();
    if (this.bossHp <= 0) {
      // Let the killing shot reach the boss before the round wraps up.
      this.clearTimer();
      this.timer = setTimeout(() => this.endRound(), SHOT_FLIGHT_MS + 400);
      return;
    }
    this.maybeEndRoundEarly();
  }

  // Everyone present has answered: wrap up once the last shot has landed.
  private maybeEndRoundEarly() {
    if (this.phase !== "question") return;
    const present = [...this.players.values()].filter((player) => player.connected && this.questions.has(player.id));
    if (present.length === 0 || !present.every((player) => this.answers.has(player.id))) return;
    this.clearTimer();
    this.timer = setTimeout(() => this.endRound(), SHOT_FLIGHT_MS + 500);
  }

  // The rage wave keeps going until the boss falls; it gets weaker the
  // longer it lasts so the first session always ends in a win.
  private multiplier() {
    if (!isRageWave(this.wave, this.topicWaves)) return 1;
    return this.questionIndex >= 8 ? 3 : this.questionIndex >= 5 ? 2 : 1;
  }

  // Before the rage wave the boss can't drop below 10%: every topic gets its
  // wave even when the kids are on fire.
  private applyDamage(amount: number) {
    const floor = isRageWave(this.wave, this.topicWaves) ? 0 : Math.ceil(this.bossMaxHp * 0.1);
    this.bossHp = Math.max(Math.min(this.bossHp, floor), this.bossHp - amount, 0);
  }

  private endRound() {
    if (this.phase !== "question") return;
    this.clearTimer();
    const results = [...this.players.values()]
      .filter((player) => this.questions.has(player.id) && (player.connected || this.answers.has(player.id)))
      .map((player) => {
        const question = this.questions.get(player.id)!;
        const given = this.answers.get(player.id) ?? null;
        return { playerId: player.id, question, given, correct: given === question.answer };
      });
    const correctCount = results.filter((result) => result.correct).length;
    const combo = results.length >= 2 && results.every((result) => result.correct);
    const multiplier = this.multiplier();
    // Each right answer already hit when it was given; a full-team round adds a combo volley on top.
    if (combo) this.applyDamage(COMBO_BONUS * multiplier);
    const damage = (correctCount * DAMAGE_PER_CORRECT + (combo ? COMBO_BONUS : 0)) * multiplier;
    this.teamCorrect += correctCount;
    this.teamAnswered += results.length;
    this.lastOutcome = { roundId: Math.random().toString(36).slice(2, 10), results, damage, combo, multiplier };
    this.phase = "result";
    this.timer = setTimeout(() => this.advanceAfterResult(), RESULT_MS);
    this.broadcastState();
  }

  private advanceAfterResult() {
    if (this.phase !== "result") return;
    if (this.bossHp <= 0) return this.win();
    this.questionIndex += 1;
    if (!isRageWave(this.wave, this.topicWaves) && this.questionIndex >= this.config.questionsPerWave) return this.startIntro(this.wave + 1);
    this.startRound();
  }

  // Safety valve for the tutor if the rage wave drags on.
  private finishBoss() {
    if (!isRageWave(this.wave, this.topicWaves) || !["intro", "question", "result"].includes(this.phase)) return;
    this.win();
  }

  private win() {
    this.clearTimer();
    this.bossHp = 0;
    this.questions.clear();
    this.phase = "victory";
    this.broadcastState();
  }

  // ---------- vote ----------

  private voteTheme(playerId: string, theme: ThemeId) {
    if (this.phase !== "vote" || !this.players.has(playerId) || !THEMES.some((option) => option.id === theme)) return;
    this.themeVotes.set(playerId, theme);
    this.broadcastState();
  }

  private suggestTeamName(playerId: string, rawName: string) {
    if (this.phase !== "vote" || !this.players.has(playerId)) return;
    const name = String(rawName ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
    if (name) this.teamNameIdeas.set(playerId, name);
    else this.teamNameIdeas.delete(playerId);
    this.broadcastState();
  }

  private pickTheme(theme: ThemeId) {
    if (this.phase !== "vote" || !THEMES.some((option) => option.id === theme)) return;
    this.chosenTheme = theme;
    this.broadcastState();
  }

  private pickTeamName(rawName: string) {
    if (this.phase !== "vote") return;
    const name = String(rawName ?? "").trim().slice(0, 24);
    this.chosenTeamName = name || null;
    this.broadcastState();
  }

  private finishVote(sender: Party.Connection) {
    if (!this.chosenTheme) {
      const tally = new Map<ThemeId, number>();
      for (const theme of this.themeVotes.values()) tally.set(theme, (tally.get(theme) ?? 0) + 1);
      const top = Math.max(0, ...tally.values());
      const leaders = [...tally].filter(([, count]) => count === top).map(([theme]) => theme);
      if (leaders.length !== 1) return this.sendError(sender, "Phiếu đang hòa hoặc chưa ai bầu — bấm chọn một chủ đề.");
      this.chosenTheme = leaders[0];
    }
    if (!this.chosenTeamName) {
      const ideas = [...new Set(this.teamNameIdeas.values())];
      if (ideas.length > 1) return this.sendError(sender, "Có nhiều tên đội — bấm chọn một tên.");
      this.chosenTeamName = ideas[0] ?? "Đội Toán Học";
    }
    this.phase = "done";
    this.broadcastState();
  }

  private playAgain() {
    this.clearTimer();
    for (const [id, player] of this.players) if (!player.connected) this.players.delete(id);
    this.phase = "lobby";
    this.wave = 0;
    this.questionIndex = 0;
    this.bossHp = 0;
    this.bossMaxHp = 0;
    this.questions.clear();
    this.questionStartedAt = null;
    this.questionEndsAt = null;
    this.answers.clear();
    this.shots = [];
    this.lastOutcome = null;
    this.themeVotes.clear();
    this.teamNameIdeas.clear();
    this.chosenTheme = null;
    this.chosenTeamName = null;
    this.broadcastState();
  }

  // ---------- helpers ----------

  private isOnline(id: string) {
    return [...this.party.getConnections()].some((connection) => connection.id === id);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private sendError(connection: Party.Connection, message: string) {
    connection.send(JSON.stringify({ type: "error", message } satisfies MathBossServerMessage));
  }

  private publicState(): PublicMathBossState {
    // Answers stay on the server until the round ends.
    const questions: Record<string, PublicQuestion> = {};
    if (this.phase === "question") {
      for (const [id, question] of this.questions) {
        questions[id] = {
          id: question.id,
          grade: question.grade,
          topic: question.topic,
          prompt: question.prompt,
          kind: question.kind,
          options: question.options,
          callout: question.callout,
        };
      }
    }
    return {
      roomId: this.party.id,
      phase: this.phase,
      players: [...this.players.values()],
      config: this.config,
      topicWaves: this.topicWaves,
      showIndex: this.showIndex,
      showRevealed: this.showRevealed,
      wave: this.wave,
      questionIndex: this.questionIndex,
      bossHp: this.bossHp,
      bossMaxHp: this.bossMaxHp,
      questions,
      questionStartedAt: this.phase === "question" ? this.questionStartedAt : null,
      questionEndsAt: this.phase === "question" ? this.questionEndsAt : null,
      answeredIds: this.phase === "question" ? [...this.answers.keys()] : [],
      shots: this.phase === "question" || this.phase === "result" ? this.shots : [],
      lastOutcome: this.phase === "result" ? this.lastOutcome : null,
      teamCorrect: this.teamCorrect,
      teamAnswered: this.teamAnswered,
      themeVotes: Object.fromEntries(this.themeVotes),
      teamNameIdeas: Object.fromEntries(this.teamNameIdeas),
      chosenTheme: this.chosenTheme,
      chosenTeamName: this.chosenTeamName,
    };
  }

  private stateMessage(): MathBossServerMessage {
    return { type: "state", state: this.publicState() };
  }

  private broadcastState() {
    this.party.broadcast(JSON.stringify(this.stateMessage()));
  }
}
