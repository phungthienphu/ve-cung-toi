import type { DrawTool, RoomConfig } from "./models";

export const SHAPE_TOOLS: DrawTool[] = ["rect", "circle", "triangle", "star"];

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

export const MAX_PLAYERS = 20;

export const MIN_PLAYERS_TO_START = 2;

export const WORD_CHOICE_SECONDS = 12;

export const POST_ROUND_SECONDS = 6;
