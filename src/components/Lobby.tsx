"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientMessage, PublicRoomState, RoomConfig } from "@shared/types";
import { DEFAULT_ROOM_CONFIG, MIN_PLAYERS_TO_START } from "@shared/types";
import { DEFAULT_WORDLISTS } from "@shared/wordlists";
import { playClick } from "@/lib/sound";
import PlayerList from "./PlayerList";

interface Props {
  state: PublicRoomState;
  selfId: string;
  isHost: boolean;
  roomId: string;
  onStart: (config: RoomConfig) => void;
  send: (msg: ClientMessage) => void;
}

function wordlistLabel(id: string): string {
  return DEFAULT_WORDLISTS.find((w) => w.id === id)?.name ?? id;
}

export default function Lobby({ state, selfId, isHost, roomId, onStart, send }: Props) {
  const router = useRouter();
  const [rounds, setRounds] = useState(DEFAULT_ROOM_CONFIG.rounds);
  const [drawSeconds, setDrawSeconds] = useState(DEFAULT_ROOM_CONFIG.drawSeconds);
  const [useVi, setUseVi] = useState(true);
  const [useEn, setUseEn] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "hard">("easy");
  const [customWords, setCustomWords] = useState("");
  const [copied, setCopied] = useState(false);

  const connectedCount = state.players.filter((p) => p.connected).length;
  const canStart = connectedCount >= MIN_PLAYERS_TO_START;

  function handleLeave() {
    if (!confirm("Rời khỏi phòng?")) return;
    playClick();
    send({ type: "leave_room" });
    router.push("/");
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleStart() {
    playClick();
    const suffix = difficulty === "hard" ? "hard" : "default";
    const wordlistIds = [useVi && `vi-${suffix}`, useEn && `en-${suffix}`].filter(Boolean) as string[];
    const custom = customWords
      .split("\n")
      .map((w) => w.trim())
      .filter(Boolean);

    if (wordlistIds.length === 0 && custom.length < 20) {
      alert("Chọn ít nhất một bộ từ mặc định, hoặc nhập tối thiểu 20 từ tùy chỉnh.");
      return;
    }

    onStart({ rounds, drawSeconds, wordlistIds: wordlistIds.length ? wordlistIds : ["vi-default"], customWords: custom });

    if (custom.length >= 20) {
      fetch("/api/wordlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Tùy chỉnh - phòng ${roomId}`, words: custom, createdBy: selfId }),
      }).catch(() => {
        // Best-effort only — persisting the custom list must never block starting the game.
      });
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-10 md:grid-cols-[1fr_320px]">
      <div className="rounded-2xl bg-white p-6 shadow-lg shadow-brand-100">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-2xl font-bold">Phòng chờ</h2>
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              {copied ? "Đã sao chép!" : `📋 Mã: ${roomId}`}
            </button>
            <button
              onClick={handleLeave}
              className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              Rời phòng
            </button>
          </div>
        </div>

        {isHost ? (
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Số vòng (mỗi người vẽ N lần)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-200 px-3 py-1.5"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Thời gian vẽ mỗi lượt (giây)</label>
              <input
                type="number"
                min={30}
                max={240}
                step={10}
                value={drawSeconds}
                onChange={(e) => setDrawSeconds(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-200 px-3 py-1.5"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Bộ từ vựng</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useVi} onChange={(e) => setUseVi(e.target.checked)} />
                  Tiếng Việt
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useEn} onChange={(e) => setUseEn(e.target.checked)} />
                  English
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Độ khó</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDifficulty("easy")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    difficulty === "easy" ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  😌 Dễ
                </button>
                <button
                  type="button"
                  onClick={() => setDifficulty("hard")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    difficulty === "hard" ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  🔥 Khó & Hài hước
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                Từ tùy chỉnh (mỗi dòng 1 từ, tùy chọn — cần ≥20 từ nếu không dùng bộ mặc định)
              </label>
              <textarea
                value={customWords}
                onChange={(e) => setCustomWords(e.target.value)}
                rows={4}
                placeholder={"con mèo\ncon chó\n..."}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
            </div>

            <button
              onClick={handleStart}
              disabled={!canStart}
              className="w-full rounded-xl bg-brand-500 px-4 py-3 font-semibold text-white shadow-md shadow-brand-200 transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {canStart ? "Bắt đầu chơi" : `Cần ít nhất ${MIN_PLAYERS_TO_START} người chơi`}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-500">Đang chờ chủ phòng bắt đầu ván chơi...</p>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Cài đặt phòng (chỉ xem)</p>
              <dl className="space-y-1.5">
                <div className="flex justify-between">
                  <dt>Số vòng</dt>
                  <dd className="font-medium">{state.config.rounds}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Thời gian vẽ / lượt</dt>
                  <dd className="font-medium">{state.config.drawSeconds}s</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Bộ từ vựng</dt>
                  <dd className="text-right font-medium">
                    {state.config.wordlistIds.length > 0 ? state.config.wordlistIds.map(wordlistLabel).join(", ") : "—"}
                  </dd>
                </div>
                {state.config.customWords.length > 0 && (
                  <div className="flex justify-between">
                    <dt>Từ tùy chỉnh</dt>
                    <dd className="font-medium">{state.config.customWords.length} từ</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}
      </div>

      <PlayerList
        players={state.players}
        drawerId={null}
        selfId={selfId}
        onKick={isHost ? (id) => send({ type: "kick_player", playerId: id }) : undefined}
      />
    </div>
  );
}
