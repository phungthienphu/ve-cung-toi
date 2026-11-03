"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HILL_JEEP, HILL_MAPS, HILL_VEHICLES, type HillBoard, type HillSnapshot, type HillVehicleId, type HillWallet } from "@shared/hill/types";
import { fireworks } from "@/lib/confetti";
import { playMatchWin } from "@/lib/sound";
import { VehicleArt } from "./HillArt";
import { GameButton } from "./HillUi";
import { formatNumber } from "./hillUiData";

// End of a solo run, and the pause card. The run's number counts up, a new
// record gets fireworks, and the next car to unlock is always one tap away —
// the "one more go" loop.

function useCountUp(target: number, ms = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function HillResults({
  snapshot,
  best,
  newRecord,
  board,
  wallet,
  saveStatus,
  onRetry,
  onGarage,
}: {
  snapshot: HillSnapshot;
  /** The record before this run. */
  best: number;
  newRecord: boolean;
  board: HillBoard | null;
  wallet: HillWallet;
  saveStatus: string;
  onRetry: () => void;
  onGarage: () => void;
}) {
  const distance = Math.floor(snapshot.distance);
  const shown = useCountUp(distance);
  const celebrated = useRef(false);
  useEffect(() => {
    if (!newRecord || celebrated.current) return;
    celebrated.current = true;
    fireworks();
    playMatchWin();
  }, [newRecord]);
  const next = (Object.keys(HILL_VEHICLES) as HillVehicleId[])
    .filter((id) => !wallet.unlocked.includes(id))
    .sort((a, b) => HILL_VEHICLES[a].price - HILL_VEHICLES[b].price)[0];
  const picked = snapshot.coins - snapshot.skillCoins;

  return (
    <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/20 bg-emerald-950/95 text-center shadow-2xl landscape:grid landscape:max-w-2xl landscape:grid-cols-2 landscape:text-left">
      <div className="relative p-5 landscape:flex landscape:flex-col landscape:justify-center">
        {newRecord && (
          <p className="mx-auto mb-2 w-fit -rotate-2 rounded-lg bg-amber-400 px-3 py-1 font-draw-display text-sm font-extrabold text-emerald-950 shadow-lg landscape:mx-0">🚩 KỶ LỤC MỚI!</p>
        )}
        <p className="text-sm font-bold text-amber-200">{snapshot.finished === "overturned" ? "🙃 Chổng vó!" : "⛽ Hết xăng!"}</p>
        <p className="font-draw-display text-6xl font-extrabold leading-none tabular-nums sm:text-7xl">
          {formatNumber(shown)}
          <span className="ml-1 text-2xl">m</span>
        </p>
        <p className="mt-1 text-sm text-emerald-100/80">
          {HILL_VEHICLES[snapshot.vehicle].name} · {HILL_MAPS[snapshot.map].name}
        </p>
        <p className="mt-2 text-sm font-semibold">
          {newRecord
            ? best > 0
              ? `Hơn kỷ lục cũ ${formatNumber(distance - best)} m`
              : "Lá cờ đầu tiên của bạn!"
            : best > 0
              ? `Kỷ lục ${formatNumber(best)} m · còn thiếu ${formatNumber(best - distance + 1)} m`
              : ""}
        </p>
        <p className="mt-1 text-xs text-emerald-100/60">{board?.personal ? `Hạng #${board.personal.rank} trên bảng xếp hạng` : saveStatus || "Đang cập nhật hạng…"}</p>
      </div>

      <div className="space-y-3 bg-black/20 p-5">
        <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-2.5">
          <span className="text-sm text-emerald-100/80">
            Xu kiếm được
            <span className="block text-[11px] text-emerald-100/50">
              nhặt {formatNumber(picked)} · kỹ năng {formatNumber(snapshot.skillCoins)}
            </span>
          </span>
          <span className="font-draw-display text-2xl font-extrabold text-amber-300">+{formatNumber(snapshot.coins)}</span>
        </div>
        {next && (
          <button onClick={onGarage} className="flex w-full items-center gap-3 rounded-2xl bg-white/5 px-3 py-2 text-left transition hover:bg-white/10">
            <VehicleArt vehicle={next} width={64} height={36} locked={wallet.coins < HILL_VEHICLES[next].price} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">
                {wallet.coins >= HILL_VEHICLES[next].price
                  ? `🎉 Đủ xu mở ${HILL_VEHICLES[next].name}!`
                  : `Còn ${formatNumber(HILL_VEHICLES[next].price - wallet.coins)} xu để mở ${HILL_VEHICLES[next].name}`}
              </span>
              <span className="mt-1 block h-2 overflow-hidden rounded-full bg-white/15">
                <span className="block h-full rounded-full bg-amber-300" style={{ width: `${Math.min(100, (wallet.coins / HILL_VEHICLES[next].price) * 100)}%` }} />
              </span>
            </span>
          </button>
        )}
        <GameButton onClick={onRetry} className="w-full py-3 text-2xl" autoFocus>
          ↻ Chạy lại
        </GameButton>
        <div className="flex gap-2">
          <GameButton tone="glass" onClick={onGarage} className="flex-1 py-2.5 text-base">
            🚙 Đổi xe / đường
          </GameButton>
          <Link href="/" className="flex items-center rounded-2xl px-3 text-sm font-semibold text-emerald-100/70 hover:text-white">
            Trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HillPause({ onResume, onRetry, onGarage }: { onResume: () => void; onRetry: () => void; onGarage: () => void }) {
  return (
    <div className="w-full max-w-sm rounded-[28px] border border-white/20 bg-emerald-950/95 p-5 text-center shadow-2xl landscape:max-w-lg">
      <h2 className="font-draw-display text-3xl font-extrabold">⏸ Tạm dừng</h2>
      <dl className="my-4 grid grid-cols-2 gap-2 text-left text-xs">
        {[
          ["Ga / Phanh", "→ D  ·  ← A"],
          ["Nhảy · bật lật", "↑ W · 35⚡"],
          ["Lao tới", "Space · 25⚡"],
          ["Lật ngửa", `${HILL_JEEP.overturnSeconds} giây để cứu xe`],
        ].map(([label, keys]) => (
          <div key={label} className="rounded-xl bg-white/5 px-3 py-2">
            <dt className="font-bold text-amber-200">{label}</dt>
            <dd className="mt-0.5 text-emerald-100/80">{keys}</dd>
          </div>
        ))}
      </dl>
      <GameButton onClick={onResume} className="w-full py-3 text-xl" autoFocus>
        ▶ Tiếp tục
      </GameButton>
      <div className="mt-2 flex gap-2">
        <GameButton tone="glass" onClick={onRetry} className="flex-1 py-2 text-sm">
          ↻ Chạy lại
        </GameButton>
        <GameButton tone="glass" onClick={onGarage} className="flex-1 py-2 text-sm">
          🚙 Về garage
        </GameButton>
      </div>
    </div>
  );
}
