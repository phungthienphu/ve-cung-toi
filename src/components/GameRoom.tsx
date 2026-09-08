"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameRoom } from "@/lib/useGameRoom";
import { WORD_CHOICE_SECONDS, POST_ROUND_SECONDS } from "@shared/types";
import { playClick } from "@/lib/sound";
import { fireworks } from "@/lib/confetti";
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
  const router = useRouter();
  const {
    state,
    chat,
    myWord,
    wordChoices,
    connected,
    kicked,
    finalPlayers,
    strokeEvents,
    send,
    clearStrokeEvents,
  } = useGameRoom(roomId, playerId, name);

  const canvasRef = useRef<DrawingCanvasHandle | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const prevStatus = useRef<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [unseenChat, setUnseenChat] = useState(0);
  const lastSeenChatLen = useRef(0);

  useEffect(() => {
    if (chatOpen) {
      lastSeenChatLen.current = chat.length;
      setUnseenChat(0);
    } else {
      setUnseenChat(Math.max(0, chat.length - lastSeenChatLen.current));
    }
  }, [chat.length, chatOpen]);

  useEffect(() => {
    if (prevStatus.current === "playing" && state?.status === "roundEnd") {
      setSnapshot(canvasRef.current?.getDataUrl() ?? null);
    }
    if (prevStatus.current !== "gameEnd" && state?.status === "gameEnd") {
      fireworks();
    }
    prevStatus.current = state?.status ?? null;
  }, [state?.status]);

  useEffect(() => {
    if (kicked) {
      alert("Bạn đã bị chủ phòng mời ra khỏi phòng.");
      router.push("/");
    }
  }, [kicked, router]);

  if (kicked) return null;

  if (!state) {
    return (
      <div className="flex min-h-app items-center justify-center text-slate-400">
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
    return <Lobby state={state} selfId={playerId} isHost={isHost} roomId={roomId} send={send} onStart={(config) => send({ type: "start_game", config })} />;
  }

  if (state.status === "gameEnd") {
    const ranking = (finalPlayers ?? state.players).slice().sort((a, b) => b.score - a.score);
    return (
      <div className="bg-game-scene flex min-h-app items-center justify-center px-4 py-10">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Kết thúc ván chơi</h2>
        <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
          {ranking.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2.5 last:border-0">
              <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
                <span className="shrink-0 text-slate-400">#{i + 1}</span>
                {i === 0 && "🥇"}
                {i === 1 && "🥈"}
                {i === 2 && "🥉"}
                <span className="truncate">{p.name}</span>
              </span>
              <span className="shrink-0 font-semibold text-brand-600">{p.score} điểm</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {isHost && (
            <button
              onClick={() => {
                playClick();
                send({ type: "play_again" });
              }}
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-200 transition hover:bg-brand-600"
            >
              Chơi lại
            </button>
          )}
          <Link
            href="/leaderboard"
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-600"
          >
            Xếp hạng
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-600"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="bg-game-scene min-h-app">
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-3 py-4 md:px-6">
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

      <button
        onClick={() => setChatOpen(true)}
        className="relative flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-xl transition hover:border-brand-500 hover:text-brand-600 md:hidden"
      >
        💬 Xem chat
        {unseenChat > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
            {unseenChat > 9 ? "9+" : unseenChat}
          </span>
        )}
      </button>

      <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-[220px_1fr_260px] md:items-stretch">
        <div className="order-2 flex min-w-0 flex-col gap-2 md:order-1 md:h-[600px]">
          <PlayerList players={state.players} drawerId={state.drawerId} selfId={playerId} onKick={isHost ? (id) => send({ type: "kick_player", playerId: id }) : undefined} />
          <button
            onClick={() => {
              if (!confirm("Rời khỏi phòng?")) return;
              playClick();
              send({ type: "leave_room" });
              router.push("/");
            }}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-red-500 shadow-xl transition hover:border-red-300 hover:bg-red-50"
          >
            Rời phòng
          </button>
        </div>

        <div className="order-1 flex h-canvas-mobile min-w-0 flex-col gap-2 md:order-2 md:h-[600px]">
          <div className="min-h-0 min-w-0 flex-1">
            <DrawingCanvas
              ref={canvasRef}
              isDrawer={isDrawer}
              strokeEvents={strokeEvents}
              clearStrokeEvents={clearStrokeEvents}
              send={send}
            />
          </div>

          {state.status === "roundEnd" && (
            <RoundEndPanel word={state.revealedWord} snapshot={snapshot} />
          )}
        </div>

        <div className="order-3 hidden min-w-0 md:block md:h-[600px]">
          <Chat
            entries={chat}
            selfId={playerId}
            canGuess={state.status === "playing" && !isDrawer && !self?.hasGuessedCorrectly}
            onSend={(text) => send({ type: "chat", text })}
          />
        </div>
      </div>

      {chatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/40 md:hidden">
          <button className="flex-1" aria-label="Đóng chat" onClick={() => setChatOpen(false)} />
          <div className="flex h-[85dvh] min-w-0 flex-col rounded-t-2xl bg-white p-2 shadow-2xl">
            <div className="mb-1 flex shrink-0 items-center justify-between px-2 py-1">
              <span className="text-sm font-semibold text-slate-700">Chat</span>
              <button
                onClick={() => setChatOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-700"
              >
                Đóng ✕
              </button>
            </div>
            <div className="min-h-0 min-w-0 flex-1">
              <Chat
                entries={chat}
                selfId={playerId}
                canGuess={state.status === "playing" && !isDrawer && !self?.hasGuessedCorrectly}
                onSend={(text) => send({ type: "chat", text })}
              />
            </div>
          </div>
        </div>
      )}

      {isDrawerRole && wordChoices && (
        <WordChoiceModal choices={wordChoices.choices} deadline={wordChoices.deadline} onChoose={(word) => send({ type: "choose_word", word })} />
      )}
    </div>
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
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <div className="flex items-center justify-between gap-2 text-sm text-slate-500">
        <span className="shrink-0">Lượt {round}/{totalTurns}</span>
        <span className="min-w-0 truncate text-center">
          {status === "choosing" && `${drawerName ?? "?"} đang chọn từ...`}
          {status === "playing" && `${drawerName ?? "?"} đang vẽ`}
          {status === "roundEnd" && "Hết lượt!"}
        </span>
        <span className={`shrink-0 font-mono font-semibold ${seconds <= 10 && status === "playing" ? "animate-wiggle text-red-500" : ""}`}>
          {seconds}s
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${seconds <= 10 && status === "playing" ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
      </div>
      {(status === "playing" || status === "choosing") && (
        <div className="mt-2 text-center text-2xl font-black tracking-widest text-slate-700">{display || " "}</div>
      )}
    </div>
  );
}

function WordChoiceModal({ choices, deadline, onChoose }: { choices: string[]; deadline: number; onChoose: (w: string) => void }) {
  const remaining = useCountdown(deadline);
  const seconds = Math.ceil(remaining / 1000);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="animate-bounce-in w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-xl">
        <h3 className="mb-1 text-lg font-bold text-slate-900">Chọn một từ để vẽ</h3>
        <p className={`mb-4 text-sm ${seconds <= 4 ? "font-semibold text-red-500" : "text-slate-400"}`}>{seconds}s để chọn</p>
        <div className="flex flex-col gap-2">
          {choices.map((w) => (
            <button
              key={w}
              onClick={() => {
                playClick();
                onChoose(w);
              }}
              className="rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
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
    <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-xl">
      <p className="text-lg text-slate-800">
        Đáp án là: <span className="font-semibold text-brand-600">{word}</span>
      </p>
      {snapshot && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={snapshot} alt="Tranh vừa vẽ" className="max-h-40 rounded-lg border border-slate-200" />
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={snapshot}
              download={`ve-cung-toi-${Date.now()}.png`}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm shadow-brand-200 transition hover:bg-brand-600"
            >
              Tải về
            </a>
            <button
              onClick={handleCopy}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-brand-500 hover:text-brand-600"
            >
              Sao chép
            </button>
          </div>
        </>
      )}
    </div>
  );
}
