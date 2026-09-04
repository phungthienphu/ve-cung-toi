"use client";

import type { Player } from "@shared/types";

interface Props {
  players: Player[];
  drawerId: string | null;
  selfId: string;
  onKick?: (playerId: string) => void;
}

export default function PlayerList({ players, drawerId, selfId, onKick }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Người chơi ({players.length})
      </h3>
      {sorted.map((p) => (
        <div
          key={p.id}
          className={`group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${
            p.id === selfId ? "bg-brand-50" : ""
          } ${!p.connected ? "opacity-40" : ""}`}
        >
          <span className="flex items-center gap-1.5 truncate">
            {p.id === drawerId && "✏️"}
            {p.hasGuessedCorrectly && p.id !== drawerId && "✅"}
            {p.isHost && "👑"}
            <span className="truncate font-medium">{p.name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="font-semibold text-brand-600">{p.score}</span>
            {onKick && p.id !== selfId && (
              <button
                onClick={() => {
                  if (confirm(`Mời ${p.name} ra khỏi phòng?`)) onKick(p.id);
                }}
                title="Mời ra khỏi phòng"
                className="rounded px-1 text-slate-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
              >
                ✕
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
