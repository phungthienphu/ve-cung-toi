// Rule-based Werewolf bots. A bot is an ordinary player (isBot) with a secret
// role; this module only decides *what it does and when* — the room owns the
// actual game rules, so bots go through exactly the same handlers a human's
// messages would (preview/lock/vote/…), never a shortcut around them.

import type { NightSuspicionResult, WerewolfChatEntry, WerewolfConfig, WerewolfPhase, WerewolfPlayer } from "../../shared/werewolfTypes";
import type { SecretPlayerState } from "./domain";

export const BOT_NAMES = ["Bắp", "Cà Rốt", "Bánh Bao", "Khoai", "Mít", "Xoài", "Ổi", "Sầu Riêng", "Dưa Hấu", "Tắc Kè"];

export interface BotActions {
  preview(botId: string, targetId: string): void;
  lock(botId: string, targetId: string): void;
  suspect(botId: string, targetId: string): void;
  witch(botId: string, decision: "heal" | "poison" | "skip", targetId?: string): void;
  vote(botId: string, targetId: string | null, reason: string): void;
  ackResult(botId: string): void;
  say(botId: string, text: string): void;
  /** Runs `fn` after `delayMs`, cancelled automatically when the phase changes. */
  later(delayMs: number, fn: () => void): void;
}

export interface BotHost {
  day: number;
  config: WerewolfConfig;
  players: Map<string, WerewolfPlayer>;
  secrets: Map<string, SecretPlayerState>;
  chat: WerewolfChatEntry[];
  wolfVictimId: string | null;
  nightDeaths: string[];
  lastNightSuspicion: NightSuspicionResult | null;
  /** Bots that already announced a Seer result this game. */
  botClaimed: Set<string>;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const shortName = (player: WerewolfPlayer) => player.name.replace(/^🤖\s*/, "");
const oneOf = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

function livingOthers(host: BotHost, selfId: string): WerewolfPlayer[] {
  return [...host.players.values()].filter((player) => player.alive && player.id !== selfId);
}

function weightedPick(candidates: Array<{ player: WerewolfPlayer; weight: number }>): WerewolfPlayer | null {
  const pool = candidates.filter((candidate) => candidate.weight > 0);
  const total = pool.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const candidate of pool) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate.player;
  }
  return pool[pool.length - 1].player;
}

/** How much the table is talking about someone recently: name mentions in the
 * latest chat lines, with a Seer's "X là Sói" claim counting for much more. */
function chatHeat(host: BotHost, player: WerewolfPlayer): number {
  const name = shortName(player).toLowerCase();
  let heat = 0;
  for (const entry of host.chat.slice(-40)) {
    if (entry.system || entry.playerId === player.id) continue;
    const text = entry.text.toLowerCase();
    if (!text.includes(name)) continue;
    heat += text.includes("là sói") ? 4 : 1;
  }
  return heat;
}

function nightSuspicionPercent(host: BotHost, player: WerewolfPlayer): number {
  return host.lastNightSuspicion?.results.find((result) => result.playerId === player.id)?.percentage ?? 0;
}

/** Who this bot would point at right now, given what its role lets it know. */
function suspect(host: BotHost, botId: string): WerewolfPlayer | null {
  const secret = host.secrets.get(botId);
  if (!secret) return null;
  const known = new Map(secret.seerHistory.map((entry) => [entry.targetId, entry.isWolf]));
  return weightedPick(
    livingOthers(host, botId).map((player) => {
      let weight = 1 + chatHeat(host, player) * 1.5 + nightSuspicionPercent(host, player) / 25;
      const isWolfTarget = host.secrets.get(player.id)?.role === "wolf";
      if (secret.role === "wolf" && isWolfTarget) weight = 0; // never turn on the pack
      if (secret.role === "wolf" && !isWolfTarget) weight *= 1.2;
      if (secret.role === "seer" && known.get(player.id) === true) weight = 100;
      if (secret.role === "seer" && known.get(player.id) === false) weight *= 0.15;
      return { player, weight };
    })
  );
}

function pickVillager(host: BotHost, botId: string): WerewolfPlayer | null {
  const targets = livingOthers(host, botId).filter((player) => host.secrets.get(player.id)?.role !== "wolf");
  return targets.length ? oneOf(targets) : null;
}

const ACCUSE = [
  "Mình thấy {X} hơi khả nghi đó.",
  "{X} nãy giờ nói ít quá, mình nghi.",
  "Ai để ý {X} giúp mình với, có gì đó không ổn.",
  "Mình sẽ để mắt tới {X}.",
  "Theo mình thì {X} đang giấu gì đó.",
];
const NEUTRAL = [
  "Mọi người thử nói xem mình nghi ai nhất?",
  "Mình chỉ là dân thường thôi, đừng nghi mình nhé.",
  "Bình tĩnh nào, đừng vội bỏ phiếu bừa.",
  "Ai thấy điều gì lạ đêm qua không?",
];
const DEFEND = [
  "Sao lại nghi mình? Mình không phải sói đâu!",
  "Mình thật sự là người tốt, đừng bầu mình nhé.",
  "Nghi mình thì có gì làm bằng chứng không?",
  "{X} mới đáng ngờ chứ, sao lại chọn mình?",
];

