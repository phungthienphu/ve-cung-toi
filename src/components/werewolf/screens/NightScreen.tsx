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
      <header className="mb-5 rounded-2xl bg-[var(--ww-surface-strong)] p-4 text-center">
        <div className="text-3xl">🌙</div>
        <h2 className="mt-2 font-ww-display text-xl font-bold text-[var(--ww-text)]">{title}</h2>
        <p className="mt-1 text-xs text-[var(--ww-text-muted)]">{content.description}</p>
      </header>

      {isWitchDecision && (
        <WitchActions selected={selected} privateState={privateState} send={send} />
      )}

      <TargetGrid
        players={players}
        selfId={selfId}
        selected={selected}
        disabledIds={disabledIds}
        teammateIds={isWolf ? privateState.teammates : undefined}
        onPick={selectTarget}
      />

      <LockAction phase={phase} role={role} privateState={privateState} send={send} />

      {phase === "nightResolve" && (
        <SuspicionVote
          players={players}
          selfId={selfId}
          selected={privateState.suspicionTargetId}
          send={send}
        />
      )}

      {isWolf && phase !== "nightResolve" && (
        <WolfChoices players={players} wolfChoices={privateState.wolfChoices} />
      )}
    </div>
  );
}

function SuspicionVote({ players, selfId, selected, send }: Pick<NightScreenProps, "players" | "selfId" | "send"> & { selected: string | null }) {
  return (
    <label className="mt-5 block rounded-2xl border border-[var(--ww-warn)]/25 bg-[var(--ww-warn-soft)] p-4">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ww-warn)]">Note nghi ngờ cá nhân</span>
      <span className="mt-1 block text-sm text-[var(--ww-text-muted)]">Theo bạn, ai có khả năng là Sói nhất đêm nay?</span>
      <select
        value={selected ?? ""}
        onChange={(event) => event.target.value && send({ type: "set_suspicion", targetId: event.target.value })}
        className="mt-3 w-full rounded-xl border border-[var(--ww-border)] bg-[var(--ww-surface-strong)] px-3 py-2.5 text-sm text-[var(--ww-text)] outline-none focus:border-[var(--ww-warn)]"
      >
        <option value="">Chưa ghi nhận</option>
        {players.filter((player) => player.alive && player.id !== selfId).map((player) => (
          <option key={player.id} value={player.id}>{player.name}</option>
        ))}
      </select>
      <span className="mt-2 block text-[11px] text-[var(--ww-text-faint)]">Note được giữ riêng trong ván và chỉ cộng vào thống kê vui khi game kết thúc.</span>
    </label>
  );
}

function WitchActions({ selected, privateState, send }: Pick<NightScreenProps, "privateState" | "send"> & { selected: string | null }) {
  const content = GAME_CONTENT.night.witch;

  return (
    <div className="mb-5 grid gap-2 sm:grid-cols-3">
      <button
        disabled={!privateState.healAvailable || !privateState.witchVictimId}
        onClick={() => send({ type: "witch_decision", decision: "heal" })}
        className="rounded-xl bg-[var(--ww-safe)] p-3 font-semibold text-[var(--ww-accent-ink)] disabled:opacity-30"
      >
        🧪 {content.healButton}
      </button>
      <button
        disabled={!privateState.poisonAvailable || !selected}
        onClick={() => selected && send({ type: "witch_decision", decision: "poison", targetId: selected })}
        className="rounded-xl bg-[var(--ww-danger)] p-3 font-semibold text-[var(--ww-accent-ink)] disabled:opacity-30"
      >
        ☠️ {content.poisonButton}
      </button>
      <button
        onClick={() => send({ type: "witch_decision", decision: "skip" })}
        className="rounded-xl bg-[var(--ww-surface-soft)] p-3 font-semibold text-[var(--ww-text)]"
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
      className={`mt-4 w-full rounded-xl py-3 font-bold text-[var(--ww-accent-ink)] disabled:opacity-30 ${wolfCanLock ? "bg-[var(--ww-danger)]" : "bg-[var(--ww-accent-strong)]"}`}
    >
      {wolfCanLock ? GAME_CONTENT.night.wolfLockButton : GAME_CONTENT.night.lockButton}
    </button>
  );
}

function WolfChoices({ players, wolfChoices }: Pick<PrivateWerewolfState, "wolfChoices"> & { players: WerewolfPlayer[] }) {
  return (
    <div className="mt-5 rounded-2xl border border-[var(--ww-danger)]/25 bg-[var(--ww-danger-soft)] p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-[var(--ww-danger)]">
        {GAME_CONTENT.night.wolfChoicesTitle}
      </div>
      {wolfChoices.map((choice) => (
        <div key={choice.wolfId} className="mt-2 flex justify-between text-sm text-[var(--ww-text)]">
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
