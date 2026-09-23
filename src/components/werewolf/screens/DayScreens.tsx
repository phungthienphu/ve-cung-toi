import { ROLE_EMOJI, ROLE_LABELS, type PrivateWerewolfState, type PublicWerewolfState, type WerewolfClientMessage, type WerewolfPlayer, type WerewolfRole } from "@shared/werewolfTypes";
import { GAME_CONTENT } from "../gameContent";
import { PlayerAvatar, TargetGrid } from "../ui";

export function DawnScreen({ state }: { state: PublicWerewolfState }) {
  const deathNames = state.nightDeaths.map((id) => playerName(id, state.players));

  return (
    <div className="py-12 text-center">
      <div className="text-6xl">🌅</div>
      <h2 className="mt-4 text-2xl font-bold">{GAME_CONTENT.dawn.title(state.day)}</h2>
      <p className="mt-3 text-slate-300">
        {deathNames.length ? GAME_CONTENT.dawn.deaths(deathNames) : GAME_CONTENT.dawn.peaceful}
      </p>
    </div>
  );
}

interface DiscussionScreenProps {
  state: PublicWerewolfState;
  role: WerewolfRole | null;
  privateState: PrivateWerewolfState | null;
  isHost: boolean;
  send: (message: WerewolfClientMessage) => void;
}

export function DiscussionScreen({ state, role, privateState, isHost, send }: DiscussionScreenProps) {
  const content = GAME_CONTENT.discussion;

  return (
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

      {isHost && (
        <button
          onClick={() => send({ type: "end_discussion" })}
          className="mt-8 rounded-xl bg-violet-500 px-6 py-3 font-bold"
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

  return (
    <div className="text-center">
      <div className="text-7xl">{winner === "village" ? "🏘️" : "🐺"}</div>
      <h2 className="mt-4 text-3xl font-bold">{GAME_CONTENT.gameEnd.title[winner]}</h2>
      <div className="mt-7 grid gap-2 sm:grid-cols-2">
        {state.players.map((player) => (
          <div key={player.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <PlayerAvatar player={player} size="sm" />
            <span className="flex-1 text-left">{player.name}</span>
            <span>
              {player.revealedRole ? `${ROLE_EMOJI[player.revealedRole]} ${ROLE_LABELS[player.revealedRole]}` : ""}
            </span>
          </div>
        ))}
      </div>
      {isHost && (
        <button
          onClick={() => send({ type: "play_again" })}
          className="mt-7 rounded-xl bg-violet-500 px-8 py-3 font-bold"
        >
          {GAME_CONTENT.gameEnd.playAgainButton}
        </button>
      )}
    </div>
  );
}

function playerName(playerId: string, players: WerewolfPlayer[]): string {
  return players.find((player) => player.id === playerId)?.name ?? "Một người chơi";
}
