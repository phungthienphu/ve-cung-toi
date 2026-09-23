/* eslint-disable @next/next/no-img-element -- DiceBear returns generated SVG avatars. */
import { werewolfAvatarUrl } from "@/lib/werewolfAvatar";
import { ROLE_EMOJI, ROLE_LABELS, type WerewolfPlayer } from "@shared/werewolfTypes";

export function PlayerAvatar({ player, size = "md" }: { player: WerewolfPlayer; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "h-9 w-9" : "h-14 w-14";

  return (
    <img
      src={werewolfAvatarUrl(player.avatarSeed)}
      alt=""
      className={`${dimensions} rounded-full border-2 border-white/15 bg-slate-800 object-cover`}
    />
  );
}

interface TargetGridProps {
  players: WerewolfPlayer[];
  selfId: string;
  selected: string | null;
  disabledIds?: string[];
  onPick: (playerId: string) => void;
}

export function TargetGrid({ players, selfId, selected, disabledIds = [], onPick }: TargetGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {players.filter((player) => player.alive).map((player) => {
        const disabled = player.id === selfId || disabledIds.includes(player.id);
        const selectedClass = selected === player.id
          ? "border-violet-400 bg-violet-500/20 ring-1 ring-violet-400"
          : "border-white/10 bg-white/5 hover:bg-white/10";

        return (
          <button
            key={player.id}
            disabled={disabled}
            onClick={() => onPick(player.id)}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${selectedClass} disabled:cursor-not-allowed disabled:opacity-30`}
          >
            <PlayerAvatar player={player} size="sm" />
            <span className="min-w-0 truncate text-sm font-medium">{player.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PlayerSidebar({ players, onLeave }: { players: WerewolfPlayer[]; onLeave: () => void }) {
  const livingCount = players.filter((player) => player.alive).length;

  return (
    <aside className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">Ngôi làng</h3>
        <span className="text-xs text-slate-500">{livingCount} sống</span>
      </div>

      <div className="space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className={`flex items-center gap-2 rounded-lg p-2 ${player.alive ? "bg-white/5" : "opacity-40 grayscale"}`}
          >
            <PlayerAvatar player={player} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{player.name}</div>
              <div className="text-[11px] text-slate-500">{playerStatus(player)}</div>
            </div>
            {player.revealedRole && (
              <span title={ROLE_LABELS[player.revealedRole]}>{ROLE_EMOJI[player.revealedRole]}</span>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onLeave}
        className="mt-5 w-full rounded-lg border border-white/10 py-2 text-xs text-slate-400 hover:text-white"
      >
        Rời phòng
      </button>
    </aside>
  );
}

function playerStatus(player: WerewolfPlayer): string {
  if (!player.connected) return "Mất kết nối";
  if (!player.alive) return "Đã chết";
  if (player.isHost) return "Chủ phòng";
  return "Còn sống";
}
