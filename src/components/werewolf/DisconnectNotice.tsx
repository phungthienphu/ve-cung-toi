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

  return (
    <div className="shrink-0 space-y-1.5">
      {offline.map((player) => {
        const seconds = Math.max(0, Math.ceil(((player.disconnectedUntil ?? 0) - now) / 1000));
        return (
          <div key={player.id} className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-[var(--ww-warn-soft)] px-3 py-2 text-sm text-[var(--ww-warn)]">
            <span aria-hidden>📡</span>
            <span className="min-w-0 flex-1">
              <strong>{player.name}</strong> đã mất kết nối — còn <strong className="tabular-nums">{seconds}s</strong> để hồi sinh
            </span>
          </div>
        );
      })}
    </div>
  );
}
