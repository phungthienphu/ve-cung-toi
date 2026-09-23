import { ROLE_LABELS, type WerewolfPlayer } from "@shared/werewolfTypes";
import { PlayerAvatar, RoleArtwork } from "./ui";

interface DeathAnnouncementProps {
  players: WerewolfPlayer[];
  playerIds: string[];
  cause: "night" | "vote";
}

export function DeathAnnouncement({ players, playerIds, cause }: DeathAnnouncementProps) {
  const victims = playerIds
    .map((id) => players.find((player) => player.id === id))
    .filter((player): player is WerewolfPlayer => Boolean(player));

  if (victims.length === 0) return null;

  const title = cause === "night"
    ? victims.length > 1 ? "Đêm qua đã có nhiều tiếng hét…" : "Một người đã không qua khỏi đêm qua"
    : "Có lẽ thứ đáng sợ nhất,...không phải là những con sói trong đêm...";
  const description = cause === "night"
    ? "Bình minh lên, nhưng không còn thấy những gương mặt ấy."
    : "Sẽ có những oan hồn không thể siêu thoát,... và những người ở lại liệu có yên ổn..?";

  return (
    <section className="animate-death-banner relative overflow-hidden rounded-3xl border border-rose-300/25 bg-gradient-to-br from-slate-950 via-rose-950 to-slate-950 p-5 text-center shadow-2xl shadow-rose-950/60 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.18),transparent_55%)]" />
      <div className="relative">
        <div className="text-5xl drop-shadow-lg">☠️</div>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.24em] text-rose-300">Thông báo tử vong</p>
        <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">{title}</h2>

        <div className={`mx-auto mt-5 grid max-w-2xl gap-3 ${victims.length > 1 ? "sm:grid-cols-2" : "max-w-md"}`}>
          {victims.map((victim) => (
            <div key={victim.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-left backdrop-blur">
              <PlayerAvatar player={victim} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xl font-black text-white">{victim.name}</div>
                <div className="mt-1 text-sm text-rose-200">{cause === "night" ? "Đã chết trong đêm" : "Đã bị treo cổ"}</div>
              </div>
              {victim.revealedRole && (
                <div className="flex shrink-0 items-center gap-2">
                  <RoleArtwork role={victim.revealedRole} className="h-16 w-11 rounded-lg object-cover object-top" />
                  <span className="hidden text-xs font-semibold text-slate-300 sm:block">{ROLE_LABELS[victim.revealedRole]}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-slate-300">{description}</p>
      </div>
    </section>
  );
}

