// Server-only types that don't belong in shared/tankTypes.ts (which is also
// imported by the client) — this file is party-side only.

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
}
