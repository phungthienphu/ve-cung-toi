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

const ROUND_PRESETS = [2, 3, 5, 8];
const TIME_PRESETS = [60, 80, 120, 180];

function SegButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border-2 px-3.5 py-1.5 text-sm font-semibold transition ${
        active ? "border-clay-500 bg-clay-500/10 text-clay-600" : "border-cream-200 text-ink/60 hover:border-clay-300"
      }`}
    >
      {children}
    </button>
  );
}

function CfgRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-100 py-3 last:border-0">
      <span className="text-sm font-semibold text-ink/70">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
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
      <div className="m-auto grid w-full min-w-0 max-w-5xl gap-5 px-4 py-10 md:h-[640px] md:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col rounded-xl border border-cream-200 bg-white p-6 shadow-xl md:min-h-0">
          <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <h2 className="font-draw-display text-xl font-bold tracking-tight text-ink">Phòng chờ</h2>
            <button
              onClick={handleLeave}
              className="rounded-lg border border-cream-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:border-red-400 hover:bg-red-50"
            >
              Rời phòng
            </button>
          </div>

          <button
            onClick={handleCopyLink}
            className="mb-5 flex w-full shrink-0 items-center justify-between gap-3 rounded-xl border-2 border-dashed border-cream-200 bg-cream-50 px-4 py-3 text-left transition hover:border-clay-500"
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/40">Mã phòng · bấm để sao chép</div>
              <div className="font-draw-display text-xl tracking-widest text-clay-600">{roomId}</div>
            </div>
            <span className="shrink-0 rounded-lg border border-cream-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70">
              {copied ? "Đã sao chép!" : "📋 Sao chép link"}
            </span>
          </button>

          {isHost ? (
            <div className="flex min-h-0 flex-1 flex-col">
            <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
              <CfgRow label="Số vòng">
                {ROUND_PRESETS.map((n) => (
                  <SegButton key={n} active={rounds === n} onClick={() => setRounds(n)}>
                    {n}
                  </SegButton>
                ))}
              </CfgRow>

              <CfgRow label="Thời gian vẽ">
                {TIME_PRESETS.map((s) => (
                  <SegButton key={s} active={drawSeconds === s} onClick={() => setDrawSeconds(s)}>
                    {s}s
                  </SegButton>
                ))}
              </CfgRow>

              <CfgRow label="Độ khó">
                <SegButton active={difficulty === "easy"} onClick={() => setDifficulty("easy")}>
                  Dễ
                </SegButton>
                <SegButton active={difficulty === "hard"} onClick={() => setDifficulty("hard")}>
                  Khó &amp; Hài hước
                </SegButton>
              </CfgRow>

              <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-cream-100 py-3 ${customOnly ? "opacity-40" : ""}`}>
                <span className="text-sm font-semibold text-ink/70">Bộ từ</span>
                <div className="flex flex-wrap gap-1.5">
                  <SegButton active={useVi} onClick={() => !customOnly && setUseVi(!useVi)}>
                    Tiếng Việt
                  </SegButton>
                  <SegButton active={useEn} onClick={() => !customOnly && setUseEn(!useEn)}>
                    English
                  </SegButton>
                </div>
              </div>

              <CfgRow label="Số từ mỗi câu">
                <div className="flex items-center gap-1.5 text-sm text-ink/50">
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
                  <span>đến</span>
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
                </div>
              </CfgRow>
              <p className="pb-1 pt-2 text-xs text-ink/40">
                Số nhỏ (1-2) ra từ ngắn dễ đoán như &ldquo;con mèo&rdquo;. Số lớn hơn sẽ ra cụm dài, khó và hài hước hơn.
              </p>

              <div className="mt-4 border-t border-cream-100 pt-4">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                  Từ tùy chỉnh <span className="font-normal normal-case text-ink/40">(mỗi dòng 1 từ, cần ≥20 từ nếu không dùng bộ mặc định)</span>
                </label>
                <textarea
                  value={customWords}
                  onChange={(e) => setCustomWords(e.target.value)}
                  rows={4}
                  placeholder={"con mèo\ncon chó\n..."}
                  className="w-full rounded-lg border border-cream-200 px-3 py-2 text-sm outline-none transition focus:border-clay-500 focus:ring-1 focus:ring-clay-500"
                />
                <label className="mt-2.5 flex items-start gap-2 text-sm text-ink/60">
                  <input type="checkbox" className="mt-0.5 accent-clay-500" checked={customOnly} onChange={(e) => setCustomOnly(e.target.checked)} />
                  <span>
                    Chỉ dùng từ tùy chỉnh <b className="font-semibold text-ink">(bỏ qua bộ từ mặc định ở trên)</b>
                  </span>
                </label>
              </div>

              {willRepeatWords && (
                <p className="mt-4 rounded-lg border border-gold-500/40 bg-gold-100 px-3 py-2 text-xs text-gold-600">
                  ⚠️ Chỉ có {liveWordPool.length} từ phù hợp nhưng ván này cần {turnsNeeded} lượt vẽ ({Math.max(connectedCount, MIN_PLAYERS_TO_START)}{" "}
                  người × {rounds} vòng) — một số từ sẽ bị lặp lại. Nới rộng khoảng số từ/câu, thêm bộ từ vựng, hoặc thêm từ tùy chỉnh để tránh.
                </p>
              )}
            </div>

              <button
                onClick={handleStart}
                disabled={!canStart}
                className="mt-4 w-full shrink-0 rounded-lg bg-clay-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-clay-500/30 transition hover:bg-clay-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {canStart ? "Bắt đầu chơi →" : `Cần ít nhất ${MIN_PLAYERS_TO_START} người chơi`}
              </button>
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
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
