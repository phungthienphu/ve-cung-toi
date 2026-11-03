import type { BrawlerCharacter, BrawlerCharacterColor } from "./models";
import { BRAWLER_CHARACTER_COLORS } from "./config";

export function handColorFor(character: BrawlerCharacter): BrawlerCharacterColor {
  for (const color of BRAWLER_CHARACTER_COLORS) {
    if (character.endsWith(color)) return color;
  }
  return "Green";
}
