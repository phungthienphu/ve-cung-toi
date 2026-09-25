import { ROLE_LABELS, type SuspicionStatistic, type WerewolfRole, type WerewolfTeam } from "@shared/werewolfTypes";
import { RoleArtwork } from "./ui";

export interface WerewolfHistoryDetailData {
  players: Array<{
    playerId: string;
    name: string;
    role: WerewolfRole;
    team: WerewolfTeam;
    survived: boolean;
    won: boolean;
  }>;
  events: Array<{
    id: string;
    day: number;
    type: "night_death" | "vote_elimination" | "peaceful_night";
    playerIds: string[];
  }>;
  suspicionStats?: SuspicionStatistic[];
  daysPlayed: number;
  startedAt?: number;
}

export function WerewolfHistoryDetail({ detail, winner }: { detail: WerewolfHistoryDetailData; winner?: WerewolfTeam | null }) {
  return (
    <div>
      <div className={`mb-4 rounded-md border p-4 ${winner === "village" ? "border-amber-300/20 bg-amber-50" : "border-rose-300/30 bg-rose-50"}`}>
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Kết quả</div>
        <div className="mt-1 text-lg font-bold text-slate-900">
          {winner === "village" ? "Phe Dân chiến thắng" : "Phe Sói chiến thắng"}
        </div>
        <div className="text-sm text-slate-500">Ván đấu kéo dài {detail.daysPlayed} ngày.</div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {detail.players.map((player) => (
          <div key={player.name} className={`flex items-center gap-3 rounded-md border p-3 ${player.won ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            <RoleArtwork role={player.role} className="h-16 w-11 rounded object-cover object-top shadow" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-slate-900">{player.name}</div>
              <div className="mt-0.5 text-xs font-medium text-violet-700">{ROLE_LABELS[player.role]}</div>
              <div className="mt-1 text-xs text-slate-500">
                {player.survived ? "Sống sót" : "Đã chết"} · {player.won ? "Chiến thắng" : "Thất bại"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {detail.suspicionStats?.length ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Chỉ số bị xử</div>
          <div className="mt-3 space-y-2">
            {detail.suspicionStats.map((stat) => {
              const player = detail.players.find((candidate) => candidate.playerId === stat.playerId);
              return (
                <div key={stat.playerId} className="flex items-center gap-3 text-xs">
                  <span className="w-24 truncate font-semibold text-slate-700">{player?.name ?? stat.playerId}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-rose-500" style={{ width: `${stat.percentage}%` }} /></div>
                  <span className="w-10 text-right font-black text-rose-600">{stat.percentage}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
