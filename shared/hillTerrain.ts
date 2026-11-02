import type { HillPickup } from "./hillTypes";

function random(seed: number, n: number): number {
  let h = Math.imul(n ^ seed, 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(seed: number, x: number): number {
  const i = Math.floor(x);
  const t = x - i;
  const s = t * t * (3 - 2 * t);
  return (random(seed, i) * (1 - s) + random(seed, i + 1) * s) * 2 - 1;
}
/** One height per metre; first 40 m are flat. Stable regardless of generation order. */
export function hillHeight(seed: number, x: number): number {
  const at = (m: number) => {
    if (m <= 40) return 0;
    const ramp = Math.min(1, (m - 40) / 40);
    const difficulty = Math.min(2.5, 1 + m / 1200);
    return ramp * difficulty * (noise(seed, m / 30) * 5 + noise(seed + 7, m / 11) * 1.3);
  };
  const i = Math.floor(x);
  return at(i) + (at(i + 1) - at(i)) * (x - i);
}
/** Fuel gaps grow from ~100 m; coin clusters have fixed, reproducible IDs. */
export function hillPickups(seed: number, from: number, to: number): HillPickup[] {
  const pickups: HillPickup[] = [];
  for (let i = Math.max(1, Math.floor(from / 20)); i <= Math.ceil(to / 20); i++) {
    for (let j = 0; j < 4; j++) {
      const x = i * 20 + j * 1.8;
      if (x >= from && x <= to) pickups.push({ id: `c${i}-${j}`, x, y: hillHeight(seed, x) + 1.2, kind: "coin" });
    }
  }
  // Solve the quadratic spacing directly, rather than scanning from the start.
  const first = Math.max(0, Math.floor((-94 + Math.sqrt(94 * 94 + 24 * Math.max(0, from - 95))) / 12) - 1);
  for (let i = first; ; i++) {
    const x = 95 + 94 * i + 6 * i * i + random(seed + 31, i) * 5;
    if (x > to) break;
    if (x >= from) pickups.push({ id: `f${i}`, x, y: hillHeight(seed, x) + 1.1, kind: "fuel" });
  }
  return pickups;
}
