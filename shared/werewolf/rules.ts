import type { WerewolfRole } from "./models";
import { ROLE_PRESETS } from "./config";

export function rolesForPlayerCount(count: number): WerewolfRole[] {
  const preset = ROLE_PRESETS[count];
  if (preset) return [...preset];

  const fixedRoles: WerewolfRole[] = ["wolf", "wolf", "wolf", "seer", "guardian", "witch"];
  const villagers = Array<WerewolfRole>(Math.max(0, count - fixedRoles.length)).fill("villager");
  return [...fixedRoles, ...villagers];
}
