import type { NightSuspicionResult as NightSuspicionData, WerewolfPlayer } from "@shared/werewolfTypes";
import { PlayerAvatar } from "./ui";

export function NightSuspicionResult({ data, players }: { data: NightSuspicionData; players: WerewolfPlayer[] }) {
  return (
    <section className="rounded-2xl border border-violet-300/15 bg-violet-950/30 p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Dư luận sau đêm {data.night}</p>
          <h3 className="mt-1 font-semibold text-white">Ai đang bị cả làng nghi ngờ?</h3>
        </div>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">{data.totalVotes} phiếu</span>
      </div>

      {data.results.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">Không có phiếu nghi ngờ hợp lệ trong đêm.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {data.results.map((result, index) => {
            const player = players.find((candidate) => candidate.id === result.playerId);
            if (!player) return null;
            return (
              <div key={result.playerId} className="grid grid-cols-[24px_36px_1fr_auto] items-center gap-2">
                <span className={`text-center text-xs font-black ${index === 0 ? "text-amber-300" : "text-slate-500"}`}>#{index + 1}</span>
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="truncate font-semibold text-slate-200">{player.name}</span>
                    <span className="text-slate-400">{result.votes} phiếu</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-rose-500" style={{ width: `${result.percentage}%` }} />
                  </div>
                </div>
                <span className="w-10 text-right text-sm font-black text-rose-300">{result.percentage}%</span>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-5 text-slate-500">Danh tính người bỏ phiếu được giữ kín. Kết quả này chỉ tổng hợp note nghi ngờ cá nhân của đêm vừa qua.</p>
    </section>
  );
}

