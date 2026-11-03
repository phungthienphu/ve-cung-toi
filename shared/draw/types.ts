/** Stable domain API: models, configuration and rules are kept in separate modules. */
export type { RoomStatus, Player, ChatEntry, StrokePoint, DrawTool, StrokeSegment, RoomConfig, PublicRoomState, ClientMessage, DrawRoomListing, ServerMessage } from "./models";
export { SHAPE_TOOLS, DEFAULT_ROOM_CONFIG, MIN_WORD_COUNT, MAX_WORD_COUNT, MAX_PLAYERS, MIN_PLAYERS_TO_START, WORD_CHOICE_SECONDS, POST_ROUND_SECONDS } from "./config";
