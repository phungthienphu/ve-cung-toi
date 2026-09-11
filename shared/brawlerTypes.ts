// Shared types for the side-view platformer brawler ("Đối Kháng") — kept
// fully separate from tankTypes.ts and shared/types.ts: different room
// shape, different PartyKit party ("brawler"), no coupling to either other
// game. Assets live under public/brawler/ (Kenney-style character/item/tile
// pack) — see BRAWLER_CHARACTERS/BRAWLER_WEAPONS/BRAWLER_HEADGEAR below for
// how their filenames map to selectable options.
//
// This file currently only covers the pre-game flow (character → weapon →
// headgear → team → start) — see party/brawler-server.ts's doc for what's
// deliberately not built yet (the actual match simulation).

export const BRAWLER_CHARACTER_SHAPES = ["round", "square"] as const;
export type BrawlerCharacterShape = (typeof BRAWLER_CHARACTER_SHAPES)[number];

export const BRAWLER_CHARACTER_COLORS = ["Green", "Purple", "Red", "Yellow"] as const;
export type BrawlerCharacterColor = (typeof BRAWLER_CHARACTER_COLORS)[number];

// Matches public/brawler/character_{shape}{Color}.png exactly (e.g.
// "roundGreen" → character_roundGreen.png) — one entry per shape×color
// combination, 8 total.
export const BRAWLER_CHARACTERS = BRAWLER_CHARACTER_SHAPES.flatMap((shape) =>
  BRAWLER_CHARACTER_COLORS.map((color) => `${shape}${color}` as const)
);
export type BrawlerCharacter = (typeof BRAWLER_CHARACTERS)[number];

export const BRAWLER_CHARACTER_LABELS: Record<BrawlerCharacter, string> = {
  roundGreen: "Tròn Lục",
  roundPurple: "Tròn Tím",
  roundRed: "Tròn Đỏ",
  roundYellow: "Tròn Vàng",
  squareGreen: "Vuông Lục",
  squarePurple: "Vuông Tím",
  squareRed: "Vuông Đỏ",
  squareYellow: "Vuông Vàng",
};

/** The separate "hand" overlay sprite (public/brawler/character_hand{Color}.png)
 * only comes in the 4 body colors, not per-shape — a round and a square
 * character of the same color share the same hand art. */
export function handColorFor(character: BrawlerCharacter): BrawlerCharacterColor {
  for (const color of BRAWLER_CHARACTER_COLORS) {
    if (character.endsWith(color)) return color;
  }
  return "Green";
}

// Matches public/brawler/item_{weapon}.png. All 7 available weapons are
// selectable — this is a party game, not a milsim, so rod/pencil are
// legitimate (silly) choices alongside the "real" weapons.
export const BRAWLER_WEAPONS = ["sword", "spear", "bow", "gun", "blaster", "rod", "pencil"] as const;
export type BrawlerWeapon = (typeof BRAWLER_WEAPONS)[number];

export const BRAWLER_WEAPON_LABELS: Record<BrawlerWeapon, string> = {
  sword: "Kiếm",
  spear: "Giáo",
  bow: "Cung",
  gun: "Súng lục",
  blaster: "Súng laser",
  rod: "Cần câu",
  pencil: "Bút chì",
};

// Matches public/brawler/item_{headgear}.png — "none" isn't a real asset,
// it just means "skip this slot" in the selection flow.
export const BRAWLER_HEADGEAR_OPTIONS = ["none", "hat", "hatTop", "helmet", "helmetModern"] as const;
export type BrawlerHeadgear = (typeof BRAWLER_HEADGEAR_OPTIONS)[number];

export const BRAWLER_HEADGEAR_LABELS: Record<BrawlerHeadgear, string> = {
  none: "Không đội gì",
  hat: "Mũ vải",
  hatTop: "Mũ chóp",
  helmet: "Nón bảo hiểm",
  helmetModern: "Nón hiện đại",
};

export type BrawlerTeam = "A" | "B";

export const MAX_BRAWLER_PLAYERS = 4;
export const MIN_BRAWLER_PLAYERS = 2;

export type BrawlerRoomStatus = "lobby" | "playing" | "ended";
export type BrawlerRoomMode = "ffa" | "team" | "practice";
export const BRAWLER_ROOM_MODE_LABELS: Record<BrawlerRoomMode, string> = {
  ffa: "Đấu tự do",
  team: "Đấu đội",
  practice: "Luyện tập",
};

// Each heart in the reference art is one life — losing all HEARTS_PER_PLAYER
// (whether from combat damage or falling off the map, see the earlier
// design discussion) eliminates that player for the match.
export const HEARTS_PER_PLAYER = 3;

export interface BrawlerPlayer {
  id: string;
  name: string;
  // null until the player has actually picked one — the lobby UI walks them
  // through character → weapon → headgear in order, so these fill in one at
  // a time rather than all being required up front.
  character: BrawlerCharacter | null;
  weapon: BrawlerWeapon | null;
  headgear: BrawlerHeadgear;
  team: BrawlerTeam;
  isHost: boolean;
  connected: boolean;
  // True once character + weapon are both chosen — the lobby's "ready to
  // start" check (and the other players' roster view) reads this instead of
  // re-deriving it from the two nullable fields everywhere.
  ready: boolean;
}

export interface BrawlerPublicState {
  roomId: string;
  status: BrawlerRoomStatus;
  mode: BrawlerRoomMode;
  hostId: string | null;
  players: BrawlerPlayer[];
}

export type BrawlerClientMessage =
  | { type: "join"; playerId: string; name: string }
  | { type: "choose_character"; character: BrawlerCharacter }
  | { type: "choose_weapon"; weapon: BrawlerWeapon }
  | { type: "choose_headgear"; headgear: BrawlerHeadgear }
  | { type: "choose_team"; team: BrawlerTeam }
  | { type: "set_mode"; mode: BrawlerRoomMode }
  | { type: "start_game" }
  | { type: "play_again" }
  | { type: "leave_room" };

export type BrawlerServerMessage =
  | { type: "state"; state: BrawlerPublicState }
  | { type: "kicked" }
  | { type: "error"; message: string };
