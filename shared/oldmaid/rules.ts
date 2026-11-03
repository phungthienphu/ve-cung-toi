import type { OldMaidConfig, PairRule } from "./models";
import { skillsInPlay, SKILL_BASE, SKILL_ORDER, JOKER, isSkill, rankOf, isRed } from "./config";

export function skillDeck(config: OldMaidConfig): number[] {
  if (!skillsInPlay(config)) return [];
  return Array.from({ length: config.skillCopies }, (_, copy) =>
    config.skills.map((type) => SKILL_BASE + copy * SKILL_ORDER.length + SKILL_ORDER.indexOf(type)),
  ).flat();
}

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
