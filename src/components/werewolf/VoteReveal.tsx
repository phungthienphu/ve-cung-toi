import type { WerewolfBallot, WerewolfPlayer, VoteResult } from "@shared/werewolfTypes";
import { PlayerAvatar } from "./ui";

interface VoteRevealProps {
  ballots: WerewolfBallot[];
  results: VoteResult[];
  players: WerewolfPlayer[];
}

// Voting is anonymous *while it's open* (no bandwagon on the first hand up),
// but once it closes everyone sees who voted for whom and why — that's what
// gives the table something to argue about and "pin" people on.
export function VoteReveal({ ballots, results, players }: VoteRevealProps) {
  const byId = new Map(players.map((player) => [player.id, player]));
  const abstainers = ballots.filter((ballot) => !ballot.targetId);
  if (ballots.length === 0) return null;

  return (
    <section className="mt-5 rounded-2xl border border-[var(--ww-danger)]/40 bg-[var(--ww-danger-soft)] p-4 text-left shadow-[0_0_24px_-8px_var(--ww-danger)]">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ww-danger)]">⚖️ Ai đã bầu ai?</p>

      <div className="mt-3 space-y-3">
        {results.map((result) => {
          const target = byId.get(result.playerId);
          if (!target) return null;
          const votes = ballots.filter((ballot) => ballot.targetId === result.playerId);
          return (
            <div key={result.playerId} className="rounded-xl bg-[var(--ww-surface-soft)] p-3">
              <div className="flex items-center gap-2">
                <PlayerAvatar player={target} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold text-[var(--ww-text)]">{target.name}</span>
                <span className="rounded-full bg-[var(--ww-danger)] px-2.5 py-0.5 text-xs font-black text-[var(--ww-accent-ink)]">{result.votes} phiếu</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {votes.map((ballot) => {
                  const voter = byId.get(ballot.voterId);
                  return (
                    <li key={ballot.voterId} className="flex items-start gap-2 text-sm">
                      {voter && <PlayerAvatar player={voter} size="sm" />}
                      <div className="min-w-0 flex-1 pt-0.5">
                        <span className="font-semibold text-[var(--ww-text)]">{voter?.name ?? "Ai đó"}</span>
                        {ballot.reason ? (
                          <span className="text-[var(--ww-text-muted)]"> — “{ballot.reason}”</span>
                        ) : (
                          <span className="text-[var(--ww-text-faint)]"> — không nêu lý do</span>
                        )}
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
            Không bầu ai: {abstainers.map((ballot) => byId.get(ballot.voterId)?.name ?? "?").join(", ")}
          </p>
        )}
      </div>
    </section>
  );
}
