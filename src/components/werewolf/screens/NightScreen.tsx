import { useState, type CSSProperties, type ReactNode } from "react";
import { ROLE_LABELS, type PrivateWerewolfState, type PublicWerewolfState, type WerewolfClientMessage, type WerewolfPhase, type WerewolfPlayer, type WerewolfRole } from "@shared/werewolfTypes";
import { GAME_CONTENT } from "../gameContent";
import { PlayerAvatar, RoleArtwork } from "../ui";

type NightPhase = Extract<WerewolfPhase, "nightExplore" | "wolfLock" | "nightResolve">;
const NIGHT_STEPS: NightPhase[] = ["nightExplore", "wolfLock", "nightResolve"];

/** What tapping a player card does right now (mirrors the server's previewTarget rules). */
type PickMode = keyof typeof GAME_CONTENT.night.gridLabel;

interface NightScreenProps {
  state: PublicWerewolfState;
  phase: NightPhase;
  role: WerewolfRole;
  selfId: string;
  privateState: PrivateWerewolfState;
  send: (message: WerewolfClientMessage) => void;
}

type Send = NightScreenProps["send"];

export function NightScreen({ state, phase, role, selfId, privateState, send }: NightScreenProps) {
  const self = state.players.find((player) => player.id === selfId);
  if (!self?.alive) return <GhostNight state={state} phase={phase} />;

  const content = GAME_CONTENT.night.roles[role][phase];
  const mode = pickModeFor(role, phase, privateState);
  const isWitchDecision = role === "witch" && phase === "nightResolve";
  const title = isWitchDecision ? witchTitle(privateState.witchVictimId, state.players) : content.title;

  // Wolves' night-3 taps are a suspicion note, not a hunt (see previewTarget).
  const pick = (targetId: string) => send(
    role === "wolf" && phase === "nightResolve"
      ? { type: "set_suspicion", targetId }
      : { type: "preview_target", targetId },
  );

  return (
    <div className="ww-night flex flex-col" data-role={role}>
      <NightHero
        role={role}
        day={state.day}
        phase={phase}
        title={title}
        description={content.description}
        startedAt={state.phaseStartedAt}
        endsAt={state.phaseEndsAt}
      />

      {isWitchDecision && (
        <WitchPanel players={state.players} selfId={selfId} privateState={privateState} canSelfSave={state.config.witchCanSelfSave} send={send} />
      )}

      {role === "wolf" && mode === "hunt" && privateState.wolfChoices.length > 1 && (
        <PackStrip players={state.players} selfId={selfId} privateState={privateState} />
      )}

      <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--ww-text-faint)]">
        {GAME_CONTENT.night.gridLabel[mode]}
      </p>
      <NightTargetGrid
        players={state.players}
        selfId={selfId}
        role={role}
        phase={phase}
        mode={mode}
        privateState={privateState}
        onPick={pick}
      />

      {(role === "seer" || role === "guardian") && phase === "nightResolve" && (
        <SuspicionChips players={state.players} selfId={selfId} selected={privateState.suspicionTargetId} send={send} />
      )}

      <ActionBar
        players={state.players}
        role={role}
        phase={phase}
        mode={mode}
        privateState={privateState}
        send={send}
      />
    </div>
  );
}

function pickModeFor(role: WerewolfRole, phase: NightPhase, privateState: PrivateWerewolfState): PickMode {
  if (role === "wolf") return phase === "nightResolve" ? "suspect" : "hunt";
  if (role === "seer") return "see";
  if (role === "guardian") return "guard";
  if (role === "witch" && phase === "nightResolve" && privateState.poisonAvailable) return "poison";
  return "suspect";
}

// ---------- Header ----------

