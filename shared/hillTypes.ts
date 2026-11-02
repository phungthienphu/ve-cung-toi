/** Metres, kilograms, seconds. No browser or server dependencies. */
export const HILL_DT = 1 / 60;
export const HILL_JEEP = {
  wheelRadius: 0.55,
  wheelbase: 2.5,
  motorSpeed: 32,
  motorTorque: 10,
  springHz: 4,
  damping: 0.75,
  airTorque: 12,
  recoveryTorque: 28,
  idleFuelPerSecond: 1.3,
  gasFuelPerSecond: 1.2,
  overturnSeconds: 3,
} as const;
export interface HillInput { gas: boolean; brake: boolean }
export interface HillPose { x: number; y: number; angle: number }
export interface HillPickup { id: string; x: number; y: number; kind: "coin" | "fuel" }
export type HillEvent = "coin" | "fuel" | "overturned" | "recovered" | "finished";
export interface HillSnapshot {
  tick: number;
  chassis: HillPose;
  wheels: HillPose[];
  speed: number;
  distance: number;
  fuel: number;
  coins: number;
  grounded: boolean;
  overturnRemaining: number | null;
  finished: "overturned" | "fuel" | null;
  pickups: HillPickup[];
}
