// Shared types between the Next.js app and the PartyKit room server.
// Kept dependency-free so it can be imported from both `src/` and `party/`.

export type RoomStatus = "lobby" | "choosing" | "playing" | "roundEnd" | "gameEnd";

export interface Player {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  hasGuessedCorrectly: boolean;
  isHost: boolean;
}

export interface ChatEntry {
  id: string;
  type: "chat" | "system" | "correct" | "close";
  playerId?: string;
  name?: string;
  text?: string;
  ts: number;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface StrokeSegment {
  strokeId: string;
  color: string;
  size: number;
  tool: "pen" | "eraser";
  points: StrokePoint[];
}

export interface RoomConfig {
  rounds: number; // how many times EACH player draws
  drawSeconds: number;
  wordlistIds: string[]; // e.g. ["vi-default", "en-default"]
  customWords: string[]; // extra words typed by the host
  customOnly: boolean; // when true, ignore wordlistIds entirely — draw only from customWords
  minWords: number; // filter: minimum number of words in a chosen phrase
  maxWords: number; // filter: maximum number of words in a chosen phrase
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  rounds: 3,
  drawSeconds: 80,
  wordlistIds: ["vi-default"],
  customWords: [],
  customOnly: false,
  minWords: 1,
  maxWords: 3,
};

export const MIN_WORD_COUNT = 1;
export const MAX_WORD_COUNT = 5;

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS_TO_START = 2;
export const WORD_CHOICE_SECONDS = 12;
export const POST_ROUND_SECONDS = 6;

// Publicly broadcast room state. The secret `word` is replaced by
// `wordHint` (underscores) for everyone except the current drawer,
// who receives the real word via a private `your-word` message.
export interface PublicRoomState {
  roomId: string;
  status: RoomStatus;
  players: Player[];
  hostId: string | null;
  config: RoomConfig;
  drawerId: string | null;
  wordLength: number | null;
  wordHint: string | null;
  revealedWord: string | null; // set during roundEnd/gameEnd
  round: number; // 1-indexed "turn" number
  totalTurns: number;
  turnEndsAt: number | null; // epoch ms, for client-side countdown
  phaseEndsAt: number | null; // epoch ms for choosing/roundEnd/gameEnd countdown
  strokes: StrokeSegment[];
}

export type ClientMessage =
  | { type: "join"; playerId: string; name: string }
  | { type: "start_game"; config: RoomConfig }
  | { type: "choose_word"; word: string }
  | { type: "stroke"; segment: StrokeSegment }
  | { type: "stroke_point"; strokeId: string; point: StrokePoint }
  | { type: "stroke_end"; strokeId: string }
  | { type: "clear_canvas" }
  | { type: "chat"; text: string }
  | { type: "play_again" }
  | { type: "kick_player"; playerId: string }
  | { type: "leave_room" };

export type ServerMessage =
  | { type: "state"; state: PublicRoomState }
  | { type: "your_word"; word: string }
  | { type: "word_choices"; choices: string[]; deadline: number }
  | { type: "chat_message"; entry: ChatEntry }
  | { type: "stroke"; segment: StrokeSegment }
  | { type: "stroke_point"; strokeId: string; point: StrokePoint }
  | { type: "stroke_end"; strokeId: string }
  | { type: "clear_canvas" }
  | { type: "round_result"; word: string; scores: { playerId: string; delta: number }[] }
  | { type: "game_result"; players: Player[] }
  | { type: "kicked" }
  | { type: "error"; message: string };
