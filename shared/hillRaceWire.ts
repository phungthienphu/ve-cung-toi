import type { HillRaceFrame } from './hillRaceTypes';
import type { HillPose, HillSnapshot } from './hillTypes';
import { hillPickups } from './hillTerrain';
type Triplet = [number, number, number];
type PackedState = Omit<HillSnapshot, 'chassis' | 'wheels' | 'motion' | 'pickups'> & { chassis: Triplet; wheels: Triplet[]; motion: Triplet[]; pickups: string[] };
export type HillWireFrame = Omit<HillRaceFrame, 'cars'> & { cars: (Omit<HillRaceFrame['cars'][number], 'state'> & { state: PackedState })[] };
const round = (n: number) => Math.round(n * 1000) / 1000;
const pose = (p: HillPose): Triplet => [round(p.x), round(p.y), round(p.angle)];
export function packHillFrame(frame: HillRaceFrame): HillWireFrame {
  return { ...frame, cars: frame.cars.map(c => ({ ...c, state: { ...c.state, chassis: pose(c.state.chassis), wheels: c.state.wheels.map(pose), motion: c.state.motion.map(v => [round(v.vx), round(v.vy), round(v.omega)]), pickups: c.state.pickups.map(p => p.id) } })) };
}
export function unpackHillFrame(frame: HillWireFrame): HillRaceFrame {
  const position = ([x, y, angle]: Triplet) => ({ x, y, angle });
  return { ...frame, cars: frame.cars.map(c => {
    const available = new Set(c.state.pickups), chassis = position(c.state.chassis);
    return { ...c, state: { ...c.state, chassis, wheels: c.state.wheels.map(position), motion: c.state.motion.map(([vx, vy, omega]) => ({ vx, vy, omega })), pickups: hillPickups(frame.seed, chassis.x - 31, chassis.x + 86, c.state.map, c.state.raceFuel).filter(p => available.has(p.id)) } };
  }) };
}
