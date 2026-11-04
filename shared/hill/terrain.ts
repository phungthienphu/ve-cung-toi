import { HILL_MAPS, type HillMapId, type HillPickup } from "./types";

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
/** The authored profile at whole metre m, before climbs are capped (see groundAt). */
function rawHeight(seed: number, m: number, map: HillMapId): number {
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
}

/**
 * Steepest climb on each map, as rise per metre. The two noise octaves and
 * the obstacles could stack into 55–60° walls that no car can drive up
 * (owner's report, 04/11/2026); every car now climbs these without a run-up
 * (the Bus and the Beetle manage ~38°, see HILL_VEHICLES), the Monster with ease.
 * Drops stay as steep as authored: falling off something is fair, a wall isn't.
 */
const MAX_CLIMB: Record<HillMapId, number> = { tea: 0.6, sand: 0.6, mountain: 0.75, moon: 0.7 };

// Heights per seed and map, from metre 40 onwards: each one is the raw height
// or the previous one plus MAX_CLIMB, whichever is lower. A wall becomes a ramp
// that cuts into it until it meets the authored ground again. Always filled in
// order from metre 40, so every caller (server, prediction, renderer) gets the
// same ground whatever it asks for first.
const grounds = new Map<string, number[]>();
let lastKey = "", lastGround: number[] = [];
function groundAt(seed: number, m: number, map: HillMapId): number {
  if (m <= 40) return 0;
  if (!(m < 200_000)) return rawHeight(seed, m, map); // No one drives 200 km; never fill that far.
  const key = `${seed}:${map}`;
  if (key !== lastKey) {
    let ground = grounds.get(key);
    if (!ground) {
      if (grounds.size > 32) grounds.clear();
      ground = [0];
      grounds.set(key, ground);
    }
    lastKey = key;
    lastGround = ground;
  }
  const ground = lastGround, climb = MAX_CLIMB[map];
  while (ground.length <= m - 40) ground.push(Math.min(rawHeight(seed, 40 + ground.length, map), ground[ground.length - 1] + climb));
  return ground[m - 40];
}

