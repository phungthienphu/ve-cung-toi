import type { BattleshipMode, BattleshipTeam, ShipKind, BattleshipConfig } from "./models";

export const MAX_BATTLESHIP_PLAYERS = 8;

export const MAX_TEAM_SIZE = 4;

export const PLACEMENT_SECONDS = 60;

export const RECONNECT_GRACE_MS = 30_000;

export const REVEAL_MS = 1800;

export const MID_GAME_JOIN_MESSAGE = "Trận đang diễn ra, chờ ván sau nhé ⚓";

export const MODE_LABELS: Record<BattleshipMode, string> = {
  solo: "Solo 1 vs 1",
  ffa: "Hỗn chiến",
  team: "Đồng đội",
};

export const TEAM_LABELS: Record<BattleshipTeam, string> = { A: "Xanh", B: "Đỏ" };

export const SHIP_SIZE: Record<ShipKind, number> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};

export const SHIP_LABEL: Record<ShipKind, string> = {
  carrier: "Tàu sân bay",
  battleship: "Thiết giáp hạm",
  cruiser: "Tuần dương hạm",
  submarine: "Tàu ngầm",
  destroyer: "Khu trục hạm",
};

export const DEFAULT_BATTLESHIP_CONFIG: BattleshipConfig = {
  mode: "solo",
  turnSeconds: 15,
  noTouching: true,
  hitAgain: true,
  botCount: 0,
  botLevel: "normal",
};
