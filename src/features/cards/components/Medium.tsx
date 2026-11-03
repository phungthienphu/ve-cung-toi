import type { CSSProperties } from "react";

// The fortune teller and her altar, drawn as inline SVG. Animation lives in
// globals.css (md-*): head sway, blinking, eyes that follow the pointer via
// the --lx / --ly custom properties set on an ancestor, a talking mouth,
// candle flicker and incense smoke.

export type MediumMood = "idle" | "chant" | "shock";

const EYES = [
  { x: 142, clip: "md-eye-l" },
  { x: 178, clip: "md-eye-r" },
];

export function Medium({ mood, talking }: { mood: MediumMood; talking: boolean }) {
  return (
    <svg viewBox="0 0 320 260" aria-hidden className={`md-root md-${mood} ${talking ? "md-talking" : ""} block h-full w-full`}>
      <defs>
        <radialGradient id="md-skin" cx="50%" cy="36%" r="66%">
          <stop offset="0" stopColor="#dcd8c2" />
          <stop offset="0.6" stopColor="#aca992" />
          <stop offset="1" stopColor="#77745f" />
        </radialGradient>
        <linearGradient id="md-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff6a3a" stopOpacity="0.3" />
          <stop offset="0.35" stopColor="#ff6a3a" stopOpacity="0" />
          <stop offset="0.65" stopColor="#ff6a3a" stopOpacity="0" />
          <stop offset="1" stopColor="#ff6a3a" stopOpacity="0.22" />
        </linearGradient>
        <radialGradient id="md-socket" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#120910" stopOpacity="0.95" />
          <stop offset="0.65" stopColor="#2a1a2a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#3a2a35" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="md-iris">
          <stop offset="0" stopColor="#ffe9a0" />
          <stop offset="0.35" stopColor="#ff5a2a" />
          <stop offset="1" stopColor="#8a0a0a" />
        </radialGradient>
        <radialGradient id="md-glow">
          <stop offset="0" stopColor="#ff5030" stopOpacity="0.95" />
          <stop offset="0.4" stopColor="#ff2010" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ff0000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="md-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e1a25" />
          <stop offset="1" stopColor="#050407" />
        </linearGradient>
        <linearGradient id="md-robe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a1220" />
          <stop offset="1" stopColor="#2a0509" />
        </linearGradient>
        <linearGradient id="md-scarf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8192c" />
          <stop offset="1" stopColor="#6e0812" />
        </linearGradient>
        <linearGradient id="md-veil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a0712" />
          <stop offset="1" stopColor="#14020a" />
        </linearGradient>
        {EYES.map((eye) => (
          <clipPath key={eye.clip} id={eye.clip}>
            <ellipse cx={eye.x} cy="110" rx="9" ry="5.2" />
          </clipPath>
        ))}
      </defs>

      {/* Veil and hair behind the shoulders */}
      <path d="M106 66 C 92 120 76 190 50 260 L 270 260 C 244 190 228 120 214 66 Z" fill="url(#md-veil)" />
      <path d="M160 36 C 112 36 100 72 104 112 C 100 160 88 205 72 260 L 248 260 C 232 205 220 160 216 112 C 220 72 208 36 160 36 Z" fill="url(#md-hair)" />
      <g stroke="#2c2634" strokeWidth="1.2" fill="none" opacity="0.8">
        <path d="M108 120 C 104 170 94 210 84 258" />
        <path d="M212 120 C 216 170 226 210 236 258" />
        <path d="M116 150 C 112 190 104 224 98 258" />
        <path d="M204 150 C 208 190 216 224 222 258" />
      </g>

      {/* Neck, robe, collar */}
      <path d="M146 158 C 146 176 144 188 140 198 L 180 198 C 176 188 174 176 174 158 Z" fill="#8a8772" />
      <path d="M58 260 C 64 222 94 202 128 194 L 192 194 C 226 202 256 222 262 260 Z" fill="url(#md-robe)" />
      <path d="M128 194 L 160 244 L 192 194" fill="none" stroke="#e0b84a" strokeWidth="5" strokeLinejoin="round" />
      <path d="M134 194 L 160 234 L 186 194" fill="none" stroke="#2a0509" strokeWidth="2" />
      <path d="M138 199 Q 160 226 182 199" fill="none" stroke="#e0b84a" strokeWidth="4" strokeLinecap="round" strokeDasharray="0.1 6.5" />
      <circle cx="160" cy="214" r="4" fill="#d01f2f" stroke="#e0b84a" strokeWidth="1.2" />
      <g fill="none" stroke="#c9a227" strokeWidth="1.5" opacity="0.5">
        <path d="M80 240 q 12 -10 24 0 q 12 10 24 0" />
        <path d="M192 240 q 12 -10 24 0 q 12 10 24 0" />
      </g>

      <g className="md-head">
        {/* Face */}
        <path d="M160 60 C 190 60 204 84 204 112 C 204 142 190 162 174 172 C 167 177 153 177 146 172 C 130 162 116 142 116 112 C 116 84 130 60 160 60 Z" fill="url(#md-skin)" />
        <path d="M160 60 C 190 60 204 84 204 112 C 204 142 190 162 174 172 C 167 177 153 177 146 172 C 130 162 116 142 116 112 C 116 84 130 60 160 60 Z" fill="url(#md-rim)" />
        <path d="M118 92 C 130 80 145 76 160 76 C 175 76 190 80 202 92 L 202 102 C 190 92 175 88 160 88 C 145 88 130 92 118 102 Z" fill="#000" opacity="0.28" />
        <ellipse cx="132" cy="136" rx="9" ry="15" fill="#4a4636" opacity="0.28" />
        <ellipse cx="188" cy="136" rx="9" ry="15" fill="#4a4636" opacity="0.28" />

        {/* Eyes: sunken sockets, glowing irises that follow the pointer, blinking lids */}
        {EYES.map((eye) => (
          <g key={eye.x}>
            <ellipse cx={eye.x} cy="111" rx="16" ry="12.5" fill="url(#md-socket)" />
            <g className="md-eye">
              <ellipse cx={eye.x} cy="110" rx="9" ry="5.2" fill="#e6dcb4" />
              <g clipPath={`url(#${eye.clip})`}>
                <g className="md-pupil">
                  <circle cx={eye.x} cy="110" r="4.4" fill="url(#md-iris)" />
                  <circle cx={eye.x} cy="110" r="1.7" fill="#160000" />
                  <circle cx={eye.x + 1.4} cy="108.6" r="0.9" fill="#fff" opacity="0.9" />
                </g>
              </g>
              <ellipse className="md-lid" cx={eye.x} cy="110" rx="9.6" ry="5.8" fill="#9d9a85" />
            </g>
            <circle className="md-eye-glow" cx={eye.x} cy="110" r="14" fill="url(#md-glow)" />
          </g>
        ))}
        <g fill="none" strokeLinecap="round">
          <path d="M132 106 Q 142 101 152 106" stroke="#4a4038" strokeWidth="1.2" opacity="0.7" />
          <path d="M168 106 Q 178 101 188 106" stroke="#4a4038" strokeWidth="1.2" opacity="0.7" />
          <path d="M128 119 Q 142 127 156 119" stroke="#3d3140" strokeWidth="1.5" opacity="0.55" />
          <path d="M164 119 Q 178 127 192 119" stroke="#3d3140" strokeWidth="1.5" opacity="0.55" />
          {/* Scowling brows */}
          <path d="M126 99 Q 138 92 155 102" stroke="#17121a" strokeWidth="3.6" />
          <path d="M194 99 Q 182 92 165 102" stroke="#17121a" strokeWidth="3.6" />
          <path d="M142 90 Q 160 86 178 90" stroke="#6c6855" strokeWidth="1" opacity="0.45" />
          <path d="M148 95 Q 160 92 172 95" stroke="#6c6855" strokeWidth="1" opacity="0.4" />
          {/* Nose and the deep lines beside the mouth */}
          <path d="M158 108 C 157 120 153 130 151 136 C 155 140 160 141 165 138" stroke="#5b5747" strokeWidth="1.6" />
          <path d="M147 134 Q 139 146 143 158" stroke="#5b5747" strokeWidth="1.2" opacity="0.5" />
          <path d="M173 134 Q 181 146 177 158" stroke="#5b5747" strokeWidth="1.2" opacity="0.5" />
          <path d="M154 166 Q 160 168 166 166" stroke="#5b5747" strokeWidth="1" opacity="0.35" />
        </g>
        <ellipse cx="162" cy="137" rx="2.5" ry="1.2" fill="#3c3a2f" opacity="0.6" />

        {/* Mouth: opens while she talks, gapes when shocked */}
        <g className="md-mouth">
          <ellipse cx="160" cy="153" rx="9.5" ry="6" fill="#160407" />
          <rect x="154" y="147.5" width="3.2" height="3.6" rx="0.6" fill="#d9cf9e" />
          <rect x="160.5" y="147.5" width="3" height="3" rx="0.6" fill="#cfc28e" />
          <rect x="157" y="156" width="3" height="2.6" rx="0.6" fill="#bfb27e" />
        </g>
        <path d="M147 151 Q 153 153.5 160 152 Q 168 150.5 175 146" fill="none" stroke="#3a0b12" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M152 157 Q 160 159 167 155" fill="none" stroke="#5a1a22" strokeWidth="1.4" opacity="0.6" strokeLinecap="round" />

        {/* Red headscarf with a gold band and a glowing gem */}
        <path d="M206 80 C 222 84 228 100 222 118 C 218 104 212 96 204 92 Z" fill="#8d0e1b" />
        <path d="M112 92 C 108 50 134 30 160 30 C 186 30 212 50 208 92 C 196 78 180 72 160 72 C 140 72 124 78 112 92 Z" fill="url(#md-scarf)" />
        <g fill="none" stroke="#4a0610" strokeWidth="2" opacity="0.6">
          <path d="M118 70 Q 160 46 202 70" />
          <path d="M124 56 Q 160 38 196 56" />
        </g>
        <path d="M112 92 C 124 78 140 72 160 72 C 180 72 196 78 208 92" fill="none" stroke="#e0b84a" strokeWidth="3" />
        <path d="M114 84 C 126 71 142 65 160 65 C 178 65 194 71 206 84" fill="none" stroke="#e0b84a" strokeWidth="1" opacity="0.7" />
        <circle cx="160" cy="68" r="6.5" fill="#e0b84a" stroke="#6b4a0e" strokeWidth="1.2" />
        <circle className="md-gem" cx="160" cy="68" r="3" fill="#ff2a2a" />

        {/* Hair falling over the face */}
        <path d="M118 88 C 110 112 112 150 106 196 C 104 214 108 236 114 260 L 124 260 C 120 236 120 212 124 192 C 128 160 124 124 128 96 Z" fill="url(#md-hair)" />
        <path d="M202 88 C 210 112 208 150 214 196 C 216 214 212 236 206 260 L 196 260 C 200 236 200 212 196 192 C 192 160 196 124 192 96 Z" fill="url(#md-hair)" />
        <path d="M150 76 C 146 92 150 104 143 126" fill="none" stroke="#0d0b10" strokeWidth="1.3" opacity="0.9" />
        <path d="M172 76 C 176 88 172 96 178 104" fill="none" stroke="#0d0b10" strokeWidth="1" opacity="0.7" />
      </g>
    </svg>
  );
}

