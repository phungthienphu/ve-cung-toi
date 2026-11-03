/** Stable domain API: models, configuration and rules are kept in separate modules. */
export type { HillInput, HillPose, HillPickup, HillEvent, HillSnapshot, HillVehicleId, HillMapId, HillVehicle, HillOptions, HillFlag, HillLeaderboardEntry, HillWallet, HillBoard, HillRunSubmission } from "./models";
export { HILL_DT, HILL_JEEP, HILL_VEHICLES, HILL_MAPS, HILL_DASH, HILL_BASE_SEED } from "./config";
export { hillDay, hillDailySeed, isHillMap, isHillVehicle } from "./rules";
