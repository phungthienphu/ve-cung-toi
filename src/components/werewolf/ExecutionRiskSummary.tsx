import type { SuspicionStatistic, WerewolfPlayer } from "@shared/werewolfTypes";
import { PlayerAvatar } from "./ui";

export function ExecutionRiskSummary({ stats, players }: { stats: SuspicionStatistic[]; players: WerewolfPlayer[] }) {
  return (
    <section className="rounded-2xl border border-rose-300/15 bg-rose-950/25 p-4 text-left">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-300">Bảng phong thần</p>
      <h3 className="mt-1 font-semibold text-white">Ai suýt bị cả làng xử nhiều nhất?</h3>

      <div className="mt-4 space-y-3">
        {stats.map((stat, index) => {
          const player = players.find((candidate) => candidate.id === stat.playerId);
          if (!player) return null;
          return (
            <div key={stat.playerId} className="grid grid-cols-[24px_36px_1fr_auto] items-center gap-2">
              <span className={`text-center text-xs font-black ${index === 0 ? "text-amber-300" : "text-slate-500"}`}>#{index + 1}</span>
              <PlayerAvatar player={player} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{player.name}</span>
                  <span className="text-[11px] text-slate-400">🌙 {stat.nightVotes} · ☀️ {stat.dayVotes}×2</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600" style={{ width: `${stat.percentage}%` }} />
                </div>
              </div>
              <span className="w-11 text-right text-base font-black text-rose-300">{stat.percentage}%</span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] leading-5 text-slate-500">Công thức: phiếu nghi ngờ ban đêm + phiếu trục xuất ban ngày ×2. Tỉ lệ là phần điểm của mỗi người trên tổng điểm toàn làng.</p>
    </section>
  );
}

