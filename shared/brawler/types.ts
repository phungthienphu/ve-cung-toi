/** Stable domain API: models, configuration and rules are kept in separate modules. */
export type { BrawlerCharacterShape, BrawlerCharacterColor, BrawlerCharacter, BrawlerWeapon, BrawlerAttackType, BrawlerWeaponConfig, BrawlerHeadgear, BrawlerTeam, BrawlerRoomStatus, BrawlerRoomMode, BrawlerPlayer, BrawlerPublicState, BrawlerClientMessage, BrawlerServerMessage } from "./models";
export { BRAWLER_CHARACTER_SHAPES, BRAWLER_CHARACTER_COLORS, BRAWLER_CHARACTERS, BRAWLER_CHARACTER_LABELS, BRAWLER_WEAPONS, BRAWLER_WEAPON_LABELS, BRAWLER_WEAPON_CONFIG, BRAWLER_HEADGEAR_OPTIONS, BRAWLER_HEADGEAR_LABELS, MAX_BRAWLER_PLAYERS, MIN_BRAWLER_PLAYERS, BRAWLER_ROOM_MODE_LABELS, HEARTS_PER_PLAYER } from "./config";
export { handColorFor } from "./rules";
