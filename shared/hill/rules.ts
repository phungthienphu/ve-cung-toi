import type { HillMapId, HillVehicleId } from "./models";
import { HILL_MAPS, HILL_VEHICLES } from "./config";

export function hillDay(at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

export function hillDailySeed(day: string): number { return Number(day.replaceAll("-", "")); }

export function isHillMap(value: unknown): value is HillMapId { return typeof value === "string" && Object.hasOwn(HILL_MAPS, value); }

export function isHillVehicle(value: unknown): value is HillVehicleId { return typeof value === "string" && Object.hasOwn(HILL_VEHICLES, value); }
