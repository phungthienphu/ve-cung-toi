// Composites a player's chosen character/weapon/headgear into one preview —
// used both in the lobby roster and live while picking, so what you see
// while choosing is exactly what others will see next to your name.
//
// IMPORTANT: unlike a proper paper-doll rig, Kenney's individual pieces here
// have no attachment-point data — every sprite (body, hand, each item) is
// independently centered within its own 128x128 (or 128x256 for long
// weapons) canvas, confirmed by checking each PNG's actual non-transparent
// bounding box (Python/PIL, not guessed). There's no "hand position" or
// "head position" encoded anywhere to line a weapon/hat up against. So this
// draws the body full-size, then the weapon+hand as one small badge near
// where a held item would be, and the headgear as a small badge near the top
// of the head — approximate by design, not true anatomical compositing.
//
// The item/hand images also ship with a lot of transparent padding around
// the actual drawing (e.g. item_helmet.png is a 128x128 canvas but the
// helmet art only fills a 94x88 region of it) — sizing the visible sprite
// by scaling that whole padded canvas wastes most of the size increase on
// invisible margin. public/brawler/cropped/*.png are pre-cropped (via PIL,
// scripted, not by hand) to their real bounding box, so a size percentage
// here maps directly to visible size instead of canvas size. Only the
// character body itself is used uncropped (its padding is minimal).
//
// One weapon "hold" can't cover every weapon: sword/pencil/bow are all a
// similar elongated portrait shape and share one config fine, but spear/rod
// are much taller/thinner sticks and gun/blaster are short and wide — the
// same box+rotation that looks like "holding" a sword makes those look
// broken (a spear blown up past the character, a gun squashed flat). Each
// gets its own WEAPON_HOLD entry instead of one formula for all 7. Every
// number below (this file's whole layout, really) was tuned by rendering
// this same composite with PIL against all 7 weapons and all 4 headgear
// options and eyeballing the result, not guessed — see the conversation
// history if it ever needs re-tuning for a new asset.

import type { CSSProperties } from "react";
import {
  BRAWLER_WEAPON_CONFIG,
  handColorFor,
  type BrawlerAttackType,
  type BrawlerCharacter,
  type BrawlerHeadgear,
  type BrawlerWeapon,
} from "@shared/brawlerTypes";

interface Props {
  character: BrawlerCharacter | null;
  weapon?: BrawlerWeapon | null;
  headgear?: BrawlerHeadgear;
  sizeClassName?: string;
  // Loops the weapon through an attack motion (see globals.css's
  // brawler-anim-* keyframes) instead of holding it still — for the "show
  // off your loadout" showcase panel, not the compact roster row (looping
  // animation on every player's tiny portrait at once would just be noise).
  animate?: boolean;
}

// One animation class per BrawlerAttackType (shared/brawlerTypes.ts) — that
// enum already distinguishes swing vs thrust vs ranged vs hook for gameplay
// purposes, so the showcase animation reads straight from it instead of
// keeping its own separate weapon→style table in sync by hand.
const ATTACK_ANIM_CLASS: Record<BrawlerAttackType, string> = {
  "melee-swing": "brawler-anim-swing",
  "melee-thrust": "brawler-anim-thrust",
  ranged: "brawler-anim-recoil",
  hook: "brawler-anim-thrust-long",
};

// Which local axis a weapon's recoil needs depends on its *attack* rotation
// angle, not its gameplay category or even its native art shape: gun/blaster
// are landscape art held level (attack angle ~0), so translateX already
// moves along their length. Bow is portrait art but its attack pose keeps
// the bow itself upright (attack angle ~0, unlike spear/pencil which rotate
// to ~90) — a real bow stays vertical while the *shot* recoils sideways, so
// at that near-0 rotation it also needs translateX, not translateY. This is
// about the final on-screen angle, not what the PNG looks like standalone.
const RECOIL_X_WEAPONS = new Set<BrawlerWeapon>(["gun", "blaster", "bow"]);

interface WeaponHold {
  left: number; // % of the preview box
  top: number;
  box: number; // square box the weapon is fit into (longest side = box)
  rotateDeg: number;
  handLeft: number;
  handTop: number;
  // Optional — a different rotation used only while `animate` is on, for
  // weapons whose natural *carry* angle (diagonal, like resting a spear on
  // your shoulder) doesn't match their *attack* angle (roughly level, to
  // thrust straight ahead). Falls back to `rotateDeg` when omitted, so a
  // weapon whose carry and attack angle are the same (sword, whose swing
  // animation already reorients it via its own keyframe delta) doesn't need
  // an entry here at all.
  attackRotateDeg?: number;
}

