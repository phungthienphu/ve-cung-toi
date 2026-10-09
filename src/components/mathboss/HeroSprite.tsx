import type { HeroChoice, HeroColor } from "@shared/mathBossTypes";

// Chibi heroes in a chunky mobile-game style: big head, thick dark outline,
// shaded outfit in the hero's colour. Archers wear a feathered hood and draw
// a bow; gunners wear a cap with goggles and carry a blaster. Facing right.

export const OUTLINE = "#2b1d3a";
const SKIN = "#ffd9b8";

export const HERO_PALETTE: Record<HeroColor, { main: string; dark: string; light: string }> = {
  red: { main: "#f43f5e", dark: "#9f1239", light: "#fecdd3" },
  orange: { main: "#f97316", dark: "#9a3412", light: "#fed7aa" },
  green: { main: "#22c55e", dark: "#166534", light: "#bbf7d0" },
  cyan: { main: "#06b6d4", dark: "#155e75", light: "#a5f3fc" },
  blue: { main: "#6366f1", dark: "#3730a3", light: "#c7d2fe" },
  pink: { main: "#ec4899", dark: "#9d174d", light: "#fbcfe8" },
};

/** A limb: dark outline stroke under a skin-coloured one. */
function Limb({ d }: { d: string }) {
  return (
    <>
      <path d={d} stroke={OUTLINE} strokeWidth={12} strokeLinecap="round" fill="none" />
      <path d={d} stroke={SKIN} strokeWidth={7} strokeLinecap="round" fill="none" />
    </>
  );
}

export function HeroSprite({ hero, firing = false, className = "" }: { hero: HeroChoice; firing?: boolean; className?: string }) {
  const color = HERO_PALETTE[hero.color];
  const bow = hero.weapon === "bow";
  return (
    <svg viewBox="0 0 150 150" className={className} aria-hidden>
      <ellipse cx="62" cy="145" rx="32" ry="5" fill="rgba(0,0,0,0.22)" />

      {/* cape, legs, body */}
      <path d="M46 80 Q22 92 16 126 Q32 118 46 122 Z" fill={color.dark} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <rect x="46" y="110" width="12" height="26" rx="6" fill="#3b3f63" stroke={OUTLINE} strokeWidth={3} />
      <rect x="63" y="110" width="12" height="26" rx="6" fill="#3b3f63" stroke={OUTLINE} strokeWidth={3} />
      <rect x="43" y="131" width="18" height="10" rx="5" fill="#4a2c1a" stroke={OUTLINE} strokeWidth={3} />
      <rect x="61" y="131" width="18" height="10" rx="5" fill="#4a2c1a" stroke={OUTLINE} strokeWidth={3} />
      <rect x="40" y="74" width="42" height="44" rx="16" fill={color.main} stroke={OUTLINE} strokeWidth={3.5} />
      <path d="M44 106 H78" stroke={color.dark} strokeWidth={7} />
      <circle cx="61" cy="106" r="4" fill="#fde047" stroke={OUTLINE} strokeWidth={2} />
      <path d="M48 82 Q50 78 56 78" stroke="white" strokeWidth={3} strokeLinecap="round" opacity={0.45} fill="none" />

      {/* back arm (behind the weapon) */}
      {bow ? <Limb d={firing ? "M52 86 L72 96" : "M52 86 L84 84"} /> : <Limb d="M52 88 L86 94" />}

      {/* head */}
      <circle cx="62" cy="44" r="30" fill={SKIN} stroke={OUTLINE} strokeWidth={3.5} />
      {bow ? (
        <>
          <path d="M31 46 Q30 12 62 12 Q94 12 93 42 Q78 30 62 32 Q44 34 31 46 Z" fill={color.main} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
          <path d="M86 24 Q104 2 80 0 Q88 12 82 22 Z" fill={color.light} stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M31 42 Q32 12 63 12 Q92 14 92 38 Z" fill={color.main} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
          <path d="M88 35 Q106 35 108 41 Q98 44 88 41 Z" fill={color.dark} stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" />
          <rect x="50" y="22" width="32" height="11" rx="5.5" fill="#67e8f9" stroke={OUTLINE} strokeWidth={2.5} />
          <path d="M56 25 L60 25" stroke="white" strokeWidth={2.5} strokeLinecap="round" />
        </>
      )}
      {/* face, looking right */}
      <g className="mb-blink">
        <ellipse cx="70" cy="49" rx="5.5" ry="7" fill="white" stroke={OUTLINE} strokeWidth={2} />
        <ellipse cx="85" cy="49" rx="5" ry="6.5" fill="white" stroke={OUTLINE} strokeWidth={2} />
        <circle cx="72" cy="50" r="3.3" fill={OUTLINE} />
        <circle cx="87" cy="50" r="3.1" fill={OUTLINE} />
        <circle cx="73.2" cy="48.3" r="1.2" fill="white" />
        <circle cx="88" cy="48.3" r="1.1" fill="white" />
      </g>
      <ellipse cx="64" cy="59" rx="5" ry="3" fill="#fb7185" opacity={0.45} />
      <path d={firing ? "M76 60 Q80 66 85 60 Z" : "M75 61 Q80 65 85 61"} stroke={OUTLINE} strokeWidth={2.5} fill={firing ? "#7f1d1d" : "none"} strokeLinecap="round" />

      {/* weapon + front arm */}
      {bow ? (
        <>
          <path d="M104 44 Q130 82 104 120" stroke={OUTLINE} strokeWidth={10} fill="none" strokeLinecap="round" />
          <path d="M104 44 Q130 82 104 120" stroke="#b45309" strokeWidth={5.5} fill="none" strokeLinecap="round" />
          <path d="M106 50 Q118 66 120 80" stroke="#fbbf24" strokeWidth={2} fill="none" opacity={0.7} />
          <path d={firing ? "M104 44 L104 120" : "M104 44 L84 84 L104 120"} stroke="#f8fafc" strokeWidth={1.8} />
          {!firing && (
            <>
              <path d="M84 84 L128 84" stroke={OUTLINE} strokeWidth={5} strokeLinecap="round" />
              <path d="M84 84 L128 84" stroke="#92400e" strokeWidth={2.5} strokeLinecap="round" />
              <path d="M136 84 L124 78 L124 90 Z" fill="#e2e8f0" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
              <path d="M84 84 L78 78 L90 80 Z M84 84 L78 90 L90 88 Z" fill={color.light} stroke={OUTLINE} strokeWidth={1.5} strokeLinejoin="round" />
            </>
          )}
          <Limb d="M70 86 L102 83" />
          <circle cx="103" cy="83" r="6" fill={SKIN} stroke={OUTLINE} strokeWidth={2.5} />
        </>
      ) : (
        <>
          <rect x="82" y="80" width="36" height="15" rx="6" fill="#64748b" stroke={OUTLINE} strokeWidth={3} />
          <rect x="86" y="75" width="20" height="7" rx="3.5" fill={color.main} stroke={OUTLINE} strokeWidth={2.5} />
          <rect x="115" y="83" width="13" height="9" rx="2.5" fill="#475569" stroke={OUTLINE} strokeWidth={2.5} />
          <rect x="88" y="91" width="10" height="15" rx="3" fill="#334155" stroke={OUTLINE} strokeWidth={2.5} />
          <path d="M88 84 H110" stroke="white" strokeWidth={2} opacity={0.35} strokeLinecap="round" />
          <circle cx="124" cy="87.5" r="2.4" fill="#fde047" />
          {firing && (
            <path
              d="M130 87 L140 79 L139 85 L150 87 L139 90 L140 96 Z"
              fill="#fde047"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeLinejoin="round"
            />
          )}
          <Limb d="M70 88 L92 90" />
          <circle cx="93" cy="91" r="6" fill={SKIN} stroke={OUTLINE} strokeWidth={2.5} />
        </>
      )}
    </svg>
  );
}

