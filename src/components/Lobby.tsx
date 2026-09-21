"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientMessage, PublicRoomState, RoomConfig } from "@shared/types";
import { DEFAULT_ROOM_CONFIG, MAX_WORD_COUNT, MIN_PLAYERS_TO_START, MIN_WORD_COUNT } from "@shared/types";
import { DEFAULT_WORDLISTS, buildWordPool } from "@shared/wordlists";
import { playClick } from "@/lib/sound";
import { drawFontClass } from "@/lib/drawFonts";
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
  const [customOnly, setCustomOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  const connectedCount = state.players.filter((p) => p.connected).length;
  const canStart = connectedCount >= MIN_PLAYERS_TO_START;

  // Shared by the live "will words repeat" warning below and handleStart's
  // actual submit — one derivation, so the warning can never disagree with
  // what start_game would actually send.
  const suffix = difficulty === "hard" ? "hard" : "default";
  const wordlistIds = [useVi && `vi-${suffix}`, useEn && `en-${suffix}`].filter(Boolean) as string[];
  const custom = customWords
    .split("\n")
    .map((w) => w.trim())
    .filter(Boolean);

  // Same filtering party/server.ts's handleStartGame applies (via the same
  // buildWordPool), computed here so the host sees "words will repeat"
  // *before* starting instead of only discovering it turn after turn.
  const liveWordPool = buildWordPool({
    wordlistIds: wordlistIds.length ? wordlistIds : ["vi-default"],
    customWords: custom,
    customOnly,
    minWords,
    maxWords,
  });
  const turnsNeeded = Math.max(connectedCount, MIN_PLAYERS_TO_START) * rounds;
  const willRepeatWords = liveWordPool.length >= 3 && liveWordPool.length < turnsNeeded;

  function handleLeave() {
    if (!confirm("Rời khỏi phòng?")) return;
    playClick();
    send({ type: "leave_room" });
    router.push("/draw-guess");
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
    if (customOnly && custom.length < 20) {
      alert("Chế độ chỉ dùng từ tùy chỉnh cần tối thiểu 20 từ.");
      return;
    }
    if (!customOnly && wordlistIds.length === 0 && custom.length < 20) {
      alert("Chọn ít nhất một bộ từ mặc định, hoặc nhập tối thiểu 20 từ tùy chỉnh.");
      return;
    }

    onStart({
      rounds,
      drawSeconds,
      wordlistIds: wordlistIds.length ? wordlistIds : ["vi-default"],
      customWords: custom,
      customOnly,
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
    <div className={`${drawFontClass} bg-game-scene min-h-app flex items-center`}>
      <div className="m-auto grid w-full min-w-0 max-w-4xl gap-5 px-4 py-10 md:grid-cols-[1fr_320px]">
        <div className="min-w-0 rounded-xl border border-cream-200 bg-white p-6 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-draw-display text-xl font-bold tracking-tight text-ink">Phòng chờ</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 rounded-lg border-2 border-dashed border-cream-200 bg-white px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:border-clay-500"
              >
                {copied ? (
                  "Đã sao chép!"
                ) : (
                  <>
                    <span className="text-xs uppercase tracking-wide text-ink/40">Mã</span>
                    <span className="font-draw-display font-semibold tracking-wider text-clay-600">{roomId}</span>
                  </>
                )}
              </button>
              <button
                onClick={handleLeave}
                className="rounded-lg border border-cream-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:border-red-400 hover:bg-red-50"
              >
                Rời phòng
              </button>
            </div>
          </div>

          {isHost ? (
            <div className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink/70">Số vòng (mỗi người vẽ N lần)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="w-24 rounded-lg border border-cream-200 px-3 py-1.5 text-sm outline-none transition focus:border-clay-500 focus:ring-1 focus:ring-clay-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ink/70">Thời gian vẽ mỗi lượt (giây)</label>
                <input
                  type="number"
                  min={30}
                  max={240}
                  step={10}
                  value={drawSeconds}
                  onChange={(e) => setDrawSeconds(Number(e.target.value))}
                  className="w-24 rounded-lg border border-cream-200 px-3 py-1.5 text-sm outline-none transition focus:border-clay-500 focus:ring-1 focus:ring-clay-500"
                />
              </div>

              <div className={customOnly ? "opacity-40" : undefined}>
                <label className="mb-1 block text-sm font-medium text-ink/70">Bộ từ vựng</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-clay-500" checked={useVi} disabled={customOnly} onChange={(e) => setUseVi(e.target.checked)} />
                    Tiếng Việt
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-clay-500" checked={useEn} disabled={customOnly} onChange={(e) => setUseEn(e.target.checked)} />
                    English
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ink/70">Độ khó</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDifficulty("easy")}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${difficulty === "easy"
                        ? "border-clay-500 bg-clay-500 text-white"
                        : "border-cream-200 text-ink/70 hover:border-clay-500 hover:text-clay-600"
                      }`}
                  >
                    Dễ
                  </button>
                  <button
                    type="button"
                    onClick={() => setDifficulty("hard")}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${difficulty === "hard"
                        ? "border-clay-500 bg-clay-500 text-white"
                        : "border-cream-200 text-ink/70 hover:border-clay-500 hover:text-clay-600"
                      }`}
                  >
                    Khó &amp; Hài hước
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ink/70">Số từ mỗi câu đố (giới hạn độ dài)</label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-ink/50">Từ</span>
                  <select
                    value={minWords}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMinWords(v);
                      if (v > maxWords) setMaxWords(v);
                    }}
                    className="rounded-lg border border-cream-200 px-2 py-1.5 text-sm outline-none transition focus:border-clay-500 focus:ring-1 focus:ring-clay-500"
                  >
                    {Array.from({ length: MAX_WORD_COUNT - MIN_WORD_COUNT + 1 }, (_, i) => MIN_WORD_COUNT + i).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-ink/50">đến</span>
                  <select
                    value={maxWords}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMaxWords(v);
                      if (v < minWords) setMinWords(v);
                    }}
                    className="rounded-lg border border-cream-200 px-2 py-1.5 text-sm outline-none transition focus:border-clay-500 focus:ring-1 focus:ring-clay-500"
                  >
                    {Array.from({ length: MAX_WORD_COUNT - MIN_WORD_COUNT + 1 }, (_, i) => MIN_WORD_COUNT + i).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-ink/50">từ / câu</span>
                </div>
                <p className="mt-1 text-xs text-ink/40">
                  Số nhỏ (1-2) ra từ ngắn dễ đoán như &ldquo;con mèo&rdquo;. Số lớn hơn sẽ ra cụm dài, khó và hài hước hơn.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ink/70">
                  Từ tùy chỉnh (mỗi dòng 1 từ, tùy chọn — cần ≥20 từ nếu không dùng bộ mặc định)
                </label>
                <textarea
                  value={customWords}
                  onChange={(e) => setCustomWords(e.target.value)}
                  rows={4}
                  placeholder={"con mèo\ncon chó\n..."}
                  className="w-full rounded-lg border border-cream-200 px-3 py-2 text-sm outline-none transition focus:border-clay-500 focus:ring-1 focus:ring-clay-500"
                />
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-clay-500" checked={customOnly} onChange={(e) => setCustomOnly(e.target.checked)} />
                  Chỉ dùng từ tùy chỉnh (bỏ qua bộ từ mặc định ở trên)
                </label>
              </div>

              {willRepeatWords && (
                <p className="rounded-lg border border-gold-500/40 bg-gold-100 px-3 py-2 text-xs text-gold-600">
                  ⚠️ Chỉ có {liveWordPool.length} từ phù hợp nhưng ván này cần {turnsNeeded} lượt vẽ ({Math.max(connectedCount, MIN_PLAYERS_TO_START)}{" "}
                  người × {rounds} vòng) — một số từ sẽ bị lặp lại. Nới rộng khoảng số từ/câu, thêm bộ từ vựng, hoặc thêm từ tùy chỉnh để tránh.
                </p>
              )}

              <button
                onClick={handleStart}
                disabled={!canStart}
                className="w-full rounded-lg bg-clay-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-clay-500/30 transition hover:bg-clay-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {canStart ? "Bắt đầu chơi" : `Cần ít nhất ${MIN_PLAYERS_TO_START} người chơi`}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-ink/50">Đang chờ chủ phòng bắt đầu ván chơi...</p>
              <div className="rounded-lg border border-cream-200 bg-cream-50 p-4 text-sm text-ink/70">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">Cài đặt phòng (chỉ xem)</p>
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
                      {state.config.customOnly
                        ? "Chỉ từ tùy chỉnh"
                        : state.config.wordlistIds.length > 0
                          ? state.config.wordlistIds.map(wordlistLabel).join(", ")
                          : "—"}
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
