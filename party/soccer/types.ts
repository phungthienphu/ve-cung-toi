// The server's per-player held-input snapshot — kept separate from
// SoccerPlayer itself since it's transient (overwritten on every "input"
// message) rather than state that goes out over the wire.
export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  aimAngle: number | null;
}