function NightHero({ role, day, phase, title, description, startedAt, endsAt }: {
  role: WerewolfRole | "ghost";
  day: number;
  phase: NightPhase;
  title: string;
  description: string;
  startedAt: number | null;
  endsAt: number | null;
}) {
  return (
    <header className="ww-night-hero ww-role-border relative overflow-hidden rounded-xl border p-4 sm:p-5">
      <span className="ww-moon pointer-events-none absolute right-4 top-3 text-2xl sm:text-3xl" aria-hidden>🌙</span>
      <div className="flex items-start gap-4">
        {role === "ghost" ? (
          <span className="ww-role-border flex h-24 w-[4.25rem] shrink-0 items-center justify-center rounded-lg border bg-[var(--ww-surface-soft)] text-4xl sm:h-28 sm:w-20" aria-hidden>👻</span>
        ) : (
          <RoleArtwork role={role} className="ww-role-glow h-24 w-[4.25rem] shrink-0 rounded-lg object-cover object-top sm:h-28 sm:w-20" />
        )}
        <div className="min-w-0 flex-1 pr-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]">
            <span className="ww-role-text">{role === "ghost" ? "Hồn ma" : ROLE_LABELS[role]}</span>
            <span className="text-[var(--ww-text-faint)]"> · Đêm {day}</span>
          </p>
          <h2 className="mt-1.5 font-ww-display text-xl font-bold leading-snug text-[var(--ww-text)] sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ww-text-muted)]">{description}</p>
        </div>
      </div>
      <NightSteps phase={phase} />
      <PhaseDrain key={startedAt ?? 0} startedAt={startedAt} endsAt={endsAt} />
    </header>
  );
}

function NightSteps({ phase }: { phase: NightPhase }) {
  const current = NIGHT_STEPS.indexOf(phase);
  return (
    <ol className="mt-4 flex items-center gap-2" aria-label="Các bước trong đêm">
      {NIGHT_STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className={`flex items-center gap-2 ${index < NIGHT_STEPS.length - 1 ? "flex-1" : ""}`} aria-current={active ? "step" : undefined}>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                active ? "ww-role-solid" : done ? "ww-role-soft ww-role-text" : "bg-[var(--ww-surface-soft)] text-[var(--ww-text-faint)]"
              }`}
            >
              {done ? "✓" : index + 1}
            </span>
            {/* Only the current step is named on phones — three labels don't fit. */}
            <span className={`whitespace-nowrap text-xs font-semibold ${active ? "text-[var(--ww-text)]" : "hidden text-[var(--ww-text-faint)] sm:inline"}`}>
              {GAME_CONTENT.night.steps[index]}
            </span>
            {index < NIGHT_STEPS.length - 1 && <span className={`h-px min-w-3 flex-1 ${done ? "ww-role-solid" : "bg-[var(--ww-border)]"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

// A CSS animation rather than a ticking state: started with a negative delay
// for the time already gone, so it's right even when you join mid-phase.
function PhaseDrain({ startedAt, endsAt }: { startedAt: number | null; endsAt: number | null }) {
  const [mountedAt] = useState(() => Date.now());
  if (!startedAt || !endsAt || endsAt <= startedAt) return null;
  return (
    <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--ww-surface-soft)]">
      <div
        className="ww-drain ww-role-solid h-full rounded-full"
        style={{ animationDuration: `${endsAt - startedAt}ms`, animationDelay: `${startedAt - mountedAt}ms` }}
      />
    </div>
  );
}

// ---------- Target grid ----------

type NoteTone = "danger" | "safe" | "muted";
interface CardNote {
  text: string;
  tone: NoteTone;
}

const NOTE_TONE: Record<NoteTone, string> = {
  danger: "text-[var(--ww-danger)]",
  safe: "text-[var(--ww-safe)]",
  muted: "text-[var(--ww-text-faint)]",
};

function NightTargetGrid({ players, selfId, role, phase, mode, privateState, onPick }: {
  players: WerewolfPlayer[];
  selfId: string;
  role: WerewolfRole;
  phase: NightPhase;
  mode: PickMode;
  privateState: PrivateWerewolfState;
  onPick: (targetId: string) => void;
}) {
  const teammates = role === "wolf" ? privateState.teammates : [];
  // Seer, guardian and the hunt can be "chốt": the locked pick is what counts,
  // a different tap after that is only a pending change until re-locked.
  const lockable = mode === "hunt" || mode === "see" || mode === "guard";
  const lockedId = lockable ? privateState.lockedTargetId : null;
  const pickedId = mode === "suspect" ? privateState.suspicionTargetId : privateState.previewTargetId;
  const pendingId = lockedId && pickedId !== lockedId ? pickedId : null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {players.filter((player) => player.alive && player.id !== selfId).map((player) => {
        const notes: CardNote[] = [];
        let disabled = false;

        if (teammates.includes(player.id)) {
          disabled = true;
          notes.push({ text: "🐺 Đồng đội", tone: "danger" });
        }
        if (mode === "hunt") {
          const hunters = privateState.wolfChoices.filter((choice) => choice.wolfId !== selfId && choice.targetId === player.id);
          if (hunters.length) {
            notes.push({ text: `🐺 ${hunters.map((choice) => `${playerName(choice.wolfId, players)}${choice.locked ? " 🔒" : ""}`).join(", ")}`, tone: "danger" });
          }
        }
        if (role === "seer") {
          const seen = [...privateState.seerHistory].reverse().find((result) => result.targetId === player.id);
          if (seen) notes.push({ text: `Đã soi đêm ${seen.night}: ${seen.isWolf ? "Sói" : "không phải Sói"}`, tone: seen.isWolf ? "danger" : "safe" });
        }
        if (role === "guardian" && privateState.lastGuardedPlayerId === player.id) {
          disabled = true;
          notes.push({ text: "Đã bảo vệ đêm qua", tone: "muted" });
        }
        if (role === "witch" && phase === "nightResolve" && privateState.witchVictimId === player.id) {
          notes.push({ text: "🩸 Đang bị Sói tấn công", tone: "danger" });
        }

        const status = player.id === lockedId ? "locked" : player.id === pendingId ? "pending" : !lockedId && player.id === pickedId ? "picked" : "idle";
        return (
          <NightTargetCard
            key={player.id}
            player={player}
            status={status}
            label={status === "locked" ? `🔒 ${GAME_CONTENT.night.lockedLabel}` : status === "idle" ? null : GAME_CONTENT.night.pickLabel[mode]}
            notes={notes}
            disabled={disabled}
            onPick={() => onPick(player.id)}
          />
        );
      })}
    </div>
  );
}

