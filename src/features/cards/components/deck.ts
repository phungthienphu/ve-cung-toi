// A standard 52-card French deck. A card is identified by its index 0–51:
// suit = Math.floor(id / 13), rank = id % 13 (0 = Ace … 12 = King).

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";

export const SUITS: { id: Suit; symbol: string; name: string; red: boolean }[] = [
  { id: "spades", symbol: "♠", name: "bích", red: false },
  { id: "hearts", symbol: "♥", name: "cơ", red: true },
  { id: "diamonds", symbol: "♦", name: "rô", red: true },
  { id: "clubs", symbol: "♣", name: "nhép", red: false },
];

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
/** How the ranks are said in Vietnamese ("Át cơ", "Đầm bích", "Già nhép"). */
const RANK_NAMES = ["Át", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Bồi", "Đầm", "Già"];

export const DECK_SIZE = 52;
export const ORDERED_DECK = Array.from({ length: DECK_SIZE }, (_, id) => id);

export interface CardInfo {
  id: number;
  rank: string;
  suit: (typeof SUITS)[number];
  name: string;
  isFace: boolean;
}

export function cardInfo(id: number): CardInfo {
  const suit = SUITS[Math.floor(id / 13)];
  const rankIndex = id % 13;
  return { id, rank: RANKS[rankIndex], suit, name: `${RANK_NAMES[rankIndex]} ${suit.name}`, isFace: rankIndex >= 10 };
}

/**
 * Pip positions (% of the card, x then y) for 2–10, laid out like a real
 * deck: two outer columns and a centre one; pips in the lower half are
 * drawn upside down.
 */
export const PIPS: Record<string, [number, number][]> = {
  "2": [[50, 22], [50, 78]],
  "3": [[50, 22], [50, 50], [50, 78]],
  "4": [[32, 22], [68, 22], [32, 78], [68, 78]],
  "5": [[32, 22], [68, 22], [50, 50], [32, 78], [68, 78]],
  "6": [[32, 22], [68, 22], [32, 50], [68, 50], [32, 78], [68, 78]],
  "7": [[32, 22], [68, 22], [50, 36], [32, 50], [68, 50], [32, 78], [68, 78]],
  "8": [[32, 22], [68, 22], [50, 36], [32, 50], [68, 50], [50, 64], [32, 78], [68, 78]],
  "9": [[32, 21], [68, 21], [32, 40], [68, 40], [50, 50], [32, 60], [68, 60], [32, 79], [68, 79]],
  "10": [[32, 21], [68, 21], [50, 31], [32, 40], [68, 40], [32, 60], [68, 60], [50, 69], [32, 79], [68, 79]],
};

/** A fair Fisher–Yates shuffle using the browser's cryptographic RNG. */
export function shuffled(order: number[]): number[] {
  const result = [...order];
  const random = new Uint32Array(result.length);
  crypto.getRandomValues(random);
  for (let i = result.length - 1; i > 0; i--) {
    const j = random[i] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
