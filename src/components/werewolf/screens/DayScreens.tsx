import { useEffect, useRef, useState } from "react";
import { MAX_VOTE_REASON_LENGTH, ROLE_LABELS, type PrivateWerewolfState, type PublicWerewolfState, type WerewolfClientMessage, type WerewolfPlayer, type WerewolfRole } from "@shared/werewolfTypes";
import { GAME_CONTENT } from "../gameContent";
import { PlayerAvatar, RoleArtwork, TargetGrid } from "../ui";
import { DiscussionChat } from "../DiscussionChat";
import { SuspicionChart } from "../SuspicionChart";
import Link from "next/link";
import { NightSuspicionResult } from "../NightSuspicionResult";
import { ExecutionRiskSummary } from "../ExecutionRiskSummary";
import { DeathAnnouncement } from "../DeathAnnouncement";
import { VoteReveal } from "../VoteReveal";

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

  const notebook = (
    <PersonalNotebook state={state} role={role} privateState={privateState} />
  );

  // Height is fixed on mobile (the page itself scrolls there) and flexed to
  // fill the shell on md+, where the shell is exactly one viewport tall. The
  // whole chain below is plain flex + min-h-0 rather than h-full percentages,
  // because percentage heights silently collapse to "auto" when any ancestor
  // is only flex/grid-sized — that's what let the chat grow forever and
  // push the page instead of scrolling inside itself.
  return (
    <div className="flex h-[88dvh] min-h-[480px] flex-col md:h-auto md:min-h-0 md:flex-1">
      <div className="shrink-0 text-center">
        <h2 className="font-ww-display text-xl font-bold text-[var(--ww-text)] sm:text-2xl">{content.title}</h2>
        <p className="mt-1 hidden text-sm text-[var(--ww-text-muted)] sm:block">{content.description}</p>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Below lg there's no room for a side column: the village-wide
              suspicion result stays pinned (it's the headline everyone must
              see) and the private notebook moves behind a tab. */}
          {state.lastNightSuspicion && (
            <div className="mb-3 max-h-32 shrink-0 overflow-y-auto lg:hidden">
              <NightSuspicionResult data={state.lastNightSuspicion} players={state.players} compact />
            </div>
          )}

          {privateState && (
            <div className="mb-3 flex shrink-0 justify-center gap-2 lg:hidden">
              <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>💬 Thảo luận</TabButton>
              <TabButton active={tab === "notebook"} onClick={() => setTab("notebook")}>📓 Ghi chú riêng</TabButton>
            </div>
          )}

          <div className={`min-h-0 flex-1 flex-col ${tab === "chat" ? "flex" : "hidden lg:flex"}`}>
            <DiscussionChat
              entries={state.chat}
              selfId={self.id}
              canSend={self.alive}
              onSend={(text) => send({ type: "chat", text })}
            />
          </div>

          {tab === "notebook" && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 lg:hidden">{notebook}</div>
          )}
        </div>

        <aside className="hidden min-h-0 w-80 shrink-0 space-y-4 overflow-y-auto pr-1 lg:block">
          {state.lastNightSuspicion && <NightSuspicionResult data={state.lastNightSuspicion} players={state.players} />}
          {notebook}
        </aside>
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

