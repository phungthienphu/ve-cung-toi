import type { SuspicionStatistic, WerewolfPlayer } from "@shared/werewolfTypes";
import { PlayerAvatar } from "./ui";

export function ExecutionRiskSummary({ stats, players }: { stats: SuspicionStatistic[]; players: WerewolfPlayer[] }) {
  return (
    <section className="rounded-2xl border border-[var(--ww-danger)]/25 bg-[var(--ww-danger-soft)] p-4 text-left">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ww-danger)]">Bảng phong thần</p>
      <h3 className="mt-1 font-semibold text-[var(--ww-text)]">Ai suýt bị cả làng xử nhiều nhất?</h3>

      <div className="mt-4 space-y-3">
        {stats.map((stat, index) => {
          const player = players.find((candidate) => candidate.id === stat.playerId);
          if (!player) return null;
          return (
            <div key={stat.playerId} className="grid grid-cols-[24px_36px_1fr_auto] items-center gap-2">
              <span className={`text-center text-xs font-black ${index === 0 ? "text-[var(--ww-warn)]" : "text-[var(--ww-text-faint)]"}`}>#{index + 1}</span>
              <PlayerAvatar player={player} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-[var(--ww-text)]">{player.name}</span>
                  <span className="text-[11px] text-[var(--ww-text-muted)]">🌙 {stat.nightVotes} · ☀️ {stat.dayVotes}×2</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--ww-surface-soft-hover)]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[var(--ww-warn)] via-orange-500 to-[var(--ww-danger)]" style={{ width: `${stat.percentage}%` }} />
                </div>
              </div>
              <span className="w-11 text-right text-base font-black text-[var(--ww-danger)]">{stat.percentage}%</span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] leading-5 text-[var(--ww-text-faint)]">Công thức: phiếu nghi ngờ ban đêm + phiếu xử bắn ban ngày ×2. Tỉ lệ là phần điểm của mỗi người trên tổng điểm toàn làng.</p>
    </section>
  );
}

