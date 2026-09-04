"use client";

import { useState } from "react";
import type { PublicRoomState, RoomConfig } from "@shared/types";
import { DEFAULT_ROOM_CONFIG, MIN_PLAYERS_TO_START } from "@shared/types";
import PlayerList from "./PlayerList";

interface Props {
  state: PublicRoomState;
  selfId: string;
  isHost: boolean;
  roomId: string;
  onStart: (config: RoomConfig) => void;
}

export default function Lobby({ state, selfId, isHost, roomId, onStart }: Props) {
  const [rounds, setRounds] = useState(DEFAULT_ROOM_CONFIG.rounds);
  const [drawSeconds, setDrawSeconds] = useState(DEFAULT_ROOM_CONFIG.drawSeconds);
  const [useVi, setUseVi] = useState(true);
  const [useEn, setUseEn] = useState(false);
  const [customWords, setCustomWords] = useState("");
  const [copied, setCopied] = useState(false);

  const connectedCount = state.players.filter((p) => p.connected).length;
  const canStart = connectedCount >= MIN_PLAYERS_TO_START;

  function handleCopyLink() {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleStart() {
    const wordlistIds = [useVi && "vi-default", useEn && "en-default"].filter(Boolean) as string[];
    const custom = customWords
      .split("\n")
      .map((w) => w.trim())
      .filter(Boolean);

    if (wordlistIds.length === 0 && custom.length < 20) {
      alert("Chọn ít nhất một bộ từ mặc định, hoặc nhập tối thiểu 20 từ tùy chỉnh.");
      return;
    }

    onStart({ rounds, drawSeconds, wordlistIds: wordlistIds.length ? wordlistIds : ["vi-default"], customWords: custom });
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-10 md:grid-cols-[1fr_320px]">
      <div className="rounded-2xl bg-white p-6 shadow-lg shadow-brand-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Phòng chờ</h2>
          <button
            onClick={handleCopyLink}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            {copied ? "Đã sao chép!" : `📋 Mã: ${roomId}`}
          </button>
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
                  Tiếng Việt (mặc định)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useEn} onChange={(e) => setUseEn(e.target.checked)} />
                  English (default)
                </label>
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
          <p className="text-slate-500">Đang chờ chủ phòng bắt đầu ván chơi...</p>
        )}
      </div>

      <PlayerList players={state.players} drawerId={null} selfId={selfId} />
    </div>
  );
}
