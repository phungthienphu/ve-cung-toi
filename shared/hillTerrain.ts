import { HILL_MAPS, type HillMapId, type HillPickup } from "./hillTypes";

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
export function hillHeight(seed: number, x: number, map: HillMapId = "tea"): number {
  const at = (m: number) => {
    if (m <= 40) return 0;
    const ramp = Math.min(1, (m - 40) / 18);
    const difficulty = Math.min(1.7, 1 + m / 1600);
    const base = noise(seed, m / 24) * 5 + noise(seed + 7, m / 8) * 1.6;
    // Authored obstacle shapes mixed by seed; each 72 m has a visible challenge and a recovery stretch.
    const section = Math.floor((m - 40) / 72), t = (m - 40) % 72;
    const kind = section === 0 ? 0 : Math.floor(random(seed + 113, section) * 4);
    const height = map === "mountain" ? 9 : map === "sand" ? 6 : map === "moon" ? 5 : 4.2;
    let obstacle = 0;
    if (kind === 0) { // Gradual launch ramp, then a sharp drop and landing basin.
      if (t >= 10 && t < 24) obstacle = (t - 10) / 14 * height;
      else if (t >= 24 && t < 30) obstacle = height * (1 - (t - 24) / 6);
      else if (t >= 30 && t < 43) obstacle = -Math.sin((t - 30) / 13 * Math.PI) * height * 0.5;
    } else if (kind === 1) { // Steep ravine with continuous floor: missed jumps can still climb out.
      if (t >= 12 && t < 42) obstacle = -Math.sin((t - 12) / 30 * Math.PI) * height * 1.2;
    } else if (kind === 2) { // Three rock steps, rounded enough for the Jeep's tyres.
      if (t >= 10 && t < 34) obstacle = Math.floor((t - 10) / 8) * height * 0.28;
      else if (t >= 34 && t < 45) obstacle = height * 0.84 * (1 - (t - 34) / 11);
    } else if (t >= 10 && t < 50) { // Closely spaced humps make throttle timing matter.
      obstacle = Math.sin((t - 10) / 40 * Math.PI * 4) * height * 0.45;
    }
    return ramp * difficulty * (base * HILL_MAPS[map].amplitude + obstacle);

  };
  const i = Math.floor(x);
  return at(i) + (at(i + 1) - at(i)) * (x - i);
}
/** Fuel gaps grow from ~100 m; coin clusters have fixed, reproducible IDs. */
export function hillPickups(seed: number, from: number, to: number, map: HillMapId = "tea", denseFuel = false): HillPickup[] {
  const pickups: HillPickup[] = [];
  for (let i = Math.max(1, Math.floor(from / 20)); i <= Math.ceil(to / 20); i++) {
    for (let j = 0; j < 4; j++) {
      const x = i * 20 + j * 1.8;
      if (x >= from && x <= to) pickups.push({ id: `c${i}-${j}`, x, y: hillHeight(seed, x, map) + 1.2, kind: "coin" });
    }
  }
  for (let i = Math.max(1, Math.floor(from / 65)); i <= Math.ceil(to / 65); i++) {
    const x = i * 65 + 7;
    if (x >= from && x <= to) pickups.push({ id: `e${i}`, x, y: hillHeight(seed, x, map) + 1.4, kind: "energy" });
  }
  if (denseFuel) {
    for (let i = Math.max(1, Math.floor((from - 5) / 60)); i <= Math.ceil((to - 5) / 60); i++) {
      const x = 5 + i * 60; if (x >= from && x <= to) pickups.push({ id: `rf${i}`, x, y: hillHeight(seed, x, map) + 1.1, kind: "fuel" });
    }
    return pickups;
  }
  // Solve the quadratic spacing directly, rather than scanning from the start.
  const first = Math.max(0, Math.floor((-94 + Math.sqrt(94 * 94 + 24 * Math.max(0, from - 95))) / 12) - 1);
  for (let i = first; ; i++) {
    const x = 95 + 94 * i + 6 * i * i + random(seed + 31, i) * 5;
    if (x > to) break;
    if (x >= from) pickups.push({ id: `f${i}`, x, y: hillHeight(seed, x, map) + 1.1, kind: "fuel" });
  }
  return pickups;
}
