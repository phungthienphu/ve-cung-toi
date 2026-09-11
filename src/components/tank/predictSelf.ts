"use client";

// Local, client-only prediction of the LOCAL player's own tank — see the
// long conversation that led here: the server is still the sole authority
// (this never overrides what it says), this only makes the local tank
// *feel* instantly responsive to input instead of waiting a full
// round-trip + tick to visibly move. Every other tank/monster on screen
// still uses pure server interpolation (see TankCanvas.tsx's renderPos) —
// only self gets this treatment, since predicting anyone else would need
// their live input, which this client never has.
//
// stepSelfMovement (shared/tankMovement.ts) is the exact same function the
// server calls for real — see its doc for why that matters. It only covers
// the self-contained cases (plain movement, boost, ice, a dash's forced
// slide); this predictor is simply not consulted at all while hooked (see
// TankCanvas.tsx), since the eased pull needs hookPullFrom/To — fields the
// client never receives (PublicTankPlayer strips them) — falling back to
// ordinary server interpolation for that short window instead.

import { TANK_SIZE, TICK_MS } from "@shared/tankTypes";
import { stepSelfMovement, type SelfMovementFlags, type SelfMovementInput, type SelfMovementState, type TryEntityMove } from "@shared/tankMovement";
import type { TankMapDef } from "@shared/tankTypes";

// The client never predicts being shoved by another tank/crate (it only has
// a stale view of their positions) — always succeed past the wall check, so
// prediction is limited to exactly what's self-contained. See
// TryEntityMove's doc.
const alwaysFree: TryEntityMove = () => true;

// Below this gap, treat it as ordinary drift (floating-point rounding, a
// slightly different regen rounding) and close it smoothly instead of
// snapping — a snap this small would be more visible than the drift itself.
const RECONCILE_SNAP_DIST = TANK_SIZE * 1.5;
// Fraction of the remaining gap closed on every reconcile — not all of it at
// once, so a string of small corrections still reads as smooth motion
// rather than a jitter of tiny snaps.
const SOFT_CORRECT_RATE = 0.35;

export interface SelfPredictor {
  /** Call once per fresh server confirmation of this player (every "state"
   * and "state_delta" that includes them) — pulls the prediction back
   * toward whatever the server actually said. */
  reconcile(server: Omit<SelfMovementState, "velocityX" | "velocityY">): void;
  /** Call every animation frame with the real elapsed ms since the last
   * call. Advances the simulation by however many whole ticks that covers
   * (so stepSelfMovement's per-tick constants stay valid) and returns a
   * smoothly interpolated position for whatever's left over — same idea as
   * TankCanvas's own tick-to-tick interpolation, just run locally instead
   * of against two server snapshots. */
  advance(map: TankMapDef, input: SelfMovementInput | undefined, flags: SelfMovementFlags, elapsedMs: number): { x: number; y: number };
}

export function createSelfPredictor(initial: SelfMovementState): SelfPredictor {
  let prev: SelfMovementState = { ...initial };
  let curr: SelfMovementState = { ...initial };
  let accumulatorMs = 0;

  return {
    reconcile(server) {
      const dist = Math.hypot(server.x - curr.x, server.y - curr.y);
      if (dist > RECONCILE_SNAP_DIST) {
        // A mismatch prediction couldn't have known about on its own — shoved
        // by another tank, just got stunned, respawned, ... — trust the
        // server outright rather than fighting to close a gap that large.
        curr = { ...curr, ...server };
      } else {
        curr = {
          ...curr,
          ...server,
          x: curr.x + (server.x - curr.x) * SOFT_CORRECT_RATE,
          y: curr.y + (server.y - curr.y) * SOFT_CORRECT_RATE,
        };
      }
      prev = { ...curr };
      accumulatorMs = 0;
    },
    advance(map, input, flags, elapsedMs) {
      accumulatorMs = Math.min(accumulatorMs + elapsedMs, TICK_MS * 4); // cap: a dropped/backgrounded tab shouldn't fast-forward through dozens of ticks on return
      while (accumulatorMs >= TICK_MS) {
        accumulatorMs -= TICK_MS;
        prev = curr;
        curr = stepSelfMovement(curr, input, flags, map, alwaysFree);
      }
      const t = Math.min(1, accumulatorMs / TICK_MS);
      return { x: prev.x + (curr.x - prev.x) * t, y: prev.y + (curr.y - prev.y) * t };
    },
  };
}
