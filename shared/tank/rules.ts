import { TANK_MAPS, TILE_SIZE, TANK_COLORS, TANK_SKINS, DAMAGE_CAUSES } from "./config";
import type { TankMapDef, TankSkin, DamageCause } from "./models";

export function getMap(mapId: string | null | undefined): TankMapDef {
  return TANK_MAPS.find((m) => m.id === mapId) ?? TANK_MAPS[0];
}

export function mapCols(map: TankMapDef): number {
  return map.layout[0].length;
}

export function mapRows(map: TankMapDef): number {
  return map.layout.length;
}

export function mapCanvasSize(map: TankMapDef): { w: number; h: number } {
  return { w: mapCols(map) * TILE_SIZE, h: mapRows(map) * TILE_SIZE };
}

/** A player's chosen tank skin is only ever stored as a swatch color
 * (`TankPlayer.color`) — this recovers the skin id from it. Shared between
 * client (rendering) and server (per-skin skill logic), so both always agree
 * on which skin a given color maps to. */
export function skinForColor(color: string): TankSkin {
  const idx = TANK_COLORS.indexOf(color);
  return TANK_SKINS[idx >= 0 ? idx : 0];
}

export function causeCode(cause: DamageCause): number {
  return DAMAGE_CAUSES.indexOf(cause);
}
