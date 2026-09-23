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
    <section className="rounded-2xl border border-amber-300/15 bg-amber-950/20 p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Sổ nghi ngờ riêng</p>
          <h3 className="mt-1 font-semibold text-white">Ai xuất hiện nhiều nhất trong suy luận của bạn?</h3>
        </div>
        <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs text-amber-200">{history.length} đêm</span>
      </div>

      {ranked.length === 0 ? (
        <p className="mt-5 text-sm text-slate-400">Bạn chưa ghi nhận nghi ngờ nào.</p>
      ) : (
        <>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-3">
            <div className="text-xs text-slate-400">Bị nghi nhiều nhất</div>
            <div className="mt-1 truncate font-bold text-white">{mostSuspectedPlayer?.name}</div>
            <div className="mt-1 text-xs text-amber-200">{mostSuspected?.[1]} lần</div>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <div className="text-xs text-slate-400">Tần suất bạn nghi</div>
            <div className="mt-1 text-2xl font-black text-rose-300">{highestFrequency}%</div>
            <div className="text-[11px] text-slate-500">Trong note cá nhân</div>
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
                    <span className="truncate text-sm font-medium">{player.name}</span>
                    <span className="text-[11px] text-slate-400">{count} lần bị nghi</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500" style={{ width: `${(count / maximum) * 100}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-rose-300">{frequency}%</div>
                  <div className="text-[10px] text-slate-500">tần suất</div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[11px] leading-5 text-slate-500">
          Tần suất cá nhân = số đêm bạn nghi người này ÷ tổng số đêm đã ghi nhận. Chỉ số bị xử của cả làng chỉ được công bố khi game kết thúc.
        </p>
        </>
      )}

      {history.length > 0 && (
        <div className="mt-5 border-t border-white/10 pt-3">
          <p className="mb-2 text-xs font-semibold text-slate-400">Dòng suy luận</p>
          <div className="flex flex-wrap gap-2">
            {history.map((entry) => (
              <span key={`${entry.night}-${entry.targetId}`} className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                Đêm {entry.night} → {players.find((player) => player.id === entry.targetId)?.name ?? "Không rõ"}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
