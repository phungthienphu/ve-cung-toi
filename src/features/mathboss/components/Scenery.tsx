import { OUTLINE } from "./HeroSprite";

// The battlefield backdrop: bright sky, sun, drifting clouds, layered hills
// with trees, and a grass-and-dirt floor. Bottom-anchored "slice" scaling
// keeps the floor at the bottom whatever the arena's width; the floor is
// ~60 of the 360 view units, which is what Arena's GROUND_PX matches.

const W = 1200;
const H = 360;
const FLOOR = 300;

/** Wavy grass edge along the top of the floor. */
const grassEdge = (() => {
  let d = `M0 ${H} L0 ${FLOOR + 4}`;
  for (let x = 0; x < W; x += 40) d += ` Q${x + 10} ${FLOOR - 8} ${x + 20} ${FLOOR + 2} T${x + 40} ${FLOOR + 4}`;
  return `${d} L${W} ${H} Z`;
})();

function Cloud({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="50" cy="26" rx="58" ry="14" fill="#dbeafe" />
      <circle cx="18" cy="14" r="20" fill="white" />
      <circle cx="48" cy="2" r="28" fill="white" />
      <circle cx="82" cy="14" r="22" fill="white" />
      <rect x="10" y="12" width="82" height="22" rx="11" fill="white" />
    </g>
  );
}

function Tree({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <rect x="-5" y="-14" width="10" height="26" rx="3" fill="#92400e" stroke={OUTLINE} strokeWidth={3} />
      <circle cx="0" cy="-30" r="24" fill="#16a34a" stroke={OUTLINE} strokeWidth={3} />
      <circle cx="-14" cy="-20" r="14" fill="#16a34a" stroke={OUTLINE} strokeWidth={3} />
      <circle cx="14" cy="-22" r="15" fill="#16a34a" stroke={OUTLINE} strokeWidth={3} />
      <circle cx="0" cy="-30" r="21" fill="#16a34a" />
      <circle cx="-7" cy="-38" r="8" fill="#4ade80" />
    </g>
  );
}

export function Scenery() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="mb2-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="0.6" stopColor="#bae6fd" />
          <stop offset="1" stopColor="#fef3c7" />
        </linearGradient>
        <radialGradient id="mb2-sun-glow">
          <stop offset="0" stopColor="#fef9c3" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fef9c3" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mb2-hill-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a5b4fc" />
          <stop offset="1" stopColor="#c7d2fe" />
        </linearGradient>
        <linearGradient id="mb2-dirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b45309" />
          <stop offset="1" stopColor="#78350f" />
        </linearGradient>
      </defs>

      <rect width={W} height={H} fill="url(#mb2-sky)" />

      <g transform="translate(1050 78)">
        <circle r="95" fill="url(#mb2-sun-glow)" />
        <g className="mb2-sun-rays">
          {Array.from({ length: 12 }, (_, index) => (
            <path key={index} d="M-6 -62 L0 -84 L6 -62 Z" fill="#fde68a" transform={`rotate(${index * 30})`} />
          ))}
        </g>
        <circle r="44" fill="#fde047" stroke="#f59e0b" strokeWidth={5} />
        <circle cx="-14" cy="-14" r="10" fill="#fef9c3" opacity={0.8} />
      </g>

      <g className="mb2-drift-slow">
        <Cloud x={140} y={56} />
        <Cloud x={640} y={36} scale={1.2} />
      </g>
      <g className="mb2-drift-fast" opacity={0.9}>
        <Cloud x={420} y={110} scale={0.75} />
        <Cloud x={880} y={130} scale={0.85} />
      </g>

      {/* far mountains, then two bands of hills */}
      <path d="M0 250 L110 160 L210 226 L350 128 L480 238 L620 148 L760 230 L880 160 L1010 236 L1120 170 L1200 214 L1200 360 L0 360 Z" fill="url(#mb2-hill-far)" />
      <path d="M350 128 L380 154 L366 150 L350 162 L336 150 L322 154 Z M620 148 L644 170 L632 166 L620 176 L608 166 L596 170 Z" fill="white" opacity={0.85} />
      <path d="M0 268 Q150 214 310 256 T620 250 T930 244 T1200 236 L1200 360 L0 360 Z" fill="#86efac" />
      <Tree x={70} y={262} size={0.8} />
      <Tree x={330} y={258} size={0.9} />
      <Tree x={720} y={250} size={0.85} />
      <Tree x={1000} y={246} size={0.95} />
      <path d="M0 292 Q210 250 430 286 T860 282 T1200 272 L1200 360 L0 360 Z" fill="#4ade80" />
      <Tree x={520} y={286} size={0.7} />
      <Tree x={1150} y={280} size={0.75} />

      {/* floor */}
      <rect x="0" y={FLOOR + 8} width={W} height={H - FLOOR} fill="url(#mb2-dirt)" />
      <path d={grassEdge} fill="#65a30d" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <rect x="0" y={FLOOR + 18} width={W} height={H - FLOOR} fill="url(#mb2-dirt)" />
      <path d={`M0 ${FLOOR + 18} H${W}`} stroke={OUTLINE} strokeWidth={4} />
      {[80, 260, 470, 690, 930, 1110].map((x, index) => (
        <ellipse key={x} cx={x} cy={FLOOR + 36 + (index % 2) * 10} rx={14 + (index % 3) * 4} ry="7" fill="#a8a29e" stroke={OUTLINE} strokeWidth={3} />
      ))}
    </svg>
  );
}
