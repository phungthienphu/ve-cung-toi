'use client';
import { TANK_SIZE, TICK_MS, type TankMapDef } from '@shared/tank/types';
import { stepSelfMovement, type SelfMovementFlags, type SelfMovementInput, type SelfMovementState } from '@shared/tank/movement';

type Command = { seq: number; input: SelfMovementInput; flags: SelfMovementFlags };
export interface SelfPredictor {
  reconcile(server: SelfMovementState, ack: number): void;
  advance(map: TankMapDef, input: SelfMovementInput, flags: SelfMovementFlags, elapsedMs: number, sample: () => number): { x: number; y: number };
}
const free = () => true;
/** Restore authoritative movement and replay only commands the server has not consumed.
 * The render clock survives every snapshot; corrections decay in frame time. */
export function createSelfPredictor(initial: SelfMovementState): SelfPredictor {
  let curr = { ...initial }, prev = { ...initial }, accumulator = 0;
  let map: TankMapDef | null = null;
  let pending: Command[] = [];
  let offsetX = 0, offsetY = 0;
  let visible = { x: initial.x, y: initial.y };
  return {
    reconcile(server, ack) {
      pending = pending.filter(command => command.seq > ack);
      curr = { ...server }; prev = curr;
      if (map) for (const command of pending) {
        prev = curr; curr = stepSelfMovement(curr, command.input, command.flags, map, free);
      }
      const t = accumulator / TICK_MS;
      offsetX = visible.x - (prev.x + (curr.x - prev.x) * t);
      offsetY = visible.y - (prev.y + (curr.y - prev.y) * t);
      if (Math.hypot(offsetX, offsetY) > TANK_SIZE * 3) offsetX = offsetY = 0;
    },
    advance(nextMap, input, flags, elapsedMs, sample) {
      map = nextMap;
      accumulator = Math.min(accumulator + elapsedMs, TICK_MS * 4);
      while (accumulator >= TICK_MS) {
        accumulator -= TICK_MS;
        const seq = sample();
        pending.push({ seq, input: { ...input }, flags: { ...flags } });
        if (pending.length > 90) pending.shift();
        prev = curr; curr = stepSelfMovement(curr, input, flags, map, free);
      }
      const decay = Math.exp(-Math.min(elapsedMs, 100) / 60);
      offsetX *= decay; offsetY *= decay;
      const t = accumulator / TICK_MS;
      visible = { x: prev.x + (curr.x - prev.x) * t + offsetX, y: prev.y + (curr.y - prev.y) * t + offsetY };
      return visible;
    },
  };
}
