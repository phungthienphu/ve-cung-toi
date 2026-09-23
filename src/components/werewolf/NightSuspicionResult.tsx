import type { NightSuspicionResult as NightSuspicionData, WerewolfPlayer } from "@shared/werewolfTypes";
import { PlayerAvatar } from "./ui";

// This is public, high-stakes information (who the whole village suspects)
// so it's themed as an alarm, not a neutral stat card: danger-red border/glow,
// a pulsing icon, and the top suspect called out in a bigger highlighted row.
// `compact` renders a shortened version (top 3, no footnote) for pinning above
// the fold in the discussion screen, where space is tight.
export function NightSuspicionResult({ data, players, compact = false }: { data: NightSuspicionData; players: WerewolfPlayer[]; compact?: boolean }) {
  const results = compact ? data.results.slice(0, 3) : data.results;

  return (
    <section className="rounded-2xl border border-[var(--ww-danger)]/40 bg-[var(--ww-danger-soft)] p-4 text-left shadow-[0_0_24px_-8px_var(--ww-danger)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--ww-danger)]">
            <span className="animate-pulse" aria-hidden>🚨</span> Dư luận sau đêm {data.night}
          </p>
          <h3 className="mt-1 font-semibold text-[var(--ww-text)]">Ai đang bị cả làng nghi ngờ?</h3>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--ww-surface-soft)] px-2.5 py-1 text-xs text-[var(--ww-text-muted)]">{data.totalVotes} phiếu</span>
      </div>

      {results.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--ww-text-muted)]">Không có phiếu nghi ngờ hợp lệ trong đêm.</p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {results.map((result, index) => {
            const player = players.find((candidate) => candidate.id === result.playerId);
            if (!player) return null;
            const isTop = index === 0;
            return (
              <div
                key={result.playerId}
                className={`grid grid-cols-[24px_36px_1fr_auto] items-center gap-2 ${isTop ? "-mx-2 rounded-xl bg-[var(--ww-danger)]/12 px-2 py-1.5" : ""}`}
              >
                <span className={`text-center font-black ${isTop ? "text-base text-[var(--ww-warn)]" : "text-xs text-[var(--ww-text-faint)]"}`}>#{index + 1}</span>
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className={`truncate font-semibold text-[var(--ww-text)] ${isTop ? "text-sm" : ""}`}>{player.name}</span>
                    <span className="text-[var(--ww-text-muted)]">{result.votes} phiếu</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--ww-surface-soft-hover)]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[var(--ww-warn)] to-[var(--ww-danger)]" style={{ width: `${result.percentage}%` }} />
                  </div>
                </div>
                <span className={`w-10 text-right font-black text-[var(--ww-danger)] ${isTop ? "text-base" : "text-sm"}`}>{result.percentage}%</span>
              </div>
            );
          })}
        </div>
      )}

      {!compact && (
        <p className="mt-4 text-[11px] leading-5 text-[var(--ww-text-faint)]">Danh tính người bỏ phiếu được giữ kín. Kết quả này chỉ tổng hợp note nghi ngờ cá nhân của đêm vừa qua.</p>
      )}
    </section>
  );
}

