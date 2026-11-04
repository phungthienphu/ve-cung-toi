import type { HillVehicleId, HillVehicle, HillMapId } from "./models";

export const HILL_DT = 1 / 60;

export const HILL_JEEP = {
  wheelRadius: 0.55,
  wheelbase: 2.5,
  motorSpeed: 35,
  motorTorque: 12.5,
  springHz: 4,
  damping: 0.75,
  airTorque: 12,
  recoveryTorque: 28,
  idleFuelPerSecond: 1.3,
  gasFuelPerSecond: 1.2,
  /** Seconds to right a car that lands on its roof before it counts as "Chổng vó!" (all vehicles). */
  overturnSeconds: 10,
} as const;

export const HILL_VEHICLES: Record<HillVehicleId, HillVehicle> = {
  jeep: { ...HILL_JEEP, name: "Jeep", icon: "🚙", price: 0, description: "Cân bằng, dễ lái", halfWidth: 1.65, cabinWidth: 0.95, density: 1.5, fuelRate: 1 },
  // Balanced so each car leads at one thing (02/11/2026), then all made
  // stronger together (04/11/2026: ~+10% top speed, +25% torque) so the
  // order holds. Rough figures, from top speed = motorSpeed × wheelRadius,
  // pull ≈ 2·torque / radius / mass, and the steepest steady climb asin(pull / g):
  //   Jeep     19.3 m/s, ~6.6 m/s², 42° — no weak spot.
  //   Beetle   23.4 m/s, ~6.1 m/s², 38° — fastest and the least fuel per metre; flips easily.
  //   Monster  18.4 m/s, ~7.9 m/s², 54° — best climber, big wheels over rock steps; slower than the Jeep, thirsty.
  //   Bus      18.0 m/s, ~6.0 m/s², 38° — hardest to flip (long wheelbase), heaviest to push; small city-bus wheels.
  // The terrain never climbs steeper than MAX_CLIMB (terrain.ts), which all of them manage.
  beetle: { name: "Xe con bọ", icon: "🚗", price: 150, description: "Nhanh nhất, tiết kiệm xăng; leo yếu, dễ lật", halfWidth: 1.35, cabinWidth: 0.8, wheelRadius: 0.45, wheelbase: 2, density: 0.9, motorSpeed: 52, motorTorque: 5.2, springHz: 4.5, damping: 0.7, airTorque: 6, recoveryTorque: 16, fuelRate: 0.8 },
  monster: { name: "Tải quái vật", icon: "🛻", price: 450, description: "Leo dốc, vượt đá giỏi nhất; chậm, hao xăng", halfWidth: 1.9, cabinWidth: 1, wheelRadius: 0.8, wheelbase: 2.9, density: 2.7, motorSpeed: 23, motorTorque: 45, springHz: 3.5, damping: 0.8, airTorque: 24, recoveryTorque: 65, fuelRate: 1.3 },
  bus: { name: "Xe buýt", icon: "🚌", price: 300, description: "Khó lật nhất, ủi mạnh; tăng tốc chậm", halfWidth: 2.65, cabinWidth: 2.25, wheelRadius: 0.45, wheelbase: 4.1, density: 2, motorSpeed: 40, motorTorque: 17, springHz: 4, damping: 0.8, airTorque: 35, recoveryTorque: 90, fuelRate: 0.9 },
};

export const HILL_MAPS: Record<HillMapId, { name: string; icon: string; description: string; gravity: number; friction: number; fuelRate: number; amplitude: number; sky: [string, string]; hills: string[]; ground: string; edge: string }> = {
  tea: { name: "Đồi chè", icon: "🌾", description: "Đồi nhỏ, dốc nhảy và thung lũng", gravity: 9.8, friction: 1, fuelRate: 1, amplitude: 1, sky: ["#79c8e4", "#eaf6ca"], hills: ["#9cc9a0", "#77ad89", "#519574"], ground: "#9b6d43", edge: "#94bb52" },
  sand: { name: "Đồi cát Mũi Né", icon: "🏜️", description: "Bám đường kém, hao xăng hơn", gravity: 9.8, friction: 0.5, fuelRate: 1.2, amplitude: 1.3, sky: ["#f3ba83", "#fff2c6"], hills: ["#e9c290", "#dcb17a", "#c79960"], ground: "#ce9d5b", edge: "#ffe3a3" },
  mountain: { name: "Đèo Mã Pí Lèng", icon: "🏔️", description: "Dốc gắt và những bậc đá", gravity: 9.8, friction: 1.1, fuelRate: 1, amplitude: 2, sky: ["#8aa8ce", "#e2e7eb"], hills: ["#abb9c4", "#819ca5", "#5e7e86"], ground: "#68777d", edge: "#b4c5af" },
  moon: { name: "Mặt trăng", icon: "🌕", description: "Trọng lực thấp, bay xa", gravity: 1.6, friction: 0.8, fuelRate: 1, amplitude: 1.2, sky: ["#101d43", "#3a4674"], hills: ["#535c83", "#707796", "#85899f"], ground: "#797c92", edge: "#c5c9de" },
};

/**
 * "Lao tới": a burst along the way the car points (up a slope, down a slope),
 * but never steeper than maxPitch from level — or nose-up in the air it would
 * be a second jump. maxSpeed caps the speed along that direction.
 */
export const HILL_DASH = { energy: 25, cooldownTicks: 120, speedBoost: 8, maxSpeed: 30, maxPitch: 0.6 } as const;

export const HILL_BASE_SEED = 20261102;
