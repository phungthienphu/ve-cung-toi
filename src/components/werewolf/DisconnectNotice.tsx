"use client";

import { useEffect, useState } from "react";
import type { WerewolfPlayer } from "@shared/werewolfTypes";

// Public, explicit notice for everyone at the table: who dropped and how long
// they have to come back before they're quietly removed from the village.
export function DisconnectNotice({ players }: { players: WerewolfPlayer[] }) {
  const [now, setNow] = useState(Date.now());
  const offline = players.filter((player) => !player.connected && player.disconnectedUntil);

  useEffect(() => {
    if (offline.length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [offline.length]);

  if (offline.length === 0) return null;

  const secondsLeft = (player: WerewolfPlayer) => Math.max(0, Math.ceil(((player.disconnectedUntil ?? 0) - now) / 1000));

  // One box no matter how many people dropped, so a mass disconnect can't
  // stack a row per player and squeeze the game area — extra names wrap into
  // chips and the box itself is height-capped.
  if (offline.length === 1) {
    const [player] = offline;
    return (
      <div className="flex shrink-0 items-center gap-2 rounded-md border border-amber-400/40 bg-[var(--ww-warn-soft)] px-3 py-2 text-sm text-[var(--ww-warn)]">
        <span aria-hidden>📡</span>
        <span className="min-w-0 flex-1">
          <strong>{player.name}</strong> đã mất kết nối — còn <strong className="tabular-nums">{secondsLeft(player)}s</strong> để hồi sinh
        </span>
      </div>
    );
  }

  return (
    <div className="max-h-24 shrink-0 overflow-y-auto rounded-md border border-amber-400/40 bg-[var(--ww-warn-soft)] px-3 py-2 text-sm text-[var(--ww-warn)]">
      <div>
        <span aria-hidden>📡</span> <strong>{offline.length} người</strong> đã mất kết nối — mỗi người có 30s để hồi sinh
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {offline.map((player) => (
          <span key={player.id} className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs">
            {player.name} · <span className="font-bold tabular-nums">{secondsLeft(player)}s</span>
          </span>
        ))}
      </div>
    </div>
  );
}
