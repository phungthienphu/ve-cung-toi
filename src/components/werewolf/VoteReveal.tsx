import type { WerewolfBallot, WerewolfPlayer, VoteResult } from "@shared/werewolfTypes";
import { PlayerAvatar } from "./ui";

interface VoteRevealProps {
  ballots: WerewolfBallot[];
  results: VoteResult[];
  players: WerewolfPlayer[];
  selfId: string;
  eliminatedId: string | null;
}

// Voting is anonymous *while it's open* (no bandwagon on the first hand up),
// but once it closes everyone sees who voted for whom and why — that's what
// gives the table something to argue about and "pin" people on. Targets and
// voters are marked differently on purpose so the eye can tell "who took the
// heat" from "who pointed the finger" at a glance.
export function VoteReveal({ ballots, results, players, selfId, eliminatedId }: VoteRevealProps) {
  const byId = new Map(players.map((player) => [player.id, player]));
  const abstainers = ballots.filter((ballot) => !ballot.targetId);
  if (ballots.length === 0) return null;

  return (
    <section className="mt-5 rounded-md border border-[var(--ww-danger)]/40 bg-[var(--ww-danger-soft)] p-4 text-left shadow-[0_0_24px_-8px_var(--ww-danger)]">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ww-danger)]">⚖️ Ai đã bầu ai?</p>

      <div className="mt-3 space-y-3">
        {results.map((result) => {
          const target = byId.get(result.playerId);
          if (!target) return null;
          const executed = result.playerId === eliminatedId;
          const votes = ballots.filter((ballot) => ballot.targetId === result.playerId);
          return (
            <div
              key={result.playerId}
              className={`overflow-hidden rounded-md border-l-4 border-[var(--ww-danger)] ${executed ? "bg-[var(--ww-danger)]/15 ring-1 ring-[var(--ww-danger)]/50" : "bg-[var(--ww-surface-soft)]"}`}
            >
              <div className="flex items-center gap-2.5 bg-[var(--ww-danger)]/10 px-3 py-2">
                <span className="rounded-full ring-2 ring-[var(--ww-danger)]">
                  <PlayerAvatar player={target} size="sm" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-[var(--ww-text)]">
                    🎯 {target.name}{target.id === selfId ? " (Bạn)" : ""}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ww-danger)]">
                    {executed ? "☠️ Bị xử bắn" : "Bị nhiều người chỉ mặt"}
                  </div>
                </div>
                <span className="rounded-full bg-[var(--ww-danger)] px-2.5 py-1 text-xs font-black text-[var(--ww-accent-ink)]">{result.votes} phiếu</span>
              </div>

              <ul className="space-y-2 px-3 py-2.5">
                {votes.map((ballot) => {
                  const voter = byId.get(ballot.voterId);
                  const isSelf = ballot.voterId === selfId;
                  return (
                    <li key={ballot.voterId} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 shrink-0 text-xs" aria-hidden>🗳️</span>
                      {voter && <PlayerAvatar player={voter} size="sm" />}
                      <div className="min-w-0 flex-1">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${isSelf ? "bg-[var(--ww-accent)] text-[var(--ww-accent-ink)]" : "bg-[var(--ww-accent-soft)] text-[var(--ww-accent)]"}`}>
                          {voter?.name ?? "Ai đó"}{isSelf ? " · Bạn" : ""}
                        </span>
                        <p className={`mt-1 rounded-md border-l-2 px-2 py-1 text-[13px] ${ballot.reason ? "border-[var(--ww-accent)] bg-[var(--ww-surface-soft)] italic text-[var(--ww-text)]" : "border-transparent text-[var(--ww-text-faint)]"}`}>
                          {ballot.reason ? `“${ballot.reason}”` : "không nêu lý do"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {abstainers.length > 0 && (
          <p className="text-xs text-[var(--ww-text-faint)]">
            🤐 Không bầu ai: {abstainers.map((ballot) => byId.get(ballot.voterId)?.name ?? "?").join(", ")}
          </p>
        )}
      </div>
    </section>
  );
}
