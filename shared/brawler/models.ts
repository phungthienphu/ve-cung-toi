import type { BRAWLER_CHARACTER_SHAPES, BRAWLER_CHARACTER_COLORS, BRAWLER_CHARACTERS, BRAWLER_WEAPONS, BRAWLER_HEADGEAR_OPTIONS } from "./config";

export type BrawlerCharacterShape = (typeof BRAWLER_CHARACTER_SHAPES)[number];

export type BrawlerCharacterColor = (typeof BRAWLER_CHARACTER_COLORS)[number];

export type BrawlerCharacter = (typeof BRAWLER_CHARACTERS)[number];

export type BrawlerWeapon = (typeof BRAWLER_WEAPONS)[number];

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

export type BrawlerHeadgear = (typeof BRAWLER_HEADGEAR_OPTIONS)[number];

export type BrawlerTeam = "A" | "B";

export type BrawlerRoomStatus = "lobby" | "playing" | "ended";

export type BrawlerRoomMode = "ffa" | "team" | "practice";

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
