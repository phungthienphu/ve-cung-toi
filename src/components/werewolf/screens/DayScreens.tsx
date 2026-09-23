import { ROLE_LABELS, type PrivateWerewolfState, type PublicWerewolfState, type WerewolfClientMessage, type WerewolfPlayer, type WerewolfRole } from "@shared/werewolfTypes";
import { GAME_CONTENT } from "../gameContent";
import { PlayerAvatar, RoleArtwork, TargetGrid } from "../ui";
import { DiscussionChat } from "../DiscussionChat";
import { SuspicionChart } from "../SuspicionChart";
import Link from "next/link";
import { NightSuspicionResult } from "../NightSuspicionResult";
import { ExecutionRiskSummary } from "../ExecutionRiskSummary";

export function DawnScreen({ state }: { state: PublicWerewolfState }) {
  const deathNames = state.nightDeaths.map((id) => playerName(id, state.players));

  return (
    <div>
      <div className="py-10 text-center">
      <div className="text-6xl">🌅</div>
      <h2 className="mt-4 text-2xl font-bold">{GAME_CONTENT.dawn.title(state.day)}</h2>
      <p className="mt-3 text-slate-300">
        {deathNames.length ? GAME_CONTENT.dawn.deaths(deathNames) : GAME_CONTENT.dawn.peaceful}
      </p>
      </div>
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

export function DiscussionScreen({ state, role, privateState, isHost, self, send }: DiscussionScreenProps) {
  const content = GAME_CONTENT.discussion;

  return (
    <div>
      <div className="text-center">
      <div className="text-5xl">🗣️</div>
      <h2 className="mt-4 text-2xl font-bold">{content.title}</h2>
      <p className="mt-2 text-slate-400">{content.description}</p>

      {role === "seer" && privateState?.seerHistory.length ? (
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-violet-400/20 bg-violet-500/10 p-4 text-left">
          <div className="font-semibold">{content.seerHistoryTitle}</div>
          {privateState.seerHistory.map((result) => (
            <div key={result.night} className="mt-2 text-sm">
              Đêm {result.night}: {playerName(result.targetId, state.players)} —{" "}
              <strong>{result.isWolf ? content.wolfResult : content.safeResult}</strong>
            </div>
          ))}
        </div>
      ) : null}

      </div>

      <div className="mt-6">
        <DiscussionChat
          entries={state.chat}
          selfId={self.id}
          canSend={self.alive}
          onSend={(text) => send({ type: "chat", text })}
        />
      </div>

      {state.lastNightSuspicion && (
        <div className="mt-5">
          <NightSuspicionResult data={state.lastNightSuspicion} players={state.players} />
        </div>
      )}

      {privateState && (
        <div className="mt-5">
          <SuspicionChart history={privateState.suspicionHistory} players={state.players} />
        </div>
      )}

      {isHost && (
        <button
          onClick={() => send({ type: "end_discussion" })}
          className="mt-5 w-full rounded-xl bg-violet-500 px-6 py-3 font-bold"
        >
          {content.endButton}
        </button>
      )}
    </div>
  );
}

interface VotingScreenProps {
  players: WerewolfPlayer[];
  self: WerewolfPlayer;
  selected: string | null;
  send: (message: WerewolfClientMessage) => void;
}

export function VotingScreen({ players, self, selected, send }: VotingScreenProps) {
  const content = GAME_CONTENT.voting;

  return (
    <div>
      <h2 className="text-center text-2xl font-bold">{content.title}</h2>
      <p className="mb-5 mt-1 text-center text-sm text-slate-400">{content.description}</p>
      {self.alive ? (
        <TargetGrid
          players={players}
          selfId={self.id}
          selected={selected}
          onPick={(targetId) => send({ type: "cast_vote", targetId })}
        />
      ) : (
        <p className="text-center text-slate-400">{content.deadMessage}</p>
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

  return (
    <div className="py-10 text-center">
      <div className="text-6xl">⚖️</div>
      <h2 className="mt-4 text-2xl font-bold">{GAME_CONTENT.voteResult.title}</h2>
      <p className="mt-3 text-slate-300">{result}</p>
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
      <header className={`rounded-2xl border p-6 text-center ${winner === "village" ? "border-amber-300/20 bg-amber-500/10" : "border-rose-400/20 bg-rose-950/40"}`}>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-300">Ván đấu kết thúc · {state.day} ngày</p>
        <h2 className="mt-3 text-3xl font-black">{GAME_CONTENT.gameEnd.title[winner]}</h2>
        <p className="mt-2 text-sm text-slate-300">{winningPlayers.map((player) => player.name).join(", ")} đã chiến thắng.</p>
      </header>

      <h3 className="mt-7 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Vai trò được hé lộ</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {state.players.map((player) => (
          <div key={player.id} className={`flex items-center gap-3 rounded-xl border p-3 ${winningPlayers.some((winnerPlayer) => winnerPlayer.id === player.id) ? "border-emerald-400/25 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}>
            <PlayerAvatar player={player} size="sm" />
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate font-medium">{player.name}</div>
              <div className="text-xs text-slate-400">{player.alive ? "Sống sót" : "Đã chết"}</div>
            </div>
            {player.revealedRole && (
              <div className="flex items-center gap-2">
                <RoleArtwork role={player.revealedRole} className="h-14 w-10 rounded object-cover object-top" />
                <span className="text-xs text-slate-300">{ROLE_LABELS[player.revealedRole]}</span>
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
        <Link href="/leaderboard?game=werewolf" className="rounded-xl border border-white/15 px-6 py-3 text-center font-semibold text-slate-200 hover:bg-white/5">
          Xem lịch sử trận
        </Link>
      {isHost && (
        <button
          onClick={() => send({ type: "play_again" })}
          className="rounded-xl bg-violet-500 px-8 py-3 font-bold"
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
    <section className="mt-7 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Diễn biến chính</h3>
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
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-xs text-slate-300">Ngày {event.day}</span>
              <span className="py-1 text-slate-300">{text}</span>
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
