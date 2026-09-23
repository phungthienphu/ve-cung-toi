import type { SeerResult, WerewolfRole } from "../../shared/werewolfTypes";

export interface SecretPlayerState {
  role: WerewolfRole;
  previewTargetId: string | null;
  lockedTargetId: string | null;
  suspicionTargetId: string | null;
  voteTargetId: string | null;
  roleAcknowledged: boolean;
  healAvailable: boolean;
  poisonAvailable: boolean;
  witchDecision: "heal" | "poison" | "skip" | null;
  witchPoisonTargetId: string | null;
  lastGuardedPlayerId: string | null;
  seerHistory: SeerResult[];
}

export const PHASE_DURATION_MS = {
  roleReveal: 30_000,
  nightExplore: 20_000,
  wolfLock: 5_000,
  nightResolve: 15_000,
  dawn: 8_000,
  voteResult: 8_000,
} as const;

export function createSecretPlayerState(role: WerewolfRole): SecretPlayerState {
  return {
    role,
    previewTargetId: null,
    lockedTargetId: null,
    suspicionTargetId: null,
    voteTargetId: null,
    roleAcknowledged: false,
    healAvailable: true,
    poisonAvailable: true,
    witchDecision: null,
    witchPoisonTargetId: null,
    lastGuardedPlayerId: null,
    seerHistory: [],
  };
}

export function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