// [baseX, baseY, tipX, tipY] for each bony finger, then the thumb.
const FINGERS: [number, number, number, number][] = [
  [26, 60, 21, 95],
  [35, 62, 33, 104],
  [45, 62, 46, 105],
  [54, 59, 59, 94],
  [61, 40, 71, 68],
];

/** Long pointed nail continuing a finger past its tip. */
function nail([x1, y1, x2, y2]: [number, number, number, number]) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const dx = (x2 - x1) / length;
  const dy = (y2 - y1) / length;
  const px = -dy * 2.9;
  const py = dx * 2.9;
  return `M${x2 + px} ${y2 + py} L${x2 + dx * 10} ${y2 + dy * 10} L${x2 - px} ${y2 - py} Z`;
}

/** One of her hands resting palm-down on the table, fingers toward the player. */
export function MediumHand({ side, state, style }: { side: "left" | "right"; state: "rest" | "chant" | "away"; style?: CSSProperties }) {
  const mirror = side === "right" ? "scaleX(-1)" : undefined;
  return (
    <div aria-hidden className={`md-hand absolute ${state === "rest" ? "" : `is-${state}`}`} style={style}>
      <svg viewBox="0 0 80 112" className="h-full w-full overflow-visible" style={{ transform: mirror, "--mirror": mirror } as CSSProperties}>
        <path d="M8 0 H72 V20 C 72 26 66 28 60 28 H20 C 14 28 8 26 8 20 Z" fill="#5c0d18" />
        <path d="M8 18 C 8 24 14 28 20 28 H60 C 66 28 72 24 72 18" fill="none" stroke="#e0b84a" strokeWidth="3" />
        <path d="M18 26 C 14 40 16 54 22 62 L 58 62 C 66 54 68 40 62 26 Z" fill="#a9a690" />
        {FINGERS.map(([x1, y1, x2, y2], index) => (
          <g key={index}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5d5a49" strokeWidth="8.4" strokeLinecap="round" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a9a690" strokeWidth="6.6" strokeLinecap="round" />
            {[0.42, 0.74].map((t) => (
              <circle key={t} cx={x1 + (x2 - x1) * t} cy={y1 + (y2 - y1) * t} r="4.3" fill="#b3b09a" stroke="#5d5a49" strokeWidth="0.8" />
            ))}
            <path d={nail([x1, y1, x2, y2])} fill="#1a0a10" stroke="#000" strokeWidth="0.5" strokeLinejoin="round" />
          </g>
        ))}
        <g stroke="#6e6b58" strokeWidth="1" opacity="0.6">
          <line x1="28" y1="30" x2="26" y2="58" />
          <line x1="36" y1="30" x2="35" y2="60" />
          <line x1="45" y1="30" x2="45" y2="60" />
          <line x1="53" y1="30" x2="54" y2="58" />
        </g>
      </svg>
    </div>
  );
}

