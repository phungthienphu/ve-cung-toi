import type { SuspicionEntry, WerewolfPlayer } from "@shared/werewolfTypes";
import { PlayerAvatar } from "./ui";

export function SuspicionChart({ history, players }: { history: SuspicionEntry[]; players: WerewolfPlayer[] }) {
  const counts = history.reduce<Map<string, number>>((result, entry) => {
    result.set(entry.targetId, (result.get(entry.targetId) ?? 0) + 1);
    return result;
  }, new Map());
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  const maximum = Math.max(1, ...ranked.map(([, count]) => count));
  const mostSuspected = ranked[0];
  const mostSuspectedPlayer = mostSuspected
    ? players.find((player) => player.id === mostSuspected[0])
    : null;
  const highestFrequency = mostSuspected
    ? Math.round((mostSuspected[1] / Math.max(1, history.length)) * 100)
    : 0;

  return (
    <section className="rounded-2xl border border-[var(--ww-warn)]/25 bg-[var(--ww-warn-soft)] p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ww-warn)]">Sổ nghi ngờ riêng</p>
          <h3 className="mt-1 font-semibold text-[var(--ww-text)]">Ai xuất hiện nhiều nhất trong suy luận của bạn?</h3>
        </div>
        <span className="rounded-full bg-[var(--ww-warn)]/10 px-2.5 py-1 text-xs text-[var(--ww-warn)]">{history.length} đêm</span>
      </div>

      {ranked.length === 0 ? (
        <p className="mt-5 text-sm text-[var(--ww-text-muted)]">Bạn chưa ghi nhận nghi ngờ nào.</p>
      ) : (
        <>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[var(--ww-surface-soft)] p-3">
            <div className="text-xs text-[var(--ww-text-muted)]">Bị nghi nhiều nhất</div>
            <div className="mt-1 truncate font-bold text-[var(--ww-text)]">{mostSuspectedPlayer?.name}</div>
            <div className="mt-1 text-xs text-[var(--ww-warn)]">{mostSuspected?.[1]} lần</div>
          </div>
          <div className="rounded-xl bg-[var(--ww-surface-soft)] p-3">
            <div className="text-xs text-[var(--ww-text-muted)]">Tần suất bạn nghi</div>
            <div className="mt-1 text-2xl font-black text-[var(--ww-danger)]">{highestFrequency}%</div>
            <div className="text-[11px] text-[var(--ww-text-faint)]">Trong note cá nhân</div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {ranked.map(([playerId, count]) => {
            const player = players.find((candidate) => candidate.id === playerId);
            if (!player) return null;
            const frequency = Math.round((count / Math.max(1, history.length)) * 100);
            return (
              <div key={playerId} className="grid grid-cols-[36px_1fr_auto] items-center gap-3">
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-[var(--ww-text)]">{player.name}</span>
                    <span className="text-[11px] text-[var(--ww-text-muted)]">{count} lần bị nghi</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--ww-surface-soft-hover)]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[var(--ww-warn)] to-[var(--ww-danger)]" style={{ width: `${(count / maximum) * 100}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-[var(--ww-danger)]">{frequency}%</div>
                  <div className="text-[10px] text-[var(--ww-text-faint)]">tần suất</div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[11px] leading-5 text-[var(--ww-text-faint)]">
          Tần suất cá nhân = số đêm bạn nghi người này ÷ tổng số đêm đã ghi nhận. Chỉ số bị xử của cả làng chỉ được công bố khi game kết thúc.
        </p>
        </>
      )}

      {history.length > 0 && (
        <div className="mt-5 border-t border-[var(--ww-border)] pt-3">
          <p className="mb-2 text-xs font-semibold text-[var(--ww-text-muted)]">Dòng suy luận</p>
          <div className="flex flex-wrap gap-2">
            {history.map((entry) => (
              <span key={`${entry.night}-${entry.targetId}`} className="rounded-full bg-[var(--ww-surface-soft)] px-3 py-1 text-xs text-[var(--ww-text-muted)]">
                Đêm {entry.night} → {players.find((player) => player.id === entry.targetId)?.name ?? "Không rõ"}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
