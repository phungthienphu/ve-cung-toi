import { CRATE_MAX_HP, type Crate, type TankMapDef } from "../../shared/tankTypes";
import { makeId, spawnPixel } from "./geometry";

/** Reads every 'C' layout character into a live, pushable/destructible crate
 * entity — called once whenever a match (re)starts. */
export function spawnCratesFromLayout(map: TankMapDef): Crate[] {
  const crates: Crate[] = [];
  for (let row = 0; row < map.layout.length; row++) {
    for (let col = 0; col < map.layout[row].length; col++) {
      if (map.layout[row][col] !== "C") continue;
      const pos = spawnPixel({ x: col, y: row });
      crates.push({ id: makeId(), x: pos.x, y: pos.y, kind: "wood", hp: CRATE_MAX_HP });
    }
  }
  return crates;
}
