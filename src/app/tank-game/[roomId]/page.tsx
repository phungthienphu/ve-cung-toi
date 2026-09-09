"use client";

import { use, useEffect, useState } from "react";
import { getOrCreatePlayerId, getStoredName, setStoredName } from "@/lib/player";
import { playClick } from "@/lib/sound";
import { TANK_COLORS, TANK_SKINS, TANK_SKIN_LABELS } from "@shared/tankTypes";
import TankGameRoom from "@/components/tank/TankGameRoom";
import TankPreview from "@/components/tank/TankPreview";

export default function TankRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(TANK_COLORS[0]);

  useEffect(() => {
    setPlayerId(getOrCreatePlayerId());
    setName(getStoredName());
    if (sessionStorage.getItem(`vct_tank_confirmed:${roomId}`) === "1") {
      const savedColor = sessionStorage.getItem(`vct_tank_color:${roomId}`);
      if (savedColor) setColor(savedColor);
      setReady(true);
    }
  }, [roomId]);

  if (!playerId) return null;

  function confirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    playClick();
    setStoredName(trimmed);
    sessionStorage.setItem(`vct_tank_confirmed:${roomId}`, "1");
    sessionStorage.setItem(`vct_tank_color:${roomId}`, color);
    setName(trimmed);
    setReady(true);
  }

  if (!ready) {
    return (
      <main className="flex min-h-app items-center justify-center bg-tank-scene px-4">
        <div className="w-full max-w-sm rounded-xl border border-cream-200 bg-white p-8 shadow-xl">
          <h1 className="mb-1 text-xl font-bold text-ink">Vào phòng đại chiến</h1>
          <p className="mb-5 font-mono text-sm tracking-wider text-ink/40">{roomId}</p>

          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink/50">Tên hiển thị</label>
          <input
            autoFocus
            className="mb-5 w-full rounded-lg border border-cream-200 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            placeholder="Ví dụ: Phú"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
          />

          <div className="mb-5 rounded-lg bg-slate-50 py-2">
            <TankPreview color={color} />
          </div>

          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink/50">Loại xe tăng</label>
          <div className="mb-6 grid grid-cols-4 gap-2">
            {TANK_COLORS.map((c, i) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-1.5 transition ${
                  color === c ? "border-slate-800 bg-slate-50" : "border-transparent hover:border-slate-200"
                }`}
                aria-label={TANK_SKIN_LABELS[TANK_SKINS[i]]}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/Retina/tank_${TANK_SKINS[i]}.png`} alt="" className="h-9 w-9 object-contain" />
                <span className="truncate text-[10px] font-medium text-ink/60">{TANK_SKIN_LABELS[TANK_SKINS[i]]}</span>
              </button>
            ))}
          </div>

          <button
            onClick={confirm}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
          >
            Vào phòng
            <span aria-hidden>→</span>
          </button>
        </div>
      </main>
    );
  }

  return <TankGameRoom roomId={roomId} playerId={playerId} name={name} color={color} />;
}