function speak(host: BotHost, actions: BotActions, botId: string) {
  const bot = host.players.get(botId);
  const secret = host.secrets.get(botId);
  if (!bot?.alive || !secret) return;

  // A Seer who found a wolf says so — once, and only while that wolf lives.
  if (secret.role === "seer" && !host.botClaimed.has(botId)) {
    const found = secret.seerHistory.find((entry) => entry.isWolf && host.players.get(entry.targetId)?.alive);
    if (found) {
      host.botClaimed.add(botId);
      const target = host.players.get(found.targetId);
      if (target) return actions.say(botId, `Mình là Tiên tri! Đêm ${found.night} mình soi ${shortName(target)} và đó là Sói!`);
    }
  }

  const roll = Math.random();
  if (roll < 0.15 && host.nightDeaths.length > 0) {
    const victim = host.players.get(host.nightDeaths[0]);
    if (victim) return actions.say(botId, `${shortName(victim)} chết rồi... ai đã hại ${shortName(victim)} nhỉ?`);
  }
  if (roll < 0.75) {
    const target = suspect(host, botId);
    if (target) return actions.say(botId, oneOf(ACCUSE).replace("{X}", shortName(target)));
  }
  actions.say(botId, oneOf(NEUTRAL));
}

/** Called when a human posts in discussion: any bot that was named answers back. */
export function botsReactToChat(host: BotHost, actions: BotActions, entry: WerewolfChatEntry) {
  if (entry.system) return;
  const text = entry.text.toLowerCase();
  for (const bot of host.players.values()) {
    if (!bot.isBot || !bot.alive || bot.id === entry.playerId) continue;
    if (!text.includes(shortName(bot).toLowerCase()) || Math.random() > 0.8) continue;
    const accuser = host.players.get(entry.playerId);
    actions.later(rand(1500, 4000), () => {
      actions.say(bot.id, oneOf(DEFEND).replace("{X}", accuser ? shortName(accuser) : "người khác"));
    });
  }
}

/** Schedules everything the bots do in `phase`. */
export function scheduleBotPhase(host: BotHost, actions: BotActions, phase: WerewolfPhase, durationMs: number) {
  const bots = [...host.players.values()].filter((player) => player.isBot && player.alive);
  if (bots.length === 0) return;

  switch (phase) {
    case "nightExplore": {
      // The pack agrees on one victim so bot wolves don't split their vote.
      const victim = bots.find((bot) => host.secrets.get(bot.id)?.role === "wolf") ? pickVillager(host, bots.find((bot) => host.secrets.get(bot.id)?.role === "wolf")!.id) : null;
      for (const bot of bots) {
        const secret = host.secrets.get(bot.id);
        if (!secret) continue;
        actions.later(rand(1500, 8000), () => {
          if (secret.role === "wolf") {
            if (victim?.alive) actions.preview(bot.id, victim.id);
          } else if (secret.role === "seer") {
            const checked = new Set(secret.seerHistory.map((entry) => entry.targetId));
            const fresh = livingOthers(host, bot.id).filter((player) => !checked.has(player.id));
            const target = fresh.length ? oneOf(fresh) : suspect(host, bot.id);
            if (target) actions.preview(bot.id, target.id);
          } else if (secret.role === "guardian") {
            const options = livingOthers(host, bot.id).filter((player) => player.id !== secret.lastGuardedPlayerId);
            if (options.length) actions.preview(bot.id, oneOf(options).id);
          } else {
            const target = suspect(host, bot.id);
            if (target) actions.preview(bot.id, target.id); // villager/witch: doubles as their suspicion note
          }
        });
      }
      return;
    }
    case "wolfLock": {
      for (const bot of bots) {
        const secret = host.secrets.get(bot.id);
        if (!secret || !["wolf", "seer", "guardian"].includes(secret.role)) continue;
        actions.later(rand(300, 2500), () => {
          const target = secret.previewTargetId;
          if (target) actions.lock(bot.id, target);
        });
      }
      return;
    }
    case "nightResolve": {
      for (const bot of bots) {
        const secret = host.secrets.get(bot.id);
        if (!secret) continue;
        if (secret.role === "witch") {
          actions.later(rand(3000, 9000), () => {
            const victim = host.wolfVictimId;
            const canSelfSave = host.config.witchCanSelfSave || victim !== bot.id;
            if (secret.healAvailable && victim && canSelfSave && (host.day <= 1 || Math.random() < 0.7)) {
              return actions.witch(bot.id, "heal");
            }
            if (secret.poisonAvailable && host.day >= 3 && Math.random() < 0.3) {
              const target = suspect(host, bot.id);
              if (target) return actions.witch(bot.id, "poison", target.id);
            }
            actions.witch(bot.id, "skip");
          });
        }
        // Everyone's private suspicion note (feeds the "dư luận" stats).
        actions.later(rand(1000, 6000), () => {
          const target = suspect(host, bot.id);
          if (target) actions.suspect(bot.id, target.id);
        });
      }
      return;
    }
    case "discussion": {
      for (const bot of bots) {
        const speeches = 2 + (Math.random() < 0.5 ? 1 : 0);
        const latest = Math.max(9000, Math.min(durationMs * 0.75, durationMs - 8000));
        const times = Array.from({ length: speeches }, () => rand(4000, latest)).sort((a, b) => a - b);
        for (const at of times) actions.later(at, () => speak(host, actions, bot.id));
      }
      return;
    }
    case "voting": {
      const latest = Math.max(6000, durationMs * 0.6);
      for (const bot of bots) {
        actions.later(rand(4000, latest), () => {
          const target = suspect(host, bot.id);
          if (!target) return actions.vote(bot.id, null, "");
          const reason = Math.random() < 0.7 ? `Mình thấy ${shortName(target)} khả nghi.` : "";
          actions.vote(bot.id, target.id, reason);
        });
      }
      return;
    }
    case "voteResult": {
      for (const bot of bots) actions.later(rand(2000, 6000), () => actions.ackResult(bot.id));
      return;
    }
    default:
      return;
  }
}
