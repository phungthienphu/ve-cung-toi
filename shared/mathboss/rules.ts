import { shuffle, DRAFTERS, pick, CALLOUTS, isRageWave, fmt } from "./config";
import type { TopicId, RevealedQuestion } from "./models";

export function choice(correct: string, distractors: string[]): { options: string[]; answer: number } {
  const options = shuffle([...new Set([correct, ...distractors])].slice(0, 4));
  return { options, answer: options.indexOf(correct) };
}

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