const DEFAULT_HOLD: WeaponHold =  { left: 20, top: -20, box: 92, rotateDeg: 25, handLeft: 85, handTop: 60 };

// Only weapons whose shape doesn't work with DEFAULT_HOLD get their own
// entry — sword/bow read fine as "held diagonally like a sword" so they
// fall through to the default below.
const WEAPON_HOLD: Partial<Record<BrawlerWeapon, WeaponHold>> = {
  // Spear/fishing rod: much taller and thinner than a sword — carried
  // diagonally like a raised pike (same idle angle as the default), but
  // thrusts roughly level (with a slight upward tilt) when attacking,
  // rather than stabbing along the same diagonal it's carried at. Note the
  // rotation convention here: this art's tip sits at the *top* of the
  // source image, so 0deg points straight up and 90deg points straight
  // right — "mostly horizontal, tilted up a bit" is ~80deg, not a small
  // number near 0.
  spear: { left: 30, top: 5, box: 112, rotateDeg: 25, attackRotateDeg: 80, handLeft: 82, handTop: 60 },
  rod: { left: 38, top: -5, box: 112, rotateDeg: 25, attackRotateDeg: 80, handLeft: 82, handTop: 50 },
  // Same idea as spear/rod — carried diagonally, thrusts level.
  pencil: { left: 46, top: 20, box: 85, rotateDeg: 25, attackRotateDeg: 80, handLeft: 74, handTop: 58 },
  // Bow: carried diagonally over the shoulder like a spear, but drawn/aimed
  // level to the right when actually shooting — same "0deg=up, 90deg=right"
  // convention as spear/pencil above, and reuses the same recoil motion as
  // gun/blaster once level (pull back on release, not a forward thrust).
  bow: { left: 52, top: 0, box: 100, rotateDeg: 25, attackRotateDeg: 0, handLeft: 82, handTop: 55 },
  // Gun/blaster: short and wide, held roughly level rather than swung —
  // carry and attack angle are already the same, no override needed.
  gun: { left: 76, top: 18, box: 62, rotateDeg: -10, handLeft: 80, handTop: 58 },
  blaster: { left: 76, top: 18, box: 62, rotateDeg: -10, handLeft: 80, handTop: 58 },
};

export default function CharacterPreview({ character, weapon, headgear, sizeClassName = "h-16 w-16", animate = false }: Props) {
  if (!character) {
    return <div className={`${sizeClassName} rounded-lg bg-slate-100`} />;
  }
  const handColor = handColorFor(character);
  const hold = weapon ? (WEAPON_HOLD[weapon] ?? DEFAULT_HOLD) : null;
  let animClass = "";
  if (animate && weapon) {
    animClass = ATTACK_ANIM_CLASS[BRAWLER_WEAPON_CONFIG[weapon].attackType];
    if (RECOIL_X_WEAPONS.has(weapon)) animClass = "brawler-anim-recoil-x";
  }
  // Only swap to the attack angle while actually showcasing the attack —
  // the static roster/preview view (animate=false) always shows the
  // resting carry angle. See WeaponHold.attackRotateDeg's doc.
  const baseRotateDeg = animate && hold?.attackRotateDeg !== undefined ? hold.attackRotateDeg : (hold?.rotateDeg ?? 0);
  return (
    <div className={`relative ${sizeClassName}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brawler/character_${character}.png`} alt="" className="absolute inset-0 h-full w-full object-contain" />

      {headgear && headgear !== "none" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/brawler/cropped/item_${headgear}.png`} alt="" className="absolute left-[10%] top-[-20%] h-auto w-[75%]" />
      )}

      {weapon && hold && (
        // Fixed square box + object-contain, not a width%-with-h-auto —
        // see WEAPON_HOLD's doc for why every weapon needs its own hold.
        <div
          className={`absolute ${animClass}`}
          style={
            {
              left: `${hold.left}%`,
              top: `${hold.top}%`,
              width: `${hold.box}%`,
              height: `${hold.box}%`,
              transform: `rotate(${baseRotateDeg}deg)`,
              "--brawler-base-rot": `${baseRotateDeg}deg`,
            } as CSSProperties
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/brawler/cropped/item_${weapon}.png`} alt="" className="h-full w-full object-contain" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/brawler/cropped/character_hand${handColor}.png`}
        alt=""
        className="absolute h-auto w-[14%]"
        style={{ left: `${hold?.handLeft ?? DEFAULT_HOLD.handLeft}%`, top: `${hold?.handTop ?? DEFAULT_HOLD.handTop}%` }}
      />
    </div>
  );
}
