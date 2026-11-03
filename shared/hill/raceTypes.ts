import type { HillInput, HillMapId, HillSnapshot, HillVehicleId } from './types';
export interface HillRaceConfig { map: HillMapId | 'random'; length: 600 | 1200 | 2000; mode: 'race' | 'distance'; collisions: boolean; rounds: 1 | 3 | 5; vehicle: HillVehicleId | 'choice' }
export const DEFAULT_HILL_RACE: HillRaceConfig = { map: 'tea', length: 1200, mode: 'race', collisions: true, rounds: 3, vehicle: 'choice' };
export interface HillRacer { id: string; name: string; vehicle: HillVehicleId; ready: boolean; connected: boolean; points: number }
export interface HillRaceCar { id: string; state: HillSnapshot; ghost: boolean; respawning: boolean; squash: boolean; stuck: boolean; done: boolean; finishTick: number | null; stomps: number; squashed: number; crashes: number; air: number; ack: number }
export interface HillRaceFrame { tick: number; seed: number; cars: HillRaceCar[]; remaining: number | null }
export interface HillRaceState { host: string; players: HillRacer[]; config: HillRaceConfig; phase: 'lobby' | 'race' | 'results'; round: number; frame: HillRaceFrame | null; order: string[]; seriesOver: boolean }
export type HillRaceMessage = { type: 'join'; name: string } | { type: 'ready'; vehicle: HillVehicleId; ready: boolean } | { type: 'config'; config: HillRaceConfig } | { type: 'start' | 'next' | 'lobby' | 'respawn' } | { type: 'input'; input: HillInput; seq: number };
