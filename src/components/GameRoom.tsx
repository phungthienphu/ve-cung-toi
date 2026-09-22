"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameRoom } from "@/lib/useGameRoom";
import { WORD_CHOICE_SECONDS, POST_ROUND_SECONDS } from "@shared/types";
import { playClick } from "@/lib/sound";
import { fireworks } from "@/lib/confetti";
import { drawFontClass } from "@/lib/drawFonts";
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
      router.push("/draw-guess");
    }
  }, [kicked, router]);

  if (kicked) return null;

  if (!state) {
    return (
      <div className={`${drawFontClass} flex min-h-app items-center justify-center text-ink/40`}>
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
    return <Lobby state={state} selfId={playerId} isHost={isHost} roomId={roomId} chat={chat} send={send} onStart={(config) => send({ type: "start_game", config })} />;
  }

  if (state.status === "gameEnd") {
    const ranking = (finalPlayers ?? state.players).slice().sort((a, b) => b.score - a.score);
    const top3 = ranking.slice(0, 3);
    const rest = ranking.slice(3);
    // Classic podium reading order (silver, gold, bronze) built only from
    // however many of the top 3 spots actually exist — a 2-player game
    // still gets a (silver, gold) podium instead of a broken 3-slot layout.
    const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3.length === 2 ? [top3[1], top3[0]] : top3;
    const barStyle = (rank: number) =>
      rank === 0
        ? { height: "96px", className: "border-gold-500 bg-gradient-to-b from-gold-100 to-white" }
        : rank === 1
          ? { height: "70px", className: "border-cream-200 bg-white" }
          : { height: "52px", className: "border-cream-200 bg-white" };
    const medal = (rank: number) => (rank === 0 ? "🥇" : rank === 1 ? "🥈" : "🥉");

    return (
      <div className={`${drawFontClass} bg-game-scene flex min-h-app items-center justify-center px-4 py-10`}>
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6">
        <h2 className="font-draw-display text-2xl font-bold tracking-tight text-ink">🏆 Kết thúc ván chơi!</h2>
        <div className="w-full rounded-xl border border-cream-200 bg-white p-6 shadow-xl">
          <div className="flex items-end justify-center gap-3 pb-1 pt-2">
            {podiumOrder.map((p) => {
              const rank = ranking.indexOf(p);
              const bar = barStyle(rank);
              return (
                <div key={p.id} className="flex w-24 flex-col items-center gap-1.5">
                  <span className="text-2xl">{medal(rank)}</span>
                  <span className="max-w-full truncate text-sm font-bold text-ink">{p.name}</span>
                  <span className="font-draw-display font-bold text-clay-600">{p.score}</span>
                  <div className={`w-full rounded-t-lg border border-b-0 ${bar.className}`} style={{ height: bar.height }} />
                </div>
              );
            })}
          </div>

          {rest.length > 0 && (
            <div className="mt-4 flex flex-col gap-1.5 border-t border-cream-100 pt-4">
              {rest.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg bg-cream-50 px-3 py-2 text-sm">
                  <span className="w-5 shrink-0 font-semibold text-ink/40">{i + 4}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{p.name}</span>
                  <span className="shrink-0 font-draw-display font-semibold text-ink/60">{p.score} điểm</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {isHost && (
            <button
              onClick={() => {
                playClick();
                send({ type: "play_again" });
              }}
              className="rounded-lg bg-clay-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-clay-500/30 transition hover:bg-clay-600"
            >
              Chơi lại
            </button>
          )}
          <Link
            href="/leaderboard"
            className="rounded-lg border border-cream-200 px-5 py-2.5 text-sm font-semibold text-ink/70 transition hover:border-clay-500 hover:text-clay-600"
          >
            Lịch sử
          </Link>
          <Link
            href="/draw-guess"
            className="rounded-lg border border-cream-200 px-5 py-2.5 text-sm font-semibold text-ink/70 transition hover:border-clay-500 hover:text-clay-600"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className={`${drawFontClass} bg-game-scene min-h-app`}>
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-3 py-4 md:px-6">
      {state.topic && (
        <div className="-mb-2 flex items-center justify-center gap-1.5 text-xs text-ink/50">
          <span className="font-semibold uppercase tracking-wide text-ink/40">Chủ đề đêm nay:</span>
          <span className="font-semibold text-clay-600">{state.topic}</span>
        </div>
      )}
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
        onRevealLetter={(index) => send({ type: "reveal_letter", index })}
      />

      <button
        onClick={() => setChatOpen(true)}
        className="relative flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm font-medium text-ink/70 shadow-xl transition hover:border-clay-500 hover:text-clay-600 md:hidden"
      >
        💬 Xem chat
        {unseenChat > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
            {unseenChat > 9 ? "9+" : unseenChat}
          </span>
        )}
      </button>

      <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-[220px_1fr_260px] md:items-stretch">
        <div className="order-2 flex h-56 min-w-0 flex-col gap-2 md:order-1 md:h-[600px]">
          <PlayerList players={state.players} drawerId={state.drawerId} selfId={playerId} onKick={isHost ? (id) => send({ type: "kick_player", playerId: id }) : undefined} />
          <button
            onClick={() => {
              if (!confirm("Rời khỏi phòng?")) return;
              playClick();
              send({ type: "leave_room" });
              router.push("/draw-guess");
            }}
            className="shrink-0 rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm font-medium text-red-500 shadow-xl transition hover:border-red-300 hover:bg-red-50"
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
              <span className="font-draw-display text-sm font-semibold text-ink">Chat</span>
              <button
                onClick={() => setChatOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-ink/40 hover:text-ink"
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
  onRevealLetter,
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
  onRevealLetter: (index: number) => void;
}) {
  const remaining = useCountdown(status === "playing" ? turnEndsAt : phaseEndsAt);
  const total =
    status === "playing" ? drawSeconds * 1000 : status === "choosing" ? WORD_CHOICE_SECONDS * 1000 : POST_ROUND_SECONDS * 1000;
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  const seconds = Math.ceil(remaining / 1000);
  const urgent = seconds <= 10 && status === "playing";

  const showLetterPicker = isDrawer && status === "playing" && !!myWord;

  return (
    <div className={`${drawFontClass} rounded-xl border border-cream-200 bg-white p-3 shadow-xl`}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="shrink-0 font-semibold text-ink/50">Lượt {round}/{totalTurns}</span>
        <span className="min-w-0 truncate text-center font-medium text-ink/70">
          {status === "choosing" && `${drawerName ?? "?"} đang chọn từ...`}
          {status === "playing" && (
            <>
              <b className="text-clay-600">{drawerName ?? "?"}</b> đang vẽ
            </>
          )}
          {status === "roundEnd" && "Hết lượt!"}
        </span>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 font-draw-display font-bold ${
            urgent ? "animate-pulse bg-gold-100 text-gold-600" : "bg-sage-100 text-sage-600"
          }`}
        >
          ⏱ {seconds}s
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-cream-100">
        <div className={`h-full transition-[width] ${urgent ? "bg-gold-500" : "bg-clay-500"}`} style={{ width: `${pct}%` }} />
      </div>
      {(status === "playing" || status === "choosing") &&
        (showLetterPicker && myWord ? (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1">
            {myWord.split("").map((ch, i) => {
              if (/\s/.test(ch)) return <span key={i} className="w-3" />;
              const isRevealed = wordHint != null && wordHint[i] !== "_";
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isRevealed}
                  onClick={() => onRevealLetter(i)}
                  title={isRevealed ? "Đã gợi ý" : "Bấm để gợi ý chữ này cho người đoán"}
                  className={`flex h-10 w-9 items-center justify-center rounded-lg border-2 font-draw-display text-xl font-bold uppercase transition ${
                    isRevealed
                      ? "cursor-default border-sage-500 bg-sage-100 text-sage-600"
                      : "border-clay-500 bg-clay-500/10 text-clay-600 hover:bg-clay-500/20"
                  }`}
                >
                  {ch}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1">
            {(wordHint ?? "").split("").map((ch, i) =>
              /\s/.test(ch) ? (
                <span key={i} className="w-3" />
              ) : ch === "_" ? (
                <span key={i} className="flex h-10 w-9 items-center justify-center rounded-lg border-2 border-dashed border-cream-200" />
              ) : (
                <span
                  key={i}
                  className="flex h-10 w-9 items-center justify-center rounded-lg border-2 border-sage-500 bg-sage-100 font-draw-display text-xl font-bold uppercase text-sage-600"
                >
                  {ch}
                </span>
              )
            )}
          </div>
        ))}
    </div>
  );
}

function WordChoiceModal({ choices, deadline, onChoose }: { choices: string[]; deadline: number; onChoose: (w: string) => void }) {
  const remaining = useCountdown(deadline);
  const seconds = Math.ceil(remaining / 1000);
  return (
    <div className={`${drawFontClass} fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4`}>
      <div className="animate-bounce-in w-full max-w-sm rounded-xl border border-cream-200 bg-white p-6 text-center shadow-xl">
        <h3 className="mb-1 font-draw-display text-lg font-bold text-ink">Chọn một từ để vẽ</h3>
        <p className={`mb-4 text-sm ${seconds <= 4 ? "font-semibold text-red-500" : "text-ink/40"}`}>{seconds}s để chọn</p>
        <div className="flex flex-col gap-2">
          {choices.map((w) => (
            <button
              key={w}
              onClick={() => {
                playClick();
                onChoose(w);
              }}
              className="rounded-lg border border-cream-200 px-4 py-3 font-semibold text-ink/70 transition hover:border-clay-500 hover:bg-clay-500/5 hover:text-clay-600"
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
    <div className={`${drawFontClass} mt-3 flex flex-col items-center gap-3 rounded-xl border border-cream-200 bg-white p-4 text-center shadow-xl`}>
      <p className="text-lg text-ink/80">
        Đáp án là: <span className="font-draw-display font-semibold text-clay-600">{word}</span>
      </p>
      {snapshot && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={snapshot} alt="Tranh vừa vẽ" className="max-h-40 rounded-lg border border-cream-200" />
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={snapshot}
              download={`ve-cung-toi-${Date.now()}.png`}
              className="rounded-lg bg-clay-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm shadow-clay-500/30 transition hover:bg-clay-600"
            >
              Tải về
            </a>
            <button
              onClick={handleCopy}
              className="rounded-lg border border-cream-200 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:border-clay-500 hover:text-clay-600"
            >
              Sao chép
            </button>
          </div>
        </>
      )}
    </div>
  );
}
