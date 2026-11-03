

export interface HillInput { gas: boolean; brake: boolean; jump?: boolean; dash?: boolean }

export interface HillPose { x: number; y: number; angle: number }

export interface HillPickup { id: string; x: number; y: number; kind: "coin" | "fuel" | "energy" }

export type HillEvent = "coin" | "fuel" | "overturned" | "recovered" | "finished" | "energy" | "jump" | "flip" | "backflip" | "airtime" | "landing" | "dash";

export interface HillSnapshot {
  tick: number;
  map: HillMapId;
  vehicle: HillVehicleId;
  energy: number;
  jumpReady: boolean;
  dashReady: boolean;
  dashCooldown: number;
  skillCoins: number;
  held?: { jump: boolean; dash: boolean };
  raceFuel?: boolean;
  motion: { vx: number; vy: number; omega: number }[];
  jumpCooldown: number;
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

export type HillVehicleId = "jeep" | "beetle" | "monster" | "bus";

export type HillMapId = "tea" | "sand" | "mountain" | "moon";

export interface HillVehicle {
  name: string; icon: string; price: number; description: string;
  halfWidth: number; cabinWidth: number; wheelRadius: number; wheelbase: number;
  density: number; motorSpeed: number; motorTorque: number; springHz: number; damping: number;
  airTorque: number; recoveryTorque: number; fuelRate: number;
}

export interface HillOptions { map?: HillMapId; vehicle?: HillVehicleId; raceFuel?: boolean }

export interface HillFlag { distance: number; name: string; kind: "personal" | "leader" | "nearby" }

export interface HillLeaderboardEntry { playerId: string; name: string; distance: number; rank: number }

export interface HillWallet { coins: number; unlocked: HillVehicleId[] }

export interface HillBoard { leaders: HillLeaderboardEntry[]; personal: HillLeaderboardEntry | null; nearby: HillLeaderboardEntry[] }

export interface HillRunSubmission {
  runId: string; playerId: string; name: string; map: HillMapId; vehicle: HillVehicleId;
  seed: number; day: string | null; distance: number; coins: number; duration: number;
}
