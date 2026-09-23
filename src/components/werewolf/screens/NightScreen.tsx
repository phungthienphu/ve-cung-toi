import type { PrivateWerewolfState, WerewolfClientMessage, WerewolfPhase, WerewolfPlayer, WerewolfRole } from "@shared/werewolfTypes";
import { GAME_CONTENT } from "../gameContent";
import { TargetGrid } from "../ui";

type NightPhase = Extract<WerewolfPhase, "nightExplore" | "wolfLock" | "nightResolve">;

interface NightScreenProps {
  phase: NightPhase;
  role: WerewolfRole;
  selfId: string;
  players: WerewolfPlayer[];
  privateState: PrivateWerewolfState;
  send: (message: WerewolfClientMessage) => void;
}

export function NightScreen({ phase, role, selfId, players, privateState, send }: NightScreenProps) {
  const isWolf = role === "wolf";
  const isWitchDecision = role === "witch" && phase === "nightResolve";
  const content = GAME_CONTENT.night.roles[role][phase];
  const selected = phase === "nightResolve" && isWolf
    ? privateState.suspicionTargetId
    : privateState.lockedTargetId ?? privateState.previewTargetId;
  const disabledIds = getDisabledTargets(role, privateState);
  const title = isWitchDecision ? witchTitle(privateState.witchVictimId, players) : content.title;

  const selectTarget = (targetId: string) => {
    if (phase === "nightResolve" && isWolf) {
      send({ type: "set_suspicion", targetId });
      return;
    }
    send({ type: "preview_target", targetId });
  };

  return (
    <div>
      <header className="mb-5 rounded-xl bg-indigo-950/70 p-4 text-center">
        <div className="text-3xl">🌙</div>
        <h2 className="mt-2 text-xl font-bold">{title}</h2>
        <p className="mt-1 text-xs text-slate-400">{content.description}</p>
      </header>

      {isWitchDecision && (
        <WitchActions selected={selected} privateState={privateState} send={send} />
      )}

      <TargetGrid
        players={players}
        selfId={selfId}
        selected={selected}
        disabledIds={disabledIds}
        onPick={selectTarget}
      />

      <LockAction phase={phase} role={role} privateState={privateState} send={send} />

      {isWolf && phase !== "nightResolve" && (
        <WolfChoices players={players} wolfChoices={privateState.wolfChoices} />
      )}
    </div>
  );
}

function WitchActions({ selected, privateState, send }: Pick<NightScreenProps, "privateState" | "send"> & { selected: string | null }) {
  const content = GAME_CONTENT.night.witch;

  return (
    <div className="mb-5 grid gap-2 sm:grid-cols-3">
      <button
        disabled={!privateState.healAvailable || !privateState.witchVictimId}
        onClick={() => send({ type: "witch_decision", decision: "heal" })}
        className="rounded-xl bg-emerald-600 p-3 font-semibold disabled:opacity-30"
      >
        🧪 {content.healButton}
      </button>
      <button
        disabled={!privateState.poisonAvailable || !selected}
        onClick={() => selected && send({ type: "witch_decision", decision: "poison", targetId: selected })}
        className="rounded-xl bg-rose-700 p-3 font-semibold disabled:opacity-30"
      >
        ☠️ {content.poisonButton}
      </button>
      <button
        onClick={() => send({ type: "witch_decision", decision: "skip" })}
        className="rounded-xl bg-white/10 p-3 font-semibold"
      >
        {content.skipButton}
      </button>
    </div>
  );
}

function LockAction({ phase, role, privateState, send }: Pick<NightScreenProps, "phase" | "role" | "privateState" | "send">) {
  const targetId = privateState.previewTargetId;
  const wolfCanLock = role === "wolf" && phase === "wolfLock";
  const specialCanLock = (role === "seer" || role === "guardian") && phase !== "nightExplore";
  if (!wolfCanLock && !specialCanLock) return null;

  return (
    <button
      disabled={!targetId}
      onClick={() => targetId && send({ type: "lock_target", targetId })}
      className={`mt-4 w-full rounded-xl py-3 font-bold disabled:opacity-30 ${wolfCanLock ? "bg-rose-600" : "bg-violet-500"}`}
    >
      {wolfCanLock ? GAME_CONTENT.night.wolfLockButton : GAME_CONTENT.night.lockButton}
    </button>
  );
}

function WolfChoices({ players, wolfChoices }: Pick<PrivateWerewolfState, "wolfChoices"> & { players: WerewolfPlayer[] }) {
  return (
    <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-950/30 p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-rose-300">
        {GAME_CONTENT.night.wolfChoicesTitle}
      </div>
      {wolfChoices.map((choice) => (
        <div key={choice.wolfId} className="mt-2 flex justify-between text-sm">
          <span>{playerName(choice.wolfId, players)}</span>
          <span>
            {choice.targetId ? playerName(choice.targetId, players) : GAME_CONTENT.night.wolfThinking}
            {choice.locked ? " 🔒" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function getDisabledTargets(role: WerewolfRole, privateState: PrivateWerewolfState): string[] {
  if (role === "wolf") return privateState.teammates;
  if (role === "guardian" && privateState.lastGuardedPlayerId) return [privateState.lastGuardedPlayerId];
  return [];
}

function witchTitle(victimId: string | null, players: WerewolfPlayer[]): string {
  if (!victimId) return GAME_CONTENT.night.witch.noVictim;
  return GAME_CONTENT.night.witch.victim(playerName(victimId, players));
}

function playerName(playerId: string, players: WerewolfPlayer[]): string {
  return players.find((player) => player.id === playerId)?.name ?? "Một người chơi";
}