export function Candle({ style }: { style?: CSSProperties }) {
  return (
    <div aria-hidden className="pointer-events-none absolute" style={style}>
      <div className="md-halo absolute left-1/2 top-[18%] aspect-square w-[260%] rounded-full" />
      <svg viewBox="0 0 40 130" className="relative h-full w-full overflow-visible">
        <defs>
          <linearGradient id="md-wax" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5e0612" />
            <stop offset="0.45" stopColor="#c0182e" />
            <stop offset="1" stopColor="#4a040e" />
          </linearGradient>
          <radialGradient id="md-flame" cx="50%" cy="70%" r="60%">
            <stop offset="0" stopColor="#fff3b0" />
            <stop offset="0.5" stopColor="#ffb340" />
            <stop offset="1" stopColor="#ff5a1a" />
          </radialGradient>
        </defs>
        <path d="M10 56 C 10 52 30 52 30 56 V 130 H 10 Z" fill="url(#md-wax)" />
        <path d="M10 56 C 10 52 30 52 30 56 C 30 60 27 62 27 70 C 27 75 23 75 23 70 C 23 63 18 66 17 76 C 16 82 12 82 12 76 C 12 66 10 62 10 56 Z" fill="#d42238" />
        <line x1="20" y1="54" x2="20" y2="44" stroke="#2a1a10" strokeWidth="1.6" />
        <g className="md-flame">
          <path d="M20 12 C 27 27 28 38 20 46 C 12 38 13 27 20 12 Z" fill="url(#md-flame)" />
          <path d="M20 30 C 23 36 23 41 20 44 C 17 41 17 36 20 30 Z" fill="#fffbe6" />
        </g>
      </svg>
    </div>
  );
}

