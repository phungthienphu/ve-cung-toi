import { useState } from "react";
import { ROLE_LABELS, type PrivateWerewolfState, type PublicWerewolfState, type WerewolfClientMessage, type WerewolfPlayer, type WerewolfRole } from "@shared/werewolfTypes";
import { GAME_CONTENT } from "../gameContent";
import { PlayerAvatar, RoleArtwork, TargetGrid } from "../ui";
import { DiscussionChat } from "../DiscussionChat";
import { SuspicionChart } from "../SuspicionChart";
import Link from "next/link";
import { NightSuspicionResult } from "../NightSuspicionResult";
import { ExecutionRiskSummary } from "../ExecutionRiskSummary";
import { DeathAnnouncement } from "../DeathAnnouncement";

export function DawnScreen({ state }: { state: PublicWerewolfState }) {
  const deathNames = state.nightDeaths.map((id) => playerName(id, state.players));

  return (
    <div>
      {state.nightDeaths.length > 0 ? (
        <DeathAnnouncement players={state.players} playerIds={state.nightDeaths} cause="night" />
      ) : (
      <div className="py-10 text-center">
      <div className="text-6xl">🌅</div>
      <h2 className="mt-4 font-ww-display text-2xl font-bold text-[var(--ww-text)]">{GAME_CONTENT.dawn.title(state.day)}</h2>
      <p className="mt-3 text-[var(--ww-text-muted)]">
        {deathNames.length ? GAME_CONTENT.dawn.deaths(deathNames) : GAME_CONTENT.dawn.peaceful}
      </p>
      </div>
      )}
      {state.lastNightSuspicion && (
        <NightSuspicionResult data={state.lastNightSuspicion} players={state.players} />
      )}
    </div>
  );
}

interface DiscussionScreenProps {
  state: PublicWerewolfState;
  role: WerewolfRole | null;
  privateState: PrivateWerewolfState | null;
  isHost: boolean;
  self: WerewolfPlayer;
  send: (message: WerewolfClientMessage) => void;
}

type DiscussionTab = "chat" | "notebook";

