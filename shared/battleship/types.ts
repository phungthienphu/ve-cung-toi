/** Stable domain API: models, configuration and rules are kept in separate modules. */
export type { BattleshipMode, BattleshipTeam, BattleshipPhase, BotLevel, ShipKind, ShipPlacement, BattleshipConfig, BattleshipPlayer, PublicBoard, ShotEvent, BattleshipChatEntry, BattleshipStanding, PublicBattleshipState, PrivateBattleshipState, BattleshipRoomListing, BattleshipClientMessage, BattleshipServerMessage } from "./models";
export { MAX_BATTLESHIP_PLAYERS, MAX_TEAM_SIZE, PLACEMENT_SECONDS, RECONNECT_GRACE_MS, REVEAL_MS, MID_GAME_JOIN_MESSAGE, MODE_LABELS, TEAM_LABELS, SHIP_SIZE, SHIP_LABEL, DEFAULT_BATTLESHIP_CONFIG } from "./config";
export { boardSizeFor, fleetFor, cellIndex, cellXY, shipCells, isValidFleet, canPlace, randomFleet, pickBotCell } from "./rules";
