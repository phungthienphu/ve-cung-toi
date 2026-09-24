/* eslint-disable @next/next/no-img-element -- DiceBear returns generated SVG avatars. */
import { werewolfAvatarUrl } from "@/lib/werewolfAvatar";
import { ROLE_EMOJI, ROLE_LABELS, type WerewolfPlayer } from "@shared/werewolfTypes";
import type { WerewolfRole } from "@shared/werewolfTypes";
import { ROLE_ARTWORK } from "./roleAssets";

export function PlayerAvatar({ player, size = "md" }: { player: WerewolfPlayer; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "h-9 w-9" : "h-14 w-14";

  return (
    <img
      src={werewolfAvatarUrl(player.avatarSeed)}
      alt=""
      className={`${dimensions} rounded-full border-2 border-[var(--ww-border-strong)] bg-[var(--ww-surface-soft)] object-cover`}
    />
  );
}

export function RoleArtwork({ role, className = "" }: { role: WerewolfRole; className?: string }) {
  return (
    <img
      src={ROLE_ARTWORK[role]}
      alt={ROLE_LABELS[role]}
      className={`object-contain ${className}`}
    />
  );
}

interface TargetGridProps {
  players: WerewolfPlayer[];
  selfId: string;
  selected: string | null;
  disabledIds?: string[];
  // Only ever populated for the wolf viewer's own client (their private
  // teammates list) — never leaks anything to non-wolves, since it's just a
  // rendering hint drawn from data that client already has. Shown both at
  // night (own action grid) and during day voting, since wolves need to
  // recognize each other to coordinate protecting one another then too.
  teammateIds?: string[];
  onPick: (playerId: string) => void;
}

export function TargetGrid({ players, selfId, selected, disabledIds = [], teammateIds = [], onPick }: TargetGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {players.filter((player) => player.alive).map((player) => {
        const disabled = player.id === selfId || disabledIds.includes(player.id);
        const isTeammate = teammateIds.includes(player.id);
        const selectedClass = selected === player.id
          ? "border-[var(--ww-accent)] bg-[var(--ww-accent-soft)] ring-1 ring-[var(--ww-accent)]"
          : isTeammate
            ? "border-[var(--ww-danger)]/50 bg-[var(--ww-danger-soft)]"
            : "border-[var(--ww-border)] bg-[var(--ww-surface-soft)] hover:bg-[var(--ww-surface-soft-hover)]";

        return (
          <button
            key={player.id}
            disabled={disabled}
            onClick={() => onPick(player.id)}
            className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${selectedClass} disabled:cursor-not-allowed disabled:opacity-30`}
          >
            <span className="relative shrink-0">
              <PlayerAvatar player={player} size="sm" />
              {isTeammate && (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--ww-danger)] text-[9px]" title="Đồng đội Sói">
                  🐺
                </span>
              )}
            </span>
            <span className="min-w-0 truncate text-sm font-medium text-[var(--ww-text)]">{player.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PlayerStrip({ players, onLeave }: { players: WerewolfPlayer[]; onLeave: () => void }) {
  const livingCount = players.filter((player) => player.alive).length;

  return (
    <aside className="shrink-0 rounded-2xl border border-[var(--ww-border)] bg-[var(--ww-surface)] px-3 py-2.5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-ww-display text-sm font-bold text-[var(--ww-text)]">
          Ngôi làng <span className="ml-1 text-xs font-normal text-[var(--ww-text-faint)]">{livingCount}/{players.length} sống</span>
        </h3>
        <button onClick={onLeave} className="rounded-lg border border-[var(--ww-border)] px-2.5 py-1 text-[11px] text-[var(--ww-text-muted)] transition hover:text-[var(--ww-text)]">
          Rời phòng
        </button>
      </div>

      <div className="no-scrollbar -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-0.5">
        {players.map((player) => (
          <div
            key={player.id}
            title={playerStatus(player)}
            className={`flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 ${player.alive ? "bg-[var(--ww-surface-soft)]" : "opacity-45 grayscale"}`}
          >
            <span className="relative shrink-0">
              <PlayerAvatar player={player} size="sm" />
              {!player.connected && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-amber-400" />}
            </span>
            <span className="max-w-[88px] truncate text-xs font-medium text-[var(--ww-text)]">
              {player.name}{player.isHost ? " 👑" : ""}
            </span>
            {!player.alive && <span className="text-xs">{player.revealedRole ? ROLE_EMOJI[player.revealedRole] : "💀"}</span>}
          </div>
        ))}
      </div>
    </aside>
  );
}

function playerStatus(player: WerewolfPlayer): string {
  if (!player.connected) return "Mất kết nối";
  if (!player.alive) return "Đã chết";
  if (player.isHost) return "Chủ phòng";
  return "Còn sống";
}
