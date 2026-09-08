"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientMessage, PublicRoomState, RoomConfig } from "@shared/types";
import { DEFAULT_ROOM_CONFIG, MAX_WORD_COUNT, MIN_PLAYERS_TO_START, MIN_WORD_COUNT } from "@shared/types";
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
  const [minWords, setMinWords] = useState(DEFAULT_ROOM_CONFIG.minWords);
  const [maxWords, setMaxWords] = useState(DEFAULT_ROOM_CONFIG.maxWords);
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

    onStart({
      rounds,
      drawSeconds,
      wordlistIds: wordlistIds.length ? wordlistIds : ["vi-default"],
      customWords: custom,
      minWords,
      maxWords,
    });

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
    <div className="bg-game-scene min-h-dvh flex items-center">
      <div className="m-auto grid w-full min-w-0 max-w-4xl gap-5 px-4 py-10 md:grid-cols-[1fr_320px]">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Phòng chờ</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopyLink}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-brand-500 hover:text-brand-600"
              >
                {copied ? "Đã sao chép!" : `Mã: ${roomId}`}
              </button>
              <button
                onClick={handleLeave}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:border-red-400 hover:bg-red-50"
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
                  className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
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
                  className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
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
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${difficulty === "easy"
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-slate-300 text-slate-700 hover:border-brand-500 hover:text-brand-600"
                      }`}
                  >
                    Dễ
                  </button>
                  <button
                    type="button"
                    onClick={() => setDifficulty("hard")}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${difficulty === "hard"
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-slate-300 text-slate-700 hover:border-brand-500 hover:text-brand-600"
                      }`}
                  >
                    Khó &amp; Hài hước
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Số từ mỗi câu đố (giới hạn độ dài)</label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Từ</span>
                  <select
                    value={minWords}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMinWords(v);
                      if (v > maxWords) setMaxWords(v);
                    }}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    {Array.from({ length: MAX_WORD_COUNT - MIN_WORD_COUNT + 1 }, (_, i) => MIN_WORD_COUNT + i).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-slate-500">đến</span>
                  <select
                    value={maxWords}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMaxWords(v);
                      if (v < minWords) setMinWords(v);
                    }}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    {Array.from({ length: MAX_WORD_COUNT - MIN_WORD_COUNT + 1 }, (_, i) => MIN_WORD_COUNT + i).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-slate-500">từ / câu</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Số nhỏ (1-2) ra từ ngắn dễ đoán như &ldquo;con mèo&rdquo;. Số lớn hơn sẽ ra cụm dài, khó và hài hước hơn.
                </p>
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <button
                onClick={handleStart}
                disabled={!canStart}
                className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-200 transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {canStart ? "Bắt đầu chơi" : `Cần ít nhất ${MIN_PLAYERS_TO_START} người chơi`}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-500">Đang chờ chủ phòng bắt đầu ván chơi...</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
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
                  <div className="flex justify-between">
                    <dt>Số từ mỗi câu</dt>
                    <dd className="font-medium">
                      {state.config.minWords}–{state.config.maxWords} từ
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
    </div>
  );
}
