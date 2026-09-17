"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fireworks } from "@/lib/confetti";
import {
  isCommentaryMuted,
  playClick,
  playClockTick,
  setCommentaryMuted,
  startCrowdMurmur,
  startSoccerBgMusic,
  stopCrowdMurmur,
  stopSoccerBgMusic,
} from "@/lib/sound";
import { useSoccerRoom } from "@/lib/useSoccerRoom";
import {
  SOCCER_BOT_DIFFICULTIES,
  SOCCER_BOT_DIFFICULTY_LABELS,
  SOCCER_TEAM_SIZES,
  type SoccerPlayer,
  type SoccerTeam,
} from "@shared/soccerTypes";
import SoccerCanvas from "./SoccerCanvas";

interface Props {
  roomId: string;
  playerId: string;
  name: string;
}

/** A simple, made-up-for-this-game "man of the match" score — not a stat a
 * real broadcast would use, but weights the numbers we actually track
 * (goals matter most, then winning the ball back, then just getting shots
 * off; racking up fouls counts against you) into one sortable number. */
function mvpScore(p: SoccerPlayer): number {
  return p.goals * 4 + p.tacklesWon * 1.5 + p.shots * 0.3 - p.fouls * 1;
}

export default function SoccerGameRoom({ roomId, playerId, name }: Props) {
  const router = useRouter();
  const { state, connected, kicked, send } = useSoccerRoom(roomId, playerId, name);

  useEffect(() => {
    if (kicked) router.push("/soccer");
  }, [kicked, router]);

  // The server stops ticking the instant a goal ends the match, and cutting
  // straight from the live canvas to the results screen the moment status
  // flips to "ended" read as the game just seizing up — same fix tank's
  // TankGameRoom got: hold on the (frozen) canvas for a beat with a banner
  // over it first, then cut to results.
  const [showEndedScreen, setShowEndedScreen] = useState(false);
  // Starts unmuted; the real value only exists in localStorage, which isn't
  // readable during server rendering, so it's fetched once after mount.
  const [blvMuted, setBlvMuted] = useState(false);
  useEffect(() => {
    setBlvMuted(isCommentaryMuted());
  }, []);
  useEffect(() => {
    if (state?.status !== "ended") {
      setShowEndedScreen(false);
      return;
    }
    const t = setTimeout(() => setShowEndedScreen(true), 1800);
    return () => clearTimeout(t);
  }, [state?.status]);

  // In-match background track — only while a round is actually being
  // played, same pattern as tank's TankGameRoom. Stopped on unmount too, so
  // leaving the room mid-match doesn't leave it playing in the background.
  useEffect(() => {
    if (state?.status === "playing") startSoccerBgMusic();
    else stopSoccerBgMusic();
    return () => stopSoccerBgMusic();
  }, [state?.status]);

  // Ambient crowd murmur — runs the whole match regardless of whether a
  // real bg-music file exists yet (see startSoccerBgMusic's doc), since a
  // real match has crowd noise independent of any music playing over it.
  useEffect(() => {
    if (state?.status === "playing") startCrowdMurmur();
    else stopCrowdMurmur();
    return () => stopCrowdMurmur();
  }, [state?.status]);

  // Urgent countdown tick once per whole second while under 30s remain —
  // tracks the last second it already played so this doesn't refire every
  // ~65ms tick broadcast, just once as each second boundary is crossed.
  const tickPlayedSecondRef = useRef<number | null>(null);
  useEffect(() => {
    if (!state || state.status !== "playing" || typeof state.matchEndsAt !== "number") {
      tickPlayedSecondRef.current = null;
      return;
    }
    const remainingMs = Math.max(0, state.matchEndsAt - state.serverNow);
    if (remainingMs <= 0 || remainingMs > 30000) {
      tickPlayedSecondRef.current = null;
      return;
    }
    const wholeSecond = Math.ceil(remainingMs / 1000);
    if (tickPlayedSecondRef.current === wholeSecond) return;
    tickPlayedSecondRef.current = wholeSecond;
    playClockTick();
  }, [state?.status, state?.matchEndsAt, state?.serverNow]);

  // Celebratory burst on the match-end screen — the same big fireworks()
  // tank/draw-guess use, guarded so it only fires once per match end.
  const fireworksPlayedRef = useRef(false);
  useEffect(() => {
    if (state?.status !== "ended") {
      fireworksPlayedRef.current = false;
      return;
    }
    if (fireworksPlayedRef.current) return;
    fireworksPlayedRef.current = true;
    fireworks();
  }, [state?.status]);

  if (!state) {
    return (
      <div className="flex min-h-app items-center justify-center text-slate-400">
        {connected ? "Đang tải phòng..." : "Đang kết nối..."}
      </div>
    );
  }

  const self = state.players.find((p) => p.id === playerId);
  const isHost = state.hostId === playerId;

  function handleLeave() {
    if (!confirm("Rời khỏi phòng?")) return;
    playClick();
    send({ type: "leave_room" });
    router.push("/soccer");
  }

  if (state.status === "lobby") {
    const teamA = state.players.filter((p) => p.connected && p.team === "A");
    const teamB = state.players.filter((p) => p.connected && p.team === "B");
    const humanCount = state.players.filter((p) => p.connected && !p.isBot).length;
    const canStart = state.botFillEnabled ? humanCount > 0 : teamA.length === state.teamSize && teamB.length === state.teamSize;

    function chooseTeam(team: SoccerTeam) {
      playClick();
      send({ type: "choose_team", team });
    }

    return (
      <main className="flex min-h-app items-center justify-center bg-soccer-scene px-4 py-8">
        <div className="w-full max-w-2xl rounded-xl border border-cream-200 bg-white p-8 shadow-xl">
          <div className="mb-1 flex items-center justify-between">
            <h1 className="text-xl font-bold text-ink">Phòng chờ bóng đá</h1>
            <span className="font-mono text-sm tracking-wider text-ink/40">{roomId}</span>
          </div>
          <p className="mb-6 text-sm text-ink/60">Chọn đội, đợi đủ người rồi chủ phòng bấm bắt đầu.</p>

          {isHost && (
            <div className="mb-6">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink/50">Thể thức</label>
              <div className="flex gap-2">
                {SOCCER_TEAM_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => send({ type: "set_team_size", teamSize: size })}
                    className={`rounded-lg border-2 px-3.5 py-2 text-sm font-semibold transition ${
                      state.teamSize === size ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-cream-200 text-ink/60 hover:border-emerald-300"
                    }`}
                  >
                    {size} vs {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isHost && (
            <div className="mb-6">
              <label className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink/50">
                <input
                  type="checkbox"
                  checked={state.botFillEnabled}
                  onChange={(e) => send({ type: "set_bot_fill", enabled: e.target.checked, difficulty: state.botDifficulty })}
                  className="h-3.5 w-3.5"
                />
                AI lấp chỗ trống
              </label>
              {state.botFillEnabled && (
                <div className="flex gap-2">
                  {SOCCER_BOT_DIFFICULTIES.map((diff) => (
                    <button
                      key={diff}
                      onClick={() => send({ type: "set_bot_fill", enabled: true, difficulty: diff })}
                      className={`rounded-lg border-2 px-3.5 py-2 text-sm font-semibold transition ${
                        state.botDifficulty === diff ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-cream-200 text-ink/60 hover:border-emerald-300"
                      }`}
                    >
                      {SOCCER_BOT_DIFFICULTY_LABELS[diff]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-blue-700">Đội Xanh ({teamA.length}/{state.teamSize})</span>
                {self?.team !== "A" && teamA.length < state.teamSize && (
                  <button onClick={() => chooseTeam("A")} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700">
                    Vào đội
                  </button>
                )}
              </div>
              <ul className="space-y-1 text-sm text-ink/70">
                {teamA.map((p) => (
                  <li key={p.id}>{p.name}{p.id === playerId && " (bạn)"}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-red-700">Đội Đỏ ({teamB.length}/{state.teamSize})</span>
                {self?.team !== "B" && teamB.length < state.teamSize && (
                  <button onClick={() => chooseTeam("B")} className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700">
                    Vào đội
                  </button>
                )}
              </div>
              <ul className="space-y-1 text-sm text-ink/70">
                {teamB.map((p) => (
                  <li key={p.id}>{p.name}{p.id === playerId && " (bạn)"}</li>
                ))}
              </ul>
            </div>
          </div>

          {isHost ? (
            <button
              onClick={() => {
                playClick();
                send({ type: "start_game" });
              }}
              disabled={!canStart}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {canStart
                ? "Bắt đầu trận đấu"
                : state.botFillEnabled
                  ? "Cần ít nhất 1 người chơi thật"
                  : `Cần đủ ${state.teamSize} vs ${state.teamSize}`}
            </button>
          ) : (
            <p className="text-center text-sm text-ink/50">Đang đợi chủ phòng bắt đầu...</p>
          )}

          <button onClick={handleLeave} className="mt-4 block w-full text-center text-xs font-medium text-ink/40 hover:text-ink/70">
            Rời phòng
          </button>
        </div>
      </main>
    );
  }

  if (state.status === "ended" && showEndedScreen) {
    const winnerLabel = state.winningTeam === "A" ? "Đội Xanh thắng!" : state.winningTeam === "B" ? "Đội Đỏ thắng!" : "Hòa!";
    const ranking = [...state.players].sort((a, b) => mvpScore(b) - mvpScore(a));
    const mvp = ranking.length > 0 && mvpScore(ranking[0]) > 0 ? ranking[0] : null;
    return (
      <main className="flex min-h-app items-center justify-center bg-soccer-scene px-4 py-8">
        <div className="w-full max-w-2xl rounded-xl border border-cream-200 bg-white p-8 text-center shadow-xl">
          <h1 className="mb-2 text-2xl font-bold text-ink">{winnerLabel}</h1>
          <p className="mb-4 text-lg font-semibold text-ink/70">
            <span className="text-blue-600">{state.teamScores.A}</span> — <span className="text-red-600">{state.teamScores.B}</span>
          </p>

          {mvp && (
            <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm">
              <span className="font-bold text-amber-700">🏅 Cầu thủ xuất sắc nhất: </span>
              <span className="font-semibold text-ink">{mvp.name}</span>
              <span className="text-ink/60"> ({mvp.goals} bàn, {mvp.tacklesWon} tắc bóng thành công)</span>
            </div>
          )}

          <div className="mb-6 overflow-x-auto rounded-lg border border-cream-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-ink/60">
                <tr>
                  <th className="px-3 py-2">Cầu thủ</th>
                  <th className="px-3 py-2 text-center">Bàn</th>
                  <th className="px-3 py-2 text-center">Dứt điểm</th>
                  <th className="px-3 py-2 text-center">Tắc bóng</th>
                  <th className="px-3 py-2 text-center">Lỗi</th>
                  <th className="px-3 py-2 text-center">Thẻ</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((p) => (
                  <tr key={p.id} className="border-t border-cream-100">
                    <td className="max-w-40 truncate px-3 py-2 font-medium">
                      <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${p.team === "A" ? "bg-blue-500" : "bg-red-500"}`} />
                      {p.name}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold">{p.goals}</td>
                    <td className="px-3 py-2 text-center">{p.shots}</td>
                    <td className="px-3 py-2 text-center">{p.tacklesWon}</td>
                    <td className="px-3 py-2 text-center">{p.fouls}</td>
                    <td className="px-3 py-2 text-center">
                      {p.cardStatus === "red" ? "🟥" : p.cardStatus === "yellow" ? "🟨" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isHost ? (
            <button
              onClick={() => {
                playClick();
                send({ type: "play_again" });
              }}
              className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Chơi lại
            </button>
          ) : (
            <p className="mb-3 text-sm text-ink/50">Đang đợi chủ phòng...</p>
          )}
          <button onClick={handleLeave} className="text-xs font-medium text-ink/40 hover:text-ink/70">
            Rời phòng
          </button>
        </div>
      </main>
    );
  }

  const remainingMs = typeof state.matchEndsAt === "number" ? Math.max(0, state.matchEndsAt - state.serverNow) : null;
  const remainingLabel = remainingMs !== null ? `${Math.floor(remainingMs / 60000)}:${String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0")}` : null;
  const urgent = remainingMs !== null && remainingMs > 0 && remainingMs <= 30000;

  return (
    <div className="min-h-app bg-soccer-scene">
      <div className="mx-auto flex max-w-4xl min-w-0 flex-col gap-3 px-3 py-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xl">
          <div className="flex items-center gap-3 text-sm font-semibold">
            {remainingLabel && (
              <span
                className={`rounded px-2 py-0.5 font-mono ${urgent ? "animate-pulse bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}
              >
                ⏱ {remainingLabel}
              </span>
            )}
            <span className="text-blue-600">Xanh {state.teamScores.A}</span>
            <span className="text-slate-300">—</span>
            <span className="text-red-600">{state.teamScores.B} Đỏ</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => {
                const next = !blvMuted;
                setCommentaryMuted(next);
                setBlvMuted(next);
              }}
              title={blvMuted ? "Bật giọng bình luận viên" : "Tắt giọng bình luận viên"}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-500"
            >
              {blvMuted ? "🔇 BLV" : "🗣️ BLV"}
            </button>
            <button onClick={handleLeave} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:border-red-400 hover:bg-red-50">
              Rời phòng
            </button>
          </div>
        </div>

        <div className="relative">
          <SoccerCanvas state={state} selfId={playerId} send={send} />
          {state.status === "ended" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="animate-bounce-in rounded-xl bg-white px-6 py-3 text-lg font-bold text-ink shadow-xl">🏁 Trận đấu kết thúc!</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