/** One height per metre; first 40 m are flat. Stable regardless of generation order. */
export function hillHeight(seed: number, x: number, map: HillMapId = "tea"): number {
  const i = Math.floor(x);
  return groundAt(seed, i, map) + (groundAt(seed, i + 1, map) - groundAt(seed, i, map)) * (x - i);
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
  // Coins along each sky road's deck, and an energy bottle halfway: the reward for getting up there.
  for (const road of hillSkyRoads(seed, from, to, map)) {
    for (let x = road.x0 + 2, j = 0; x < road.x1 - 2; x += 2.2, j++) if (x >= from && x <= to) pickups.push({ id: `d${road.section}-${j}`, x, y: road.y + 1.2, kind: "coin" });
    const middle = (road.x0 + road.x1) / 2;
    if (middle >= from && middle <= to) pickups.push({ id: `de${road.section}`, x: middle, y: road.y + 1.6, kind: "energy" });
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

// ─── Sky roads and water (spec §16) ─────────────────────────────────────────
// Both hang off the authored 72 m sections in hillHeight, decided per section
// by the seed, so the server, the client's prediction and the renderer all
// agree without sending anything. Sky roads only add above the ground; the
// ground itself never changes, so old records stay on the same road.

const SECTION = 72;
const sectionStart = (section: number) => 40 + section * SECTION;
const sectionKind = (seed: number, section: number) => (section === 0 ? 0 : Math.floor(random(seed + 113, section) * 4));

/**
 * A deck in the air past a launch ramp, one-way (fly or jump up through it,
 * land on top). Getting up there takes both: speed off the ramp AND a jump
 * pressed right at the lip (the owner's rule). It sits higher than a fast car
 * flies without jumping, higher than a standing jump reaches, and far enough
 * past the lip that a jump without speed falls short. Flat from x0 to x1,
 * with open air beneath and a free drop off the far end.
 */
export interface HillSkyRoad { section: number; lip: number; x0: number; x1: number; y: number }

/** Upward speed a jump adds (HillSim: an impulse of 6.5 m/s per kilogram), and a brisk speed at a ramp's lip. */
const JUMP_SPEED = 6.5;
const BRISK = 19; // Was 17 before the cars got ~10% faster (04/11/2026), so a run-up alone still falls short.

const skyCache = new Map<string, HillSkyRoad | null>();
const waterCache = new Map<string, { from: number; to: number; level: number } | null>();
function remember<T>(cache: Map<string, T>, key: string, make: () => T): T {
  if (cache.has(key)) return cache.get(key)!;
  if (cache.size > 4000) cache.clear();
  const value = make();
  cache.set(key, value);
  return value;
}

export function hillSkyRoad(seed: number, section: number, map: HillMapId): HillSkyRoad | null {
  return remember(skyCache, `${seed}:${map}:${section}`, () => {
    // Not in the first 150 m (everyone starts on one road); only past launch ramps.
    if (section < 2 || sectionKind(seed, section) !== 0 || random(seed + 211, section) >= 0.75) return null;
    const start = sectionStart(section), lip = start + 24;
    const ground = (x: number) => hillHeight(seed, x, map);
    const gravity = HILL_MAPS[map].gravity;
    const slope = Math.sin(Math.atan2(ground(lip) - ground(start + 10), 14));
    // How high the wheels rise: flying off at speed without a jump, and jumping from a standstill.
    const speedOnly = (BRISK * slope) ** 2 / (2 * gravity);
    const jumpOnly = JUMP_SPEED ** 2 / (2 * gravity);
    const rise = Math.max(speedOnly * 1.15, jumpOnly * 1.1) + 0.3;
    const road = { section, lip, x0: lip + 8, x1: start + 58, y: ground(lip) + rise + 0.35 };
    // Keep the entire lower route open, including clearance for the tallest car.
    for (let x = Math.floor(road.x0); x <= Math.ceil(road.x1); x++) if (ground(x) > road.y - 4) return null;
    return road;
  });
}

export function hillSkyRoads(seed: number, from: number, to: number, map: HillMapId): HillSkyRoad[] {
  const roads: HillSkyRoad[] = [];
  for (let section = Math.max(0, Math.floor((from - 40) / SECTION) - 1); section <= Math.floor((to - 40) / SECTION); section++) {
    const road = hillSkyRoad(seed, section, map);
    if (road && road.x1 >= from && road.x0 <= to) roads.push(road);
  }
  return roads;
}

/** The floating deck's surface at x, or null beyond either end. */
export function hillDeckHeight(seed: number, x: number, map: HillMapId): number | null {
  if (x < 40) return null;
  const section = Math.floor((x - 40) / SECTION);
  for (const road of [hillSkyRoad(seed, section, map), hillSkyRoad(seed, section - 1, map)]) if (road && x >= road.x0 && x <= road.x1) return road.y;
  return null;
}

/** Points along a deck for physics and drawing: its ends plus every whole metre between. */
export function hillDeckPoints(road: HillSkyRoad): { x: number; y: number }[] {
  const xs = [road.x0];
  for (let x = Math.ceil(road.x0); x < road.x1; x++) if (x > road.x0) xs.push(x);
  xs.push(road.x1);
  return xs.map((x) => ({ x, y: road.y }));
}

/** Water in a ravine: its surface level between from and to (where the ground dips below it). No water on the moon. */
export function hillWater(seed: number, section: number, map: HillMapId) {
  return remember(waterCache, `${seed}:${map}:${section}`, () => {
    if (map === "moon" || section < 1 || sectionKind(seed, section) !== 1) return null;
    const start = sectionStart(section);
    let bottom = Infinity;
    for (let t = 12; t <= 42; t++) bottom = Math.min(bottom, hillHeight(seed, start + t, map));
    const rim = Math.min(hillHeight(seed, start + 12, map), hillHeight(seed, start + 42, map));
    const level = Math.min(bottom + 0.6 + 0.12 * (map === "mountain" ? 9 : map === "sand" ? 6 : 4.2), rim - 0.5);
    return level > bottom + 0.2 ? { from: start + 12, to: start + 42, level } : null;
  });
}

/** The water surface at x if x is over water (the ground there is below it), else null. */
export function hillWaterLevel(seed: number, x: number, map: HillMapId): number | null {
  if (x < 40) return null;
  const water = hillWater(seed, Math.floor((x - 40) / SECTION), map);
  return water && x >= water.from && x <= water.to && hillHeight(seed, x, map) < water.level ? water.level : null;
}

/** What a point at height y stands on: a deck if it is above one there, else the ground. */
export function hillSurface(seed: number, x: number, map: HillMapId, y: number): number {
  const deck = hillDeckHeight(seed, x, map);
  return deck !== null && y >= deck - 0.5 ? deck : hillHeight(seed, x, map);
}
