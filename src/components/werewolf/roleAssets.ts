import type { WerewolfRole } from "@shared/werewolfTypes";

/** Runtime uses optimized WebP. PNG files in /public/ma-soi remain source assets. */
export const ROLE_ARTWORK: Record<WerewolfRole, string> = {
  villager: "/ma-soi/dan-lang.webp",
  wolf: "/ma-soi/ma-soi.webp",
  seer: "/ma-soi/tien-tri.webp",
  guardian: "/ma-soi/ve-si.webp",
  witch: "/ma-soi/phu-thuy.webp",
};

export const WEREWOLF_BACKGROUND = "/ma-soi/bg-ma-soi.webp";

