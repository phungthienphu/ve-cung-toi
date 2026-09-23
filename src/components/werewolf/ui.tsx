/* eslint-disable @next/next/no-img-element -- DiceBear returns generated SVG avatars. */
import { werewolfAvatarUrl } from "@/lib/werewolfAvatar";
import { ROLE_LABELS, type WerewolfPlayer } from "@shared/werewolfTypes";
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

export function PlayerSidebar({ players, onLeave }: { players: WerewolfPlayer[]; onLeave: () => void }) {
  const livingCount = players.filter((player) => player.alive).length;

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-3xl border border-[var(--ww-border)] bg-[var(--ww-surface)] p-4 shadow-xl backdrop-blur-md">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h3 className="font-ww-display font-bold text-[var(--ww-text)]">Ngôi làng</h3>
        <span className="text-xs text-[var(--ww-text-faint)]">{livingCount} sống</span>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {players.map((player) => (
          <div
            key={player.id}
            className={`flex items-center gap-2 rounded-xl p-2 ${player.alive ? "bg-[var(--ww-surface-soft)]" : "opacity-40 grayscale"}`}
          >
            <PlayerAvatar player={player} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[var(--ww-text)]">{player.name}</div>
              <div className="text-[11px] text-[var(--ww-text-faint)]">{playerStatus(player)}</div>
            </div>
            {player.revealedRole && (
              <RoleArtwork
                role={player.revealedRole}
                className="h-11 w-8 rounded-lg object-cover object-top"
              />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onLeave}
        className="mt-4 w-full shrink-0 rounded-xl border border-[var(--ww-border)] py-2 text-xs text-[var(--ww-text-muted)] transition hover:text-[var(--ww-text)]"
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
