/** Stable domain API: models, configuration and rules are kept in separate modules. */
export type { MathBossPhase, Grade, HeroWeapon, HeroColor, HeroChoice, ThemeId, TopicId, TopicInfo, MathBossConfig, MathBossPlayer, Shot, PublicQuestion, RevealedQuestion, PlayerOutcome, RoundOutcome, PublicMathBossState, MathBossClientMessage, MathBossServerMessage } from "./models";
export { WEAPONS, HERO_COLORS, GRADES, TOPIC_CATALOG, QUESTIONS_PER_WAVE_OPTIONS, MAX_TOPICS_PER_GRADE, DEFAULT_MATH_BOSS_CONFIG, isRageWave, DEMOS, THEMES, QUESTION_MS, NUMBER_QUESTION_MS, RESULT_MS, DAMAGE_PER_CORRECT, COMBO_BONUS, BOSS_HP_PER_PLAYER, MAX_MATH_BOSS_PLAYERS } from "./config";
export { makeQuestion, topicFor, formatNumber } from "./rules";