function NightTargetCard({ player, status, label, notes, disabled, onPick }: {
  player: WerewolfPlayer;
  status: "idle" | "picked" | "locked" | "pending";
  label: string | null;
  notes: CardNote[];
  disabled: boolean;
  onPick: () => void;
}) {
  const statusClass = {
    locked: "ww-role-border ww-role-soft ww-role-glow",
    picked: "ww-role-border ww-role-soft ww-role-glow",
    pending: "ww-role-border border-dashed bg-[var(--ww-surface-soft)]",
    idle: "border-[var(--ww-border)] bg-[var(--ww-surface-soft)] hover:border-[var(--ww-border-strong)] hover:bg-[var(--ww-surface-soft-hover)]",
  }[status];

  return (
    <button
      disabled={disabled}
      onClick={onPick}
      aria-pressed={status !== "idle"}
      className={`flex min-h-[64px] items-center gap-3 rounded-lg border p-2.5 text-left transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${statusClass}`}
    >
      <span className="relative shrink-0">
        <PlayerAvatar player={player} size="sm" />
        {status === "locked" && (
          <span className="ww-role-solid animate-bounce-in absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px]" aria-hidden>🔒</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--ww-text)]">{player.name}</span>
        {label && <span className="ww-role-text block truncate text-[11px] font-bold uppercase tracking-wider">{label}</span>}
        {notes.map((note) => (
          <span key={note.text} className={`block truncate text-[11px] font-medium ${NOTE_TONE[note.tone]}`}>{note.text}</span>
        ))}
      </span>
    </button>
  );
}

// ---------- Wolves ----------

