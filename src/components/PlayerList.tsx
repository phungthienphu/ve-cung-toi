"use client";

import type { Player } from "@shared/types";

interface Props {
  players: Player[];
  drawerId: string | null;
  selfId: string;
}

export default function PlayerList({ players, drawerId, selfId }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-white p-3 shadow-sm">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Người chơi ({players.length})
      </h3>
      {sorted.map((p) => (
        <div
          key={p.id}
          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${
            p.id === selfId ? "bg-brand-50" : ""
          } ${!p.connected ? "opacity-40" : ""}`}
        >
          <span className="flex items-center gap-1.5 truncate">
            {p.id === drawerId && "✏️"}
            {p.hasGuessedCorrectly && p.id !== drawerId && "✅"}
            {p.isHost && "👑"}
            <span className="truncate font-medium">{p.name}</span>
          </span>
          <span className="shrink-0 font-semibold text-brand-600">{p.score}</span>
        </div>
      ))}
    </div>
  );
}
