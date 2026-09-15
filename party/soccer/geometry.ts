// Small pure helpers shared across the soccer tick/foul modules — same
// spirit as party/tank/geometry.ts, just much shorter since this game has
// far fewer spatial concerns (no tile map, no shove-a-crate physics).

import type { SoccerTeam } from "../../shared/soccerTypes";

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Clamps a coordinate so a circle of the given radius stays fully inside a
 * 0..fieldSize field along that axis. Every player/ball position update
 * needs exactly this shape of clamp (own radius, own field dimension) —
 * factored out since spelling out `clamp(v, radius, fieldSize - radius)`
 * inline at a dozen call sites was most of the file's visual noise. */
export function clampToField(v: number, radius: number, fieldSize: number): number {
  return clamp(v, radius, fieldSize - radius);
}

export function otherTeam(team: SoccerTeam): SoccerTeam {
  return team === "A" ? "B" : "A";
}
