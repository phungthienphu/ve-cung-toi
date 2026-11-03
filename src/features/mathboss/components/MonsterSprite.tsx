import { OUTLINE } from "./HeroSprite";

export type MonsterMood = "idle" | "walk" | "angry" | "hurt" | "laugh" | "defeated";

const KEY_ROWS = [
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "−"],
];

/**
 * Quái Máy Tính as a proper boss: a hulking calculator with horns, fists,
 * stomping legs and an LCD for a mouth. Faces left (toward the heroes).
 * `rage` turns it red for the final wave.
 */
export function MonsterSprite({ mood, rage = false, screen, className = "" }: { mood: MonsterMood; rage?: boolean; screen: string; className?: string }) {
  const top = rage ? "#fb7185" : "#c084fc";
  const bottom = rage ? "#9f1239" : "#6b21a8";
  const limb = rage ? "#be123c" : "#7e22ce";
  const limbDark = rage ? "#881337" : "#581c87";
  const defeated = mood === "defeated";
  const fierce = rage || mood === "angry" || mood === "laugh";
  const gradientId = rage ? "mb2-body-rage" : "mb2-body";

  return (
    <svg viewBox="0 0 240 280" className={`${className} ${mood === "walk" ? "mb2-walking" : ""}`} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <ellipse cx="122" cy="272" rx="86" ry="9" fill="rgba(0,0,0,0.25)" />

      {/* legs */}
      <g className="mb2-leg-b">
        <rect x="134" y="206" width="34" height="50" rx="14" fill={limbDark} stroke={OUTLINE} strokeWidth={5} />
        <rect x="128" y="244" width="52" height="24" rx="12" fill="#3b0764" stroke={OUTLINE} strokeWidth={5} />
      </g>
      <g className="mb2-leg-a">
        <rect x="70" y="206" width="34" height="50" rx="14" fill={limb} stroke={OUTLINE} strokeWidth={5} />
        <rect x="58" y="244" width="52" height="24" rx="12" fill="#3b0764" stroke={OUTLINE} strokeWidth={5} />
      </g>

      <g className="mb2-body">
        {/* back arm */}
        <g className="mb2-arm">
          <rect x="188" y="122" width="44" height="26" rx="13" fill={limbDark} stroke={OUTLINE} strokeWidth={5} />
          <circle cx="228" cy="135" r="17" fill={limb} stroke={OUTLINE} strokeWidth={5} />
        </g>
        {/* horns */}
        <path d="M68 52 Q48 12 80 4 Q76 30 94 46 Z" fill="#fb923c" stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
        <path d="M172 52 Q192 12 160 4 Q164 30 146 46 Z" fill="#fb923c" stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
        <path d="M74 20 Q72 12 78 9" stroke="#fed7aa" strokeWidth={3} strokeLinecap="round" fill="none" />

        {/* body */}
        <rect x="36" y="42" width="168" height="186" rx="38" fill={`url(#${gradientId})`} stroke={OUTLINE} strokeWidth={6} />
        <path d="M58 72 Q60 56 80 52" stroke="white" strokeWidth={7} strokeLinecap="round" opacity={0.4} fill="none" />

        {/* eyes + brows */}
        {defeated ? (
          <g stroke={OUTLINE} strokeWidth={7} strokeLinecap="round">
            <path d="M80 76 L102 98 M102 76 L80 98" />
            <path d="M138 76 L160 98 M160 76 L138 98" />
          </g>
        ) : (
          <>
            <ellipse cx="91" cy="88" rx="18" ry={mood === "hurt" ? 8 : 20} fill="white" stroke={OUTLINE} strokeWidth={5} />
            <ellipse cx="149" cy="88" rx="18" ry={mood === "hurt" ? 8 : 20} fill="white" stroke={OUTLINE} strokeWidth={5} />
            {mood !== "hurt" && (
              <>
                <circle cx="84" cy="92" r="8.5" fill={fierce ? "#dc2626" : OUTLINE} />
                <circle cx="142" cy="92" r="8.5" fill={fierce ? "#dc2626" : OUTLINE} />
                <circle cx="81" cy="88" r="2.6" fill="white" />
                <circle cx="139" cy="88" r="2.6" fill="white" />
              </>
            )}
            <path d={fierce ? "M66 60 L112 76" : "M68 64 L110 70"} stroke={OUTLINE} strokeWidth={9} strokeLinecap="round" />
            <path d={fierce ? "M174 60 L128 76" : "M172 64 L130 70"} stroke={OUTLINE} strokeWidth={9} strokeLinecap="round" />
          </>
        )}

        {/* LCD mouth */}
        <rect x="60" y="118" width="120" height="50" rx="11" fill="#d9f99d" stroke={OUTLINE} strokeWidth={5} />
        <rect x="66" y="124" width="108" height="8" rx="4" fill="#ecfccb" opacity={0.8} />
        <text x="170" y="155" textAnchor="end" fontFamily="ui-monospace, monospace" fontWeight={800} fontSize={30} fill="#1a2e05">
          {screen}
        </text>

        {/* keypad */}
        {KEY_ROWS.map((row, rowIndex) =>
          row.map((key, colIndex) => {
            const x = 71 + colIndex * 26;
            const y = 178 + rowIndex * 16;
            const op = colIndex === 3;
            return (
              <g key={key}>
                <rect x={x} y={y} width="20" height="12" rx="4" fill={op ? "#fbbf24" : "#ede9fe"} stroke={OUTLINE} strokeWidth={2.5} />
              </g>
            );
          })
        )}

        {/* front arm */}
        <g className="mb2-arm">
          <rect x="8" y="122" width="44" height="26" rx="13" fill={limb} stroke={OUTLINE} strokeWidth={5} />
          <circle cx="14" cy="135" r="19" fill={top} stroke={OUTLINE} strokeWidth={5} />
          <path d="M6 128 Q10 124 16 125" stroke="white" strokeWidth={3} strokeLinecap="round" opacity={0.5} fill="none" />
        </g>

        {defeated && (
          <g className="mb2-dizzy" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            <path d="M84 10 l4 9 10 1 -8 6 3 10 -9 -6 -9 6 3 -10 -8 -6 10 -1 Z" fill="#fde047" stroke={OUTLINE} strokeWidth={2.5} />
            <path d="M150 0 l3 7 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5 8 -1 Z" fill="#fde047" stroke={OUTLINE} strokeWidth={2.5} />
          </g>
        )}
      </g>
    </svg>
  );
}
