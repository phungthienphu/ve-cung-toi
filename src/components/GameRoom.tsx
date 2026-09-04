"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGameRoom } from "@/lib/useGameRoom";
import { WORD_CHOICE_SECONDS, POST_ROUND_SECONDS } from "@shared/types";
import Lobby from "./Lobby";
import PlayerList from "./PlayerList";
import Chat from "./Chat";
import DrawingCanvas, { type DrawingCanvasHandle } from "./DrawingCanvas";
import { useCountdown } from "./useCountdown";

interface Props {
  roomId: string;
  playerId: string;
  name: string;
}

export default function GameRoom({ roomId, playerId, name }: Props) {
  const {
    state,
    chat,
    myWord,
    wordChoices,
    connected,
    finalPlayers,
    strokeEvents,
    send,
    clearStrokeEvents,
  } = useGameRoom(roomId, playerId, name);

  const canvasRef = useRef<DrawingCanvasHandle | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const prevStatus = useRef<string | null>(null);

  useEffect(() => {
    if (prevStatus.current === "playing" && state?.status === "roundEnd") {
      setSnapshot(canvasRef.current?.getDataUrl() ?? null);
    }
    prevStatus.current = state?.status ?? null;
  }, [state?.status]);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        {connected ? "Đang tải phòng..." : "Đang kết nối..."}
      </div>
    );
  }

  const self = state.players.find((p) => p.id === playerId);
  const isHost = state.hostId === playerId;
  const isDrawerRole = state.drawerId === playerId;
  const isDrawer = state.status === "playing" && isDrawerRole;
  const drawerName = state.players.find((p) => p.id === state.drawerId)?.name;

  if (state.status === "lobby") {
    return <Lobby state={state} selfId={playerId} isHost={isHost} roomId={roomId} onStart={(config) => send({ type: "start_game", config })} />;
  }

  if (state.status === "gameEnd") {
    const ranking = (finalPlayers ?? state.players).slice().sort((a, b) => b.score - a.score);
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-4 py-10">
        <h2 className="text-3xl font-black text-brand-600">🏆 Kết thúc ván chơi!</h2>
        <div className="w-full rounded-2xl bg-white p-6 shadow-lg">
          {ranking.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
              <span className="flex items-center gap-2 font-medium">
                <span className="text-slate-400">#{i + 1}</span>
                {i === 0 && "🥇"}
                {i === 1 && "🥈"}
                {i === 2 && "🥉"}
                {p.name}
              </span>
              <span className="font-bold text-brand-600">{p.score} điểm</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          {isHost && (
            <button
              onClick={() => send({ type: "play_again" })}
              className="rounded-xl bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600"
            >
              Chơi lại
            </button>
          )}
          <Link href="/leaderboard" className="rounded-xl bg-slate-100 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-200">
            🏆 Xếp hạng
          </Link>
          <Link href="/" className="rounded-xl bg-slate-100 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-200">
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-3 py-4 md:px-6">
      <RoundHeader
        round={state.round}
        totalTurns={state.totalTurns}
        status={state.status}
        turnEndsAt={state.turnEndsAt}
        phaseEndsAt={state.phaseEndsAt}
        drawSeconds={state.config.drawSeconds}
        isDrawer={isDrawer}
        myWord={myWord}
        wordHint={state.wordHint}
        drawerName={drawerName}
      />

      <div className="grid flex-1 gap-4 md:grid-cols-[220px_1fr_260px]">
        <div className="order-2 md:order-1">
          <PlayerList players={state.players} drawerId={state.drawerId} selfId={playerId} />
        </div>

        <div className="order-1 md:order-2">
          <DrawingCanvas
            ref={canvasRef}
            isDrawer={isDrawer}
            strokeEvents={strokeEvents}
            clearStrokeEvents={clearStrokeEvents}
            send={send}
          />

          {state.status === "roundEnd" && (
            <RoundEndPanel word={state.revealedWord} snapshot={snapshot} />
          )}
        </div>

        <div className="order-3 h-[320px] md:h-auto">
          <Chat
            entries={chat}
            selfId={playerId}
            canGuess={state.status === "playing" && !isDrawer && !self?.hasGuessedCorrectly}
            onSend={(text) => send({ type: "chat", text })}
          />
        </div>
      </div>

      {isDrawerRole && wordChoices && (
        <WordChoiceModal choices={wordChoices.choices} deadline={wordChoices.deadline} onChoose={(word) => send({ type: "choose_word", word })} />
      )}
    </div>
  );
}

