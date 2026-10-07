import type { PrivateWerewolfState, SeerResult, WerewolfPlayer, WerewolfRole } from "@shared/werewolfTypes";
import { GAME_CONTENT } from "./gameContent";
import { PlayerAvatar } from "./ui";

/** The Seer's read from the night that just ended (night N resolves into day N). */
export function seerResultForDay(role: WerewolfRole | null, privateState: PrivateWerewolfState | null, day: number): SeerResult | null {
  if (role !== "seer" || !privateState) return null;
  return privateState.seerHistory.find((result) => result.night === day) ?? null;
}

// Only ever fed from the seer's own private state, so no other screen can
// show it. It's the one hard fact the seer gets to work with all day, so dawn
// leads with it instead of leaving it tucked away in the notebook tab.
// `compact` is the one-line version pinned above the discussion chat.
export function SeerResultBanner({ result, players, compact = false }: { result: SeerResult; players: WerewolfPlayer[]; compact?: boolean }) {
  const content = GAME_CONTENT.discussion;
  const target = players.find((player) => player.id === result.targetId);
  const targetName = target?.name ?? "Một người chơi";
  const verdict = result.isWolf ? content.wolfResult : content.safeResult;
  // The box itself stays neutral: a big red/green panel would tell anyone
  // glancing over that this player is the seer (and what they found).
  const tone = "border-[var(--ww-border-strong)] bg-[var(--ww-accent-soft)]";
  const verdictColor = result.isWolf ? "text-[var(--ww-danger)]" : "text-[var(--ww-safe)]";

  if (compact) {
    return (
      <section className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-left ${tone}`}>
        <span aria-hidden>🔮</span>
        {target && <PlayerAvatar player={target} size="sm" />}
        <p className="min-w-0 flex-1 text-sm text-[var(--ww-text)]">
          <span className="text-[var(--ww-text-muted)]">Đêm {result.night} bạn soi </span>
          <strong>{targetName}</strong>
          <span className="text-[var(--ww-text-muted)]"> — </span>
          <strong className={verdictColor}>{verdict}</strong>
        </p>
      </section>
    );
  }

  return (
    <section className={`animate-death-banner rounded-xl border p-5 text-center sm:p-6 ${tone}`}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--ww-accent)]">
        🔮 Kết quả soi đêm {result.night} · chỉ mình bạn thấy
      </p>
      <div className="mx-auto mt-4 flex max-w-md items-center gap-4 rounded-md border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] p-4 text-left">
        {target && <PlayerAvatar player={target} />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-black text-[var(--ww-text)]">{targetName}</div>
          <div className={`mt-1 text-lg font-black ${verdictColor}`}>
            {result.isWolf ? "🐺 " : "🛡️ "}
            {verdict}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-[var(--ww-text-faint)]">
        {target && !target.alive
          ? "Người này đã không qua khỏi đêm qua."
          : "Kết quả được lưu trong “Ghi chú riêng” suốt ván. Cân nhắc kỹ trước khi lộ diện nhé."}
      </p>
    </section>
  );
}
