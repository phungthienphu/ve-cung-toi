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

/** How a weapon's attack actually resolves once combat exists — decided now
 * (per weapon, not per game) so building the real attack/hit-detection code
 * later is "switch on attackType and read this table" instead of designing
 * each weapon's behavior from scratch mid-implementation. Also doubles as
 * the single source of truth for the lobby's weapon-showcase animation
 * (CharacterPreview.tsx's WEAPON_ANIM_CLASS) — one enum, not a separate
 * gameplay category and a separate animation category that have to be kept
 * in sync by hand.
 * - "melee-swing": a wide arcing hitbox — sword's chop.
 * - "melee-thrust": a narrow poke straight ahead, shorter windup than a
 *   swing — spear/pencil.
 * - "ranged": spawns a travelling projectile, same shape as tank's bullets.
 * - "hook": bigRed's hook mechanic from the tank game, reused here — fires
 *   out, and on landing pulls the target toward the caster instead of (or
 *   in addition to) dealing damage.
 * range/speed/knockback are qualitative on purpose — the actual px/ms
 * numbers get tuned once there's a real match loop to tune them against;
 * this table exists to lock in each weapon's *category* and relative feel
 * ahead of time, not its exact constants. */
export type BrawlerAttackType = "melee-swing" | "melee-thrust" | "ranged" | "hook";

export interface BrawlerWeaponConfig {
  attackType: BrawlerAttackType;
  range: "short" | "medium" | "long";
  speed: "slow" | "medium" | "fast";
  knockback: "none" | "light" | "heavy";
  // "hook" only: the rod isn't purely a control tool — up close it can also
  // throw a plain melee hit, just a weaker one than any dedicated melee
  // weapon. The design intent (see BRAWLER_WEAPON_CONFIG.rod) is a
  // counter-pick against ranged weapons — reel them in, then finish with a
  // mediocre hit — rather than something worth using for its own damage.
  secondaryMeleeDamage?: "weak";
  description: string;
}

export const BRAWLER_WEAPON_CONFIG: Record<BrawlerWeapon, BrawlerWeaponConfig> = {
  sword: { attackType: "melee-swing", range: "short", speed: "medium", knockback: "light", description: "Chém cận chiến, tốc độ vừa phải." },
  spear: { attackType: "melee-thrust", range: "medium", speed: "slow", knockback: "light", description: "Đâm cận chiến, tầm xa hơn kiếm nhưng ra đòn chậm hơn." },
  pencil: { attackType: "melee-thrust", range: "short", speed: "fast", knockback: "none", description: "Đâm rất nhanh, tầm ngắn, sát thương nhẹ." },
  bow: { attackType: "ranged", range: "long", speed: "medium", knockback: "none", description: "Bắn tên tầm xa." },
  gun: { attackType: "ranged", range: "long", speed: "fast", knockback: "none", description: "Bắn nhanh, tầm xa." },
  blaster: { attackType: "ranged", range: "long", speed: "fast", knockback: "light", description: "Bắn tia laser, tầm xa, hất nhẹ khi trúng." },
  // Same mechanic as bigRed's hook in the tank game — fires out along the
  // aim, pulls the target in on landing. Unlike bigRed, it also has a plain
  // melee swing for once the target's already close — deliberately weaker
  // than a real melee weapon, so its value is "counters ranged players by
  // dragging them into a fight they didn't want", not raw damage.
  rod: {
    attackType: "hook",
    range: "medium",
    speed: "slow",
    knockback: "heavy",
    secondaryMeleeDamage: "weak",
    description: "Móc câu kéo địch lại gần; ở tầm gần đánh thường được nhưng sát thương yếu hơn vũ khí cận chiến — khắc chế vũ khí tầm xa.",
  },
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