export function Incense({ style }: { style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 60 140" className="pointer-events-none absolute overflow-visible" style={style}>
      <defs>
        <linearGradient id="md-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0b84a" />
          <stop offset="1" stopColor="#6b4a0e" />
        </linearGradient>
      </defs>
      {[
        { d: "M22 60 C 14 48 30 40 22 28 C 16 18 26 10 22 0", delay: "0s" },
        { d: "M30 56 C 22 44 38 36 30 24 C 24 14 34 6 30 -4", delay: "1.8s" },
        { d: "M38 60 C 30 48 46 40 38 28 C 32 18 42 10 38 0", delay: "3.6s" },
      ].map((smoke) => (
        <path key={smoke.delay} className="md-smoke" d={smoke.d} fill="none" stroke="#d8d2e0" strokeWidth="2.4" strokeLinecap="round" style={{ animationDelay: smoke.delay }} />
      ))}
      <g stroke="#8a1c1c" strokeWidth="2">
        <line x1="24" y1="118" x2="22" y2="62" />
        <line x1="30" y1="118" x2="30" y2="58" />
        <line x1="36" y1="118" x2="38" y2="62" />
      </g>
      {[
        [22, 62],
        [30, 58],
        [38, 62],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="1.8" fill="#ff8a3a" />
      ))}
      <path d="M8 112 H 52 C 52 128 42 136 30 136 C 18 136 8 128 8 112 Z" fill="url(#md-brass)" />
      <ellipse cx="30" cy="112" rx="22" ry="4" fill="#3a2a10" stroke="#e0b84a" strokeWidth="1.2" />
    </svg>
  );
}

/** A faint gold ritual circle under the deck. */
export function Sigil({ style }: { style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 200 200" className="md-sigil pointer-events-none absolute opacity-25" style={style}>
      <g fill="none" stroke="#e0b84a">
        <circle cx="100" cy="100" r="96" strokeWidth="1.2" />
        <circle cx="100" cy="100" r="84" strokeWidth="0.8" strokeDasharray="2 5" />
        <rect x="40" y="40" width="120" height="120" strokeWidth="0.9" />
        <rect x="40" y="40" width="120" height="120" strokeWidth="0.9" transform="rotate(45 100 100)" />
        <circle cx="100" cy="100" r="46" strokeWidth="0.8" />
      </g>
      <g fill="#e0b84a" fontSize="15" textAnchor="middle" dominantBaseline="central">
        <text x="100" y="10">♠</text>
        <text x="190" y="100">♥</text>
        <text x="100" y="190">♦</text>
        <text x="10" y="100">♣</text>
      </g>
    </svg>
  );
}
