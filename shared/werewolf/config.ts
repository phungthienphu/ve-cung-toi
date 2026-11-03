import type { WerewolfRole, WerewolfConfig } from "./models";

export const MIN_WEREWOLF_PLAYERS = 5;

export const MAX_WEREWOLF_PLAYERS = 12;

export const ROLE_LABELS: Record<WerewolfRole, string> = {
  villager: "Dân làng",
  wolf: "Ma sói",
  seer: "Tiên tri",
  guardian: "Bảo vệ",
  witch: "Phù thủy",
};

export const ROLE_EMOJI: Record<WerewolfRole, string> = {
  villager: "🧑‍🌾",
  wolf: "🐺",
  seer: "🔮",
  guardian: "🛡️",
  witch: "🧪",
};

export const DEFAULT_WEREWOLF_CONFIG: WerewolfConfig = {
  discussionSeconds: 120,
  votingSeconds: 30,
  revealRoleOnDeath: true,
  witchCanSelfSave: true,
  botCount: 0,
};

export const MAX_VOTE_REASON_LENGTH = 120;

export const RECONNECT_GRACE_MS = 30_000;

export const MID_GAME_JOIN_MESSAGE = "Ngôi làng này đang yên ổn, bạn đừng vào :)))";

export const ROLE_PRESETS: Record<number, WerewolfRole[]> = {
  5: ["wolf", "seer", "villager", "villager", "villager"],
  6: ["wolf", "seer", "guardian", "villager", "villager", "villager"],
  7: ["wolf", "wolf", "seer", "villager", "villager", "villager", "villager"],
  8: ["wolf", "wolf", "seer", "guardian", "villager", "villager", "villager", "villager"],
  9: ["wolf", "wolf", "seer", "guardian", "witch", "villager", "villager", "villager", "villager"],
  10: ["wolf", "wolf", "wolf", "seer", "guardian", "villager", "villager", "villager", "villager", "villager"],
};