export function DiscussionScreen({ state, role, privateState, isHost, self, send }: DiscussionScreenProps) {
  const content = GAME_CONTENT.discussion;
  const [tab, setTab] = useState<DiscussionTab>("chat");
  // Village-wide suspicion is public, high-stakes information — everyone
  // needs to see it without hunting for it, so it stays pinned above the
  // fold instead of hiding behind a tab. Only the *personal* notebook
  // (private seer history + this player's own suspicion log) is tabbed away,
  // since that's reference material people check occasionally, not every
  // discussion's headline.
  const hasPersonalNotebook = Boolean((role === "seer" && privateState?.seerHistory.length) || privateState);

  return (
    // Fixed height instead of letting chat + suspicion result + suspicion
    // chart stack indefinitely — that stacking is exactly what forced the
    // whole page to scroll before. Only one tab's content is mounted-visible
    // at a time, and each tab manages its own internal scroll.
    <div className="flex h-[70vh] min-h-[420px] flex-col md:h-full">
      <div className="shrink-0 text-center">
        <h2 className="font-ww-display text-2xl font-bold text-[var(--ww-text)]">{content.title}</h2>
        <p className="mt-1 text-sm text-[var(--ww-text-muted)]">{content.description}</p>
      </div>

      {state.lastNightSuspicion && (
        <div className="mt-4 max-h-40 shrink-0 overflow-y-auto">
          <NightSuspicionResult data={state.lastNightSuspicion} players={state.players} compact />
        </div>
      )}

      {hasPersonalNotebook && (
        <div className="mt-4 flex shrink-0 justify-center gap-2">
          <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>
            💬 Thảo luận
          </TabButton>
          <TabButton active={tab === "notebook"} onClick={() => setTab("notebook")}>
            📓 Ghi chú riêng
          </TabButton>
        </div>
      )}

      <div className="mt-4 min-h-0 flex-1 overflow-hidden">
        {tab === "chat" || !hasPersonalNotebook ? (
          <DiscussionChat
            entries={state.chat}
            selfId={self.id}
            canSend={self.alive}
            onSend={(text) => send({ type: "chat", text })}
          />
        ) : (
          <div className="h-full space-y-4 overflow-y-auto pr-1">
            {role === "seer" && privateState?.seerHistory.length ? (
              <div className="rounded-2xl border border-[var(--ww-border-strong)] bg-[var(--ww-accent-soft)] p-4 text-left">
                <div className="font-semibold text-[var(--ww-text)]">{content.seerHistoryTitle}</div>
                {privateState.seerHistory.map((result) => (
                  <div key={result.night} className="mt-2 text-sm text-[var(--ww-text-muted)]">
                    Đêm {result.night}: {playerName(result.targetId, state.players)} —{" "}
                    <strong className="text-[var(--ww-text)]">{result.isWolf ? content.wolfResult : content.safeResult}</strong>
                  </div>
                ))}
              </div>
            ) : null}

            {privateState && <SuspicionChart history={privateState.suspicionHistory} players={state.players} />}
          </div>
        )}
      </div>

      {isHost && (
        <button
          onClick={() => send({ type: "end_discussion" })}
          className="mt-4 w-full shrink-0 rounded-xl bg-[var(--ww-accent-strong)] px-6 py-3 font-bold text-[var(--ww-accent-ink)] transition hover:opacity-90"
        >
          {content.endButton}
        </button>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
        active
          ? "border-[var(--ww-accent)] bg-[var(--ww-accent-soft)] text-[var(--ww-accent)]"
          : "border-[var(--ww-border)] text-[var(--ww-text-muted)] hover:text-[var(--ww-text)]"
      }`}
    >
      {children}
    </button>
  );
}

interface VotingScreenProps {
  players: WerewolfPlayer[];
  self: WerewolfPlayer;
  selected: string | null;
  teammateIds?: string[];
  send: (message: WerewolfClientMessage) => void;
}

export function VotingScreen({ players, self, selected, teammateIds, send }: VotingScreenProps) {
  const content = GAME_CONTENT.voting;

  return (
    <div>
      <h2 className="text-center font-ww-display text-2xl font-bold text-[var(--ww-text)]">{content.title}</h2>
      <p className="mb-5 mt-1 text-center text-sm text-[var(--ww-text-muted)]">{content.description}</p>
      {self.alive ? (
        <TargetGrid
          players={players}
          selfId={self.id}
          selected={selected}
          teammateIds={teammateIds}
          onPick={(targetId) => send({ type: "cast_vote", targetId })}
        />
      ) : (
        <p className="text-center text-[var(--ww-text-muted)]">{content.deadMessage}</p>
      )}
    </div>
  );
}

export function VoteResultScreen({ state }: { state: PublicWerewolfState }) {
  const top = state.lastVoteResult[0];
  const tied = top && state.lastVoteResult.filter((result) => result.votes === top.votes).length > 1;
  let result: string = GAME_CONTENT.voteResult.noVotes;
  if (top && tied) result = GAME_CONTENT.voteResult.tied;
  if (top && !tied) result = GAME_CONTENT.voteResult.eliminated(playerName(top.playerId, state.players), top.votes);

  if (top && !tied) {
    return (
      <div>
        <DeathAnnouncement players={state.players} playerIds={[top.playerId]} cause="vote" />
        <p className="mt-4 text-center text-sm text-[var(--ww-text-muted)]">{result}</p>
      </div>
    );
  }

  return (
    <div className="py-10 text-center">
      <div className="text-6xl">⚖️</div>
      <h2 className="mt-4 font-ww-display text-2xl font-bold text-[var(--ww-text)]">{GAME_CONTENT.voteResult.title}</h2>
      <p className="mt-3 text-[var(--ww-text-muted)]">{result}</p>
    </div>
  );
}

export function GameEndScreen({ state, isHost, send }: { state: PublicWerewolfState; isHost: boolean; send: (message: WerewolfClientMessage) => void }) {
  const winner = state.winner ?? "wolves";
  const winningPlayers = state.players.filter((player) => {
    const isWolf = player.revealedRole === "wolf";
    return winner === "wolves" ? isWolf : !isWolf;
  });

  return (
    <div>
      <header className={`rounded-3xl border p-6 text-center ${winner === "village" ? "border-[var(--ww-warn)]/30 bg-[var(--ww-warn-soft)]" : "border-[var(--ww-danger)]/30 bg-[var(--ww-danger-soft)]"}`}>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--ww-text-muted)]">Ván đấu kết thúc · {state.day} ngày</p>
        <h2 className="mt-3 font-ww-display text-3xl font-black text-[var(--ww-text)]">{GAME_CONTENT.gameEnd.title[winner]}</h2>
        <p className="mt-2 text-sm text-[var(--ww-text-muted)]">{winningPlayers.map((player) => player.name).join(", ")} đã chiến thắng.</p>
      </header>

      <h3 className="mt-7 text-sm font-bold uppercase tracking-[0.18em] text-[var(--ww-text-faint)]">Vai trò được hé lộ</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {state.players.map((player) => (
          <div key={player.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${winningPlayers.some((winnerPlayer) => winnerPlayer.id === player.id) ? "border-[var(--ww-safe)]/30 bg-[var(--ww-safe)]/10" : "border-[var(--ww-border)] bg-[var(--ww-surface-soft)]"}`}>
            <PlayerAvatar player={player} size="sm" />
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate font-medium text-[var(--ww-text)]">{player.name}</div>
              <div className="text-xs text-[var(--ww-text-muted)]">{player.alive ? "Sống sót" : "Đã chết"}</div>
            </div>
            {player.revealedRole && (
              <div className="flex items-center gap-2">
                <RoleArtwork role={player.revealedRole} className="h-14 w-10 rounded-lg object-cover object-top" />
                <span className="text-xs text-[var(--ww-text-muted)]">{ROLE_LABELS[player.revealedRole]}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <GameTimeline state={state} />

      {state.suspicionStats.length > 0 && (
        <div className="mt-7">
          <ExecutionRiskSummary stats={state.suspicionStats} players={state.players} />
        </div>
      )}

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Link href="/leaderboard?game=werewolf" className="rounded-xl border border-[var(--ww-border)] px-6 py-3 text-center font-semibold text-[var(--ww-text)] transition hover:bg-[var(--ww-surface-soft)]">
          Xem lịch sử trận
        </Link>
      {isHost && (
        <button
          onClick={() => send({ type: "play_again" })}
          className="rounded-xl bg-[var(--ww-accent-strong)] px-8 py-3 font-bold text-[var(--ww-accent-ink)] transition hover:opacity-90"
        >
          {GAME_CONTENT.gameEnd.playAgainButton}
        </button>
      )}
      </div>
    </div>
  );
}

function GameTimeline({ state }: { state: PublicWerewolfState }) {
  return (
    <section className="mt-7 rounded-2xl border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] p-4">
      <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--ww-text-faint)]">Diễn biến chính</h3>
      <div className="mt-4 space-y-3">
        {state.events.map((event) => {
          const names = event.playerIds.map((id) => playerName(id, state.players));
          const text = event.type === "peaceful_night"
            ? "Không có ai chết trong đêm."
            : event.type === "night_death"
              ? `${names.join(", ")} đã chết trong đêm.`
              : `${names.join(", ")} bị ngôi làng trục xuất.`;
          return (
            <div key={event.id} className="flex gap-3 text-sm">
              <span className="shrink-0 rounded-full bg-[var(--ww-surface-soft-hover)] px-2 py-1 text-xs text-[var(--ww-text-muted)]">Ngày {event.day}</span>
              <span className="py-1 text-[var(--ww-text-muted)]">{text}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function playerName(playerId: string, players: WerewolfPlayer[]): string {
  return players.find((player) => player.id === playerId)?.name ?? "Một người chơi";
}
