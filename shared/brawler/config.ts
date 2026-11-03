import type { BrawlerCharacter, BrawlerWeapon, BrawlerWeaponConfig, BrawlerHeadgear, BrawlerRoomMode } from "./models";

export const BRAWLER_CHARACTER_SHAPES = ["round", "square"] as const;

export const BRAWLER_CHARACTER_COLORS = ["Green", "Purple", "Red", "Yellow"] as const;

// Matches public/brawler/character_{shape}{Color}.png exactly (e.g.
// "roundGreen" → character_roundGreen.png) — one entry per shape×color
// combination, 8 total.
export const BRAWLER_CHARACTERS = BRAWLER_CHARACTER_SHAPES.flatMap((shape) =>
  BRAWLER_CHARACTER_COLORS.map((color) => `${shape}${color}` as const)
);

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

// Matches public/brawler/item_{weapon}.png. All 7 available weapons are
// selectable — this is a party game, not a milsim, so rod/pencil are
// legitimate (silly) choices alongside the "real" weapons.
export const BRAWLER_WEAPONS = ["sword", "spear", "bow", "gun", "blaster", "rod", "pencil"] as const;

export const BRAWLER_WEAPON_LABELS: Record<BrawlerWeapon, string> = {
  sword: "Kiếm",
  spear: "Giáo",
  bow: "Cung",
  gun: "Súng lục",
  blaster: "Súng laser",
  rod: "Cần câu",
  pencil: "Bút chì",
};

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

export const BRAWLER_HEADGEAR_LABELS: Record<BrawlerHeadgear, string> = {
  none: "Không đội gì",
  hat: "Mũ vải",
  hatTop: "Mũ chóp",
  helmet: "Nón bảo hiểm",
  helmetModern: "Nón hiện đại",
};

export const MAX_BRAWLER_PLAYERS = 4;

export const MIN_BRAWLER_PLAYERS = 2;

export const BRAWLER_ROOM_MODE_LABELS: Record<BrawlerRoomMode, string> = {
  ffa: "Đấu tự do",
  team: "Đấu đội",
  practice: "Luyện tập",
};

// Each heart in the reference art is one life — losing all HEARTS_PER_PLAYER
// (whether from combat damage or falling off the map, see the earlier
// design discussion) eliminates that player for the match.
export const HEARTS_PER_PLAYER = 3;