function PersonalNotebook({ state, role, privateState }: { state: PublicWerewolfState; role: WerewolfRole | null; privateState: PrivateWerewolfState | null }) {
  const content = GAME_CONTENT.discussion;
  return (
    <>
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
    </>
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
  initialReason: string;
  votedIds: string[];
  isHost: boolean;
  teammateIds?: string[];
  send: (message: WerewolfClientMessage) => void;
}

export function VotingScreen({ players, self, selected, initialReason, votedIds, isHost, teammateIds, send }: VotingScreenProps) {
  const content = GAME_CONTENT.voting;
  const [reason, setReason] = useState(initialReason);
  const reasonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveCount = players.filter((player) => player.alive).length;
  // What the player last explicitly confirmed. Picking a name already records
  // the vote server-side (so a forgotten button never costs a ballot), and the
  // reason autosaves — this button is the visible "chốt phiếu" moment.
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const currentKey = `${selected}|${reason}`;
  const confirmed = selected !== null && confirmedKey === currentKey;
  const selectedName = players.find((player) => player.id === selected)?.name;

  const confirm = () => {
    if (!selected) return;
    if (reasonTimer.current) clearTimeout(reasonTimer.current);
    send({ type: "cast_vote", targetId: selected, reason });
    setConfirmedKey(currentKey);
  };

  useEffect(() => () => {
    if (reasonTimer.current) clearTimeout(reasonTimer.current);
  }, []);

  // Clicking your current pick again withdraws it (= bỏ phiếu trắng).
  const pick = (targetId: string) => send({ type: "cast_vote", targetId: targetId === selected ? null : targetId, reason });

  // Editing the reason after picking re-sends the same ballot (debounced) so
  // the server always holds the latest text without a separate "save" step.
  const editReason = (value: string) => {
    setReason(value);
    if (!selected) return;
    if (reasonTimer.current) clearTimeout(reasonTimer.current);
    reasonTimer.current = setTimeout(() => send({ type: "cast_vote", targetId: selected, reason: value }), 400);
  };

  return (
    <div>
      {isHost && (
        <button
          onClick={() => send({ type: "back_to_discussion" })}
          className="mb-3 rounded-lg border border-[var(--ww-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ww-text-muted)] transition hover:text-[var(--ww-text)]"
        >
          ← Quay lại thảo luận
        </button>
      )}
      <h2 className="text-center font-ww-display text-2xl font-bold text-[var(--ww-text)]">{content.title}</h2>
      <p className="mt-1 text-center text-sm text-[var(--ww-text-muted)]">{content.description}</p>
      <p className="mb-5 mt-1 text-center text-xs text-[var(--ww-text-faint)]">
        Đã bỏ phiếu {votedIds.length}/{aliveCount} · Phiếu bầu và lý do sẽ được công khai khi kết thúc
      </p>
      {self.alive ? (
        <>
          <TargetGrid
            players={players}
            selfId={self.id}
            selected={selected}
            teammateIds={teammateIds}
            onPick={pick}
          />
          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ww-text-faint)]">Lý do (không bắt buộc)</span>
            <input
              value={reason}
              onChange={(event) => editReason(event.target.value)}
              maxLength={MAX_VOTE_REASON_LENGTH}
              placeholder={selected ? "Vì sao bạn bầu người này? Cả làng sẽ thấy…" : "Chọn một người trước, rồi ghi lý do nếu muốn"}
              onKeyDown={(event) => {
                if (event.key === "Enter") confirm();
              }}
              className="mt-1 w-full rounded-xl border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] px-3 py-2.5 text-sm text-[var(--ww-text)] outline-none placeholder:text-[var(--ww-text-faint)] focus:border-[var(--ww-accent)]"
            />
            <span className="mt-1 block text-right text-[11px] text-[var(--ww-text-faint)]">{reason.length}/{MAX_VOTE_REASON_LENGTH}</span>
          </label>
          <button
            onClick={confirm}
            disabled={!selected || confirmed}
            className="mt-3 w-full rounded-xl bg-[var(--ww-accent-strong)] px-6 py-3 font-bold text-[var(--ww-accent-ink)] transition hover:opacity-90 disabled:opacity-50"
          >
            {!selected ? "Chọn một người để bỏ phiếu" : confirmed ? `✓ Đã gửi phiếu bầu ${selectedName ?? ""}` : `Xác nhận bầu ${selectedName ?? ""}`}
          </button>
          <p className="mt-2 text-center text-xs text-[var(--ww-text-faint)]">
            {selected
              ? "Phiếu đã được ghi nhận — bạn vẫn đổi được đến hết giờ. Bấm lại tên đã chọn để rút phiếu."
              : "Không chọn ai = bỏ phiếu trắng."}
          </p>
        </>
      ) : (
        <p className="text-center text-[var(--ww-text-muted)]">{content.deadMessage}</p>
      )}
    </div>
  );
}

function ContinueBar({ state, self, send }: { state: PublicWerewolfState; self: WerewolfPlayer; send: (message: WerewolfClientMessage) => void }) {
  const voters = state.players.filter((player) => player.alive && player.connected);
  const ready = voters.filter((player) => state.resultAckedIds.includes(player.id)).length;
  const acked = state.resultAckedIds.includes(self.id);

  return (
    <div className="mt-5 flex flex-col items-center gap-2">
      {self.alive && (
        <button
          disabled={acked}
          onClick={() => send({ type: "ack_result" })}
          className="w-full rounded-xl bg-[var(--ww-accent-strong)] px-6 py-3 font-bold text-[var(--ww-accent-ink)] transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          {acked ? "✓ Đã xác nhận — chờ mọi người" : "Đã đọc xong, tiếp tục"}
        </button>
      )}
      <p className="text-xs text-[var(--ww-text-faint)]">
        {ready}/{voters.length} người sẵn sàng · tự chuyển khi hết giờ hoặc khi mọi người xác nhận
      </p>
    </div>
  );
}

export function VoteResultScreen({ state, self, send }: { state: PublicWerewolfState; self: WerewolfPlayer; send: (message: WerewolfClientMessage) => void }) {
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
        <VoteReveal ballots={state.lastVotes} results={state.lastVoteResult} players={state.players} selfId={self.id} eliminatedId={top.playerId} />
        <ContinueBar state={state} self={self} send={send} />
      </div>
    );
  }

  return (
    <div className="py-10 text-center">
      <div className="text-6xl">⚖️</div>
      <h2 className="mt-4 font-ww-display text-2xl font-bold text-[var(--ww-text)]">{GAME_CONTENT.voteResult.title}</h2>
      <p className="mt-3 text-[var(--ww-text-muted)]">{result}</p>
      <div className="text-left">
        <VoteReveal ballots={state.lastVotes} results={state.lastVoteResult} players={state.players} selfId={self.id} eliminatedId={null} />
      </div>
      <ContinueBar state={state} self={self} send={send} />
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
              : `${names.join(", ")} bị ngôi làng xử bắn.`;
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