function RoundHeader({
  round,
  totalTurns,
  status,
  turnEndsAt,
  phaseEndsAt,
  drawSeconds,
  isDrawer,
  myWord,
  wordHint,
  drawerName,
}: {
  round: number;
  totalTurns: number;
  status: string;
  turnEndsAt: number | null;
  phaseEndsAt: number | null;
  drawSeconds: number;
  isDrawer: boolean;
  myWord: string | null;
  wordHint: string | null;
  drawerName?: string;
}) {
  const remaining = useCountdown(status === "playing" ? turnEndsAt : phaseEndsAt);
  const total =
    status === "playing" ? drawSeconds * 1000 : status === "choosing" ? WORD_CHOICE_SECONDS * 1000 : POST_ROUND_SECONDS * 1000;
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  const seconds = Math.ceil(remaining / 1000);

  const display = isDrawer && myWord ? myWord.split("").join(" ") : (wordHint ?? "").split("").join(" ");

  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Lượt {round}/{totalTurns}</span>
        <span>
          {status === "choosing" && `${drawerName ?? "?"} đang chọn từ...`}
          {status === "playing" && `${drawerName ?? "?"} đang vẽ`}
          {status === "roundEnd" && "Hết lượt!"}
        </span>
        <span className="font-mono font-semibold">{seconds}s</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-brand-500 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {(status === "playing" || status === "choosing") && (
        <div className="mt-2 text-center text-2xl font-black tracking-widest text-slate-700">{display || " "}</div>
      )}
    </div>
  );
}

function WordChoiceModal({ choices, deadline, onChoose }: { choices: string[]; deadline: number; onChoose: (w: string) => void }) {
  const remaining = useCountdown(deadline);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <h3 className="mb-1 text-lg font-bold">Chọn một từ để vẽ</h3>
        <p className="mb-4 text-sm text-slate-400">{Math.ceil(remaining / 1000)}s để chọn</p>
        <div className="flex flex-col gap-2">
          {choices.map((w) => (
            <button
              key={w}
              onClick={() => onChoose(w)}
              className="rounded-xl border-2 border-brand-100 px-4 py-3 font-semibold text-brand-700 transition hover:border-brand-400 hover:bg-brand-50"
            >
              {w}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoundEndPanel({ word, snapshot }: { word: string | null; snapshot: string | null }) {
  async function handleCopy() {
    if (!snapshot) return;
    try {
      const blob = await (await fetch(snapshot)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      alert("Đã sao chép ảnh!");
    } catch {
      alert("Trình duyệt không hỗ trợ sao chép ảnh. Hãy dùng nút Tải về.");
    }
  }

  return (
    <div className="mt-3 flex flex-col items-center gap-3 rounded-xl bg-white p-4 text-center shadow-sm">
      <p className="text-lg">
        Đáp án là: <span className="font-bold text-brand-600">{word}</span>
      </p>
      {snapshot && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={snapshot} alt="Tranh vừa vẽ" className="max-h-40 rounded-lg border border-slate-200" />
          <div className="flex gap-2">
            <a
              href={snapshot}
              download={`ve-cung-toi-${Date.now()}.png`}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              ⬇️ Tải về
            </a>
            <button onClick={handleCopy} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
              📋 Sao chép
            </button>
          </div>
        </>
      )}
    </div>
  );
}