function PackStrip({ players, selfId, privateState }: { players: WerewolfPlayer[]; selfId: string; privateState: PrivateWerewolfState }) {
  return (
    <div className="mt-4 rounded-lg border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] p-3">
      <p className="ww-role-text text-[11px] font-bold uppercase tracking-[0.18em]">{GAME_CONTENT.night.wolfChoicesTitle}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {privateState.wolfChoices.map((choice) => (
          <span key={choice.wolfId} className="inline-flex items-center gap-1 rounded-full border border-[var(--ww-border)] bg-[var(--ww-surface-strong)] px-2.5 py-1 text-xs text-[var(--ww-text-muted)]">
            <strong className="text-[var(--ww-text)]">{choice.wolfId === selfId ? "Bạn" : playerName(choice.wolfId, players)}</strong>
            <span aria-hidden>→</span>
            {choice.targetId ? <span className="ww-role-text font-semibold">{playerName(choice.targetId, players)}</span> : <span>{GAME_CONTENT.night.wolfThinking}</span>}
            {choice.locked && <span aria-label="đã khóa">🔒</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Witch ----------

function WitchPanel({ players, selfId, privateState, canSelfSave, send }: {
  players: WerewolfPlayer[];
  selfId: string;
  privateState: PrivateWerewolfState;
  canSelfSave: boolean;
  send: Send;
}) {
  const content = GAME_CONTENT.night.witch;
  const decision = privateState.witchDecision;
  const victim = players.find((player) => player.id === privateState.witchVictimId) ?? null;
  const picked = players.find((player) => player.id === privateState.previewTargetId && player.id !== selfId) ?? null;
  const poisoned = decision === "poison" ? players.find((player) => player.id === privateState.witchPoisonTargetId) ?? null : null;

  const healBlocked = !privateState.healAvailable
    ? "Bình cứu đã dùng"
    : !victim
      ? "Đêm nay không ai bị tấn công"
      : !canSelfSave && victim.id === selfId
        ? "Luật phòng không cho tự cứu"
        : null;
  const poisonBlocked = !privateState.poisonAvailable
    ? "Bình độc đã dùng"
    : !picked
      ? "Chọn một người ở danh sách bên dưới"
      : null;

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <PotionCard
        icon="🧪"
        title={content.healTitle}
        color="var(--ww-safe)"
        available={privateState.healAvailable}
        chosen={decision === "heal"}
        player={victim}
        caption={victim ? (victim.id === selfId ? "Chính bạn đang bị tấn công" : "Đang bị Sói tấn công") : null}
        emptyText="Không có nạn nhân"
        blocked={healBlocked}
        actionLabel={decision === "heal" && victim ? `✓ Sẽ cứu ${victim.name}` : victim ? content.healButton(victim.name) : content.healTitle}
        onAction={() => send({ type: "witch_decision", decision: "heal" })}
      />
      <PotionCard
        icon="☠️"
        title={content.poisonTitle}
        color="var(--ww-danger)"
        available={privateState.poisonAvailable}
        chosen={decision === "poison"}
        player={poisoned ?? picked}
        caption={poisoned ? "Sẽ trúng độc khi đêm kết thúc" : picked ? "Người bạn đang chọn" : null}
        emptyText="Chưa chọn ai"
        blocked={poisonBlocked}
        actionLabel={
          poisoned && (!picked || picked.id === poisoned.id)
            ? `✓ Sẽ đầu độc ${poisoned.name}`
            : picked
              ? poisoned ? `Đổi sang ${picked.name}` : content.poisonButton(picked.name)
              : content.poisonTitle
        }
        actionDone={Boolean(poisoned && (!picked || picked.id === poisoned.id))}
        onAction={() => picked && send({ type: "witch_decision", decision: "poison", targetId: picked.id })}
      />
      <button
        onClick={() => send({ type: "witch_decision", decision: "skip" })}
        aria-pressed={decision === "skip"}
        className={`rounded-lg border px-4 py-3 text-sm font-semibold transition sm:col-span-2 ${
          decision === "skip"
            ? "ww-role-border ww-role-soft text-[var(--ww-text)]"
            : "border-[var(--ww-border)] bg-[var(--ww-surface-soft)] text-[var(--ww-text-muted)] hover:text-[var(--ww-text)]"
        }`}
      >
        {decision === "skip" ? `✓ ${content.skipButton}` : content.skipButton}
      </button>
    </div>
  );
}

function PotionCard({ icon, title, color, available, chosen, player, caption, emptyText, blocked, actionLabel, actionDone = chosen, onAction }: {
  icon: string;
  title: string;
  color: string;
  available: boolean;
  chosen: boolean;
  player: WerewolfPlayer | null;
  caption: string | null;
  emptyText: string;
  blocked: string | null;
  actionLabel: string;
  actionDone?: boolean;
  onAction: () => void;
}) {
  const tint: CSSProperties = {
    borderColor: `color-mix(in srgb, ${color} ${chosen ? 70 : 35}%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${color} ${chosen ? 16 : 7}%, transparent)`,
    boxShadow: chosen ? `0 0 26px -8px ${color}` : undefined,
  };

  return (
    <section style={tint} className={`flex flex-col rounded-lg border p-3.5 transition ${available ? "" : "opacity-55"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-[var(--ww-text)]">
          <span aria-hidden>{icon}</span> {title}
        </span>
        <span className="rounded-full bg-[var(--ww-surface-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ww-text-muted)]">
          {available ? "Còn 1 lần" : "Đã dùng"}
        </span>
      </div>
      <div className="mt-3 flex min-h-[44px] items-center gap-3">
        {player ? (
          <>
            <PlayerAvatar player={player} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-semibold text-[var(--ww-text)]">{player.name}</div>
              {caption && <div className="truncate text-xs text-[var(--ww-text-muted)]">{caption}</div>}
            </div>
          </>
        ) : (
          <p className="text-xs text-[var(--ww-text-faint)]">{emptyText}</p>
        )}
      </div>
      <button
        onClick={onAction}
        disabled={Boolean(blocked) || actionDone}
        style={{ backgroundColor: color }}
        className="mt-3 rounded-md px-3 py-2.5 text-sm font-bold text-[#0b1020] transition hover:brightness-110 disabled:opacity-45 disabled:hover:brightness-100"
      >
        {blocked ?? actionLabel}
      </button>
    </section>
  );
}

function witchTitle(victimId: string | null, players: WerewolfPlayer[]): string {
  if (!victimId) return GAME_CONTENT.night.witch.noVictim;
  return GAME_CONTENT.night.witch.victim(playerName(victimId, players));
}

// ---------- Seer / guardian suspicion note ----------

// The seer's and guardian's taps are spent on their ability, so their private
// "who do I suspect" note gets its own row on the last step.
function SuspicionChips({ players, selfId, selected, send }: { players: WerewolfPlayer[]; selfId: string; selected: string | null; send: Send }) {
  return (
    <section className="mt-5 rounded-lg border border-[var(--ww-border)] bg-[var(--ww-warn-soft)] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ww-warn)]">📝 Note nghi ngờ cá nhân</span>
        <span className="text-[11px] text-[var(--ww-text-faint)]">Chỉ mình bạn thấy · cộng vào thống kê cuối ván</span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {players.filter((player) => player.alive && player.id !== selfId).map((player) => (
          <button
            key={player.id}
            onClick={() => send({ type: "set_suspicion", targetId: player.id })}
            aria-pressed={selected === player.id}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              selected === player.id
                ? "border-[var(--ww-warn)] bg-[var(--ww-warn-soft)] text-[var(--ww-warn)]"
                : "border-[var(--ww-border)] text-[var(--ww-text-muted)] hover:text-[var(--ww-text)]"
            }`}
          >
            {player.name}
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------- Sticky action bar ----------

interface Summary {
  targetId: string | null;
  title: ReactNode;
  detail: string;
  action?: { label: string; disabled: boolean; onClick: () => void };
}

function ActionBar({ players, role, phase, mode, privateState, send }: {
  players: WerewolfPlayer[];
  role: WerewolfRole;
  phase: NightPhase;
  mode: PickMode;
  privateState: PrivateWerewolfState;
  send: Send;
}) {
  const summary = summarize(players, role, phase, mode, privateState, send);
  const target = players.find((player) => player.id === summary.targetId);

  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-5 rounded-xl border border-[var(--ww-border)] bg-[var(--ww-surface-strong)] p-3 shadow-[0_-14px_30px_-14px_rgba(0,0,0,0.9)] backdrop-blur-md">
      <div className="flex items-center gap-3">
        {target ? (
          <PlayerAvatar player={target} size="sm" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--ww-border-strong)] text-sm text-[var(--ww-text-faint)]" aria-hidden>?</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--ww-text)]">{summary.title}</p>
          <p className="line-clamp-2 text-xs text-[var(--ww-text-muted)]">{summary.detail}</p>
        </div>
        {summary.action && (
          <button
            onClick={summary.action.onClick}
            disabled={summary.action.disabled}
            className="ww-role-solid max-w-[45%] shrink-0 truncate rounded-md px-4 py-2.5 text-sm font-bold transition hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
          >
            {summary.action.label}
          </button>
        )}
      </div>
      {/* Same button for every role (and shows nothing about who's done), so
          skipping the wait can't give away who is still deciding. */}
      <button
        onClick={() => send({ type: "ack_night" })}
        disabled={privateState.nightDone}
        className="mt-2.5 w-full rounded-md border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] py-2 text-sm font-semibold text-[var(--ww-text-muted)] transition hover:text-[var(--ww-text)] disabled:opacity-60"
      >
        {privateState.nightDone ? "✓ Đã xong — chờ mọi người…" : "Xong, sang bước tiếp"}
      </button>
    </div>
  );
}

function summarize(players: WerewolfPlayer[], role: WerewolfRole, phase: NightPhase, mode: PickMode, privateState: PrivateWerewolfState, send: Send): Summary {
  const name = (id: string | null) => (id ? playerName(id, players) : "");
  const { lockedTargetId: locked, previewTargetId: preview } = privateState;
  const pending = preview && preview !== locked ? preview : null;

  if (mode === "hunt") {
    const target = pending ?? locked;
    const pack = privateState.wolfChoices;
    const agreed = pack.length > 1 && pack.every((choice) => choice.targetId && choice.targetId === pack[0].targetId);
    const detail = phase === "nightExplore"
      ? "Bước 2 mới khóa được — chưa khóa thì vẫn tính người đang nhắm."
      : locked && pending
        ? `Đang khóa ${name(locked)} — bấm Khóa để đổi.`
        : pack.length < 2
          ? "Hết giờ, bầy sẽ săn người này."
          : agreed
            ? "Cả bầy đồng thuận ✓"
            : "Bầy đang chia phiếu — hòa thì số phận sẽ chọn.";
    return {
      targetId: target,
      title: locked && !pending ? `🔒 Đã khóa: ${name(locked)}` : target ? `Đang nhắm: ${name(target)}` : "Chưa chọn con mồi",
      detail,
      action: phase === "wolfLock"
        ? {
            label: pending ? `${GAME_CONTENT.night.wolfLockButton} ${name(pending)}` : locked ? "✓ Đã khóa" : GAME_CONTENT.night.wolfLockButton,
            disabled: !pending,
            onClick: () => pending && send({ type: "lock_target", targetId: pending }),
          }
        : undefined,
    };
  }

  if (mode === "see" || mode === "guard") {
    const verb = mode === "see" ? "soi" : "bảo vệ";
    const detail = locked && !pending
      ? mode === "see" ? "Kết quả hiện riêng cho bạn lúc bình minh." : "Lá chắn chặn được Sói, không chặn được bình độc."
      : locked
        ? `Đang chốt ${name(locked)} — bấm để đổi.`
        : phase === "nightExplore"
          ? "Bước 2 mới chốt được — chưa chốt thì vẫn tính người đang chọn."
          : "Chưa chốt vẫn được tính người đang chọn.";
    return {
      targetId: pending ?? locked,
      title: locked && !pending ? `🔒 Sẽ ${verb}: ${name(locked)}` : pending ? `Định ${verb}: ${name(pending)}` : `Chưa chọn ai để ${verb}`,
      detail,
      action: phase === "nightExplore"
        ? undefined
        : {
            label: pending ? `${locked ? "Đổi sang" : GAME_CONTENT.night.lockButton} ${name(pending)}` : locked ? "✓ Đã chốt" : GAME_CONTENT.night.lockButton,
            disabled: !pending,
            onClick: () => pending && send({ type: "lock_target", targetId: pending }),
          },
    };
  }

  if (role === "witch" && phase === "nightResolve") {
    const decision = privateState.witchDecision;
    return {
      targetId: decision === "heal" ? privateState.witchVictimId : decision === "poison" ? privateState.witchPoisonTargetId : null,
      title: decision === "heal"
        ? `🧪 Sẽ cứu ${name(privateState.witchVictimId)}`
        : decision === "poison"
          ? `☠️ Sẽ đầu độc ${name(privateState.witchPoisonTargetId)}`
          : decision === "skip"
            ? "Đêm nay không dùng bình nào"
            : "Chưa quyết định",
      detail: decision ? "Vẫn đổi được đến hết giờ." : "Hết giờ mà chưa chọn thì coi như không làm gì.",
    };
  }

  const suspect = privateState.suspicionTargetId;
  return {
    targetId: suspect,
    title: suspect ? `Đang nghi: ${name(suspect)}` : "Chưa ghi chú ai",
    detail: role === "wolf"
      ? "Ai sẽ chống lại bầy ngày mai? Ghi chú chỉ mình bạn thấy."
      : role === "witch"
        ? "Chỉ mình bạn thấy — cũng là mục tiêu độc mặc định ở bước cuối."
        : "Chỉ mình bạn thấy — cộng vào thống kê cuối ván.",
  };
}

// ---------- Dead players ----------

function GhostNight({ state, phase }: { state: PublicWerewolfState; phase: NightPhase }) {
  return (
    <div className="ww-night" data-role="ghost">
      <NightHero
        role="ghost"
        day={state.day}
        phase={phase}
        title={GAME_CONTENT.night.ghostTitle}
        description={GAME_CONTENT.night.ghostDescription}
        startedAt={state.phaseStartedAt}
        endsAt={state.phaseEndsAt}
      />
    </div>
  );
}

function playerName(playerId: string, players: WerewolfPlayer[]): string {
  return players.find((player) => player.id === playerId)?.name ?? "Một người chơi";
}