/** What flies across the arena: an arrow with a light trail, or a glowing round. */
export function Projectile({ weapon, color }: { weapon: HeroChoice["weapon"]; color: HeroColor }) {
  const palette = HERO_PALETTE[color];
  if (weapon === "bow") {
    return (
      <svg viewBox="0 0 120 20" className="h-5 w-[7.5rem]" aria-hidden>
        <defs>
          <linearGradient id="mb2-trail" x1="0" x2="1">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset="1" stopColor="white" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <rect x="0" y="8" width="60" height="4" rx="2" fill="url(#mb2-trail)" />
        <path d="M58 10 L106 10" stroke={OUTLINE} strokeWidth={5} strokeLinecap="round" />
        <path d="M58 10 L106 10" stroke="#92400e" strokeWidth={2.5} strokeLinecap="round" />
        <path d="M116 10 L103 3 L103 17 Z" fill="#e2e8f0" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
        <path d="M60 10 L53 3 L66 5 Z M60 10 L53 17 L66 15 Z" fill={palette.light} stroke={OUTLINE} strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 90 20" className="h-5 w-[5.5rem]" aria-hidden>
      <defs>
        <linearGradient id="mb2-tracer" x1="0" x2="1">
          <stop offset="0" stopColor="#fde047" stopOpacity="0" />
          <stop offset="1" stopColor="#fde047" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <rect x="0" y="7" width="64" height="6" rx="3" fill="url(#mb2-tracer)" />
      <circle cx="74" cy="10" r="9" fill="#fef08a" opacity={0.6} />
      <rect x="62" y="4" width="22" height="12" rx="6" fill="#facc15" stroke={OUTLINE} strokeWidth={2.5} />
      <path d="M66 7 H76" stroke="white" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
