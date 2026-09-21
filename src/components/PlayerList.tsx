"use client";

import type { Player } from "@shared/types";
import { drawFontClass } from "@/lib/drawFonts";

interface Props {
  players: Player[];
  drawerId: string | null;
  selfId: string;
  onKick?: (playerId: string) => void;
}

// Cycled by each player's position in the room's player map (insertion
// order), not by id hash — good enough to tell players apart at a glance
// without needing per-player color state anywhere.
const AVATAR_COLORS = ["bg-clay-500", "bg-sage-500", "bg-gold-500", "bg-[#8b6fae]", "bg-[#4a90a4]"];

export default function PlayerList({ players, drawerId, selfId, onKick }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className={`${drawFontClass} flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl border border-cream-200 bg-white p-3 shadow-xl`}>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/40">
        Người chơi ({players.length})
      </h3>
      {sorted.map((p, i) => (
        <div
          key={p.id}
          className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
            p.id === selfId ? "bg-clay-500/10" : ""
          } ${!p.connected ? "opacity-40" : ""}`}
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-draw-display text-xs font-bold text-white ${
              AVATAR_COLORS[i % AVATAR_COLORS.length]
            }`}
          >
            {p.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
            {p.id === drawerId && "✏️"}
            {p.hasGuessedCorrectly && p.id !== drawerId && <span className="text-sage-600">✓</span>}
            {p.isHost && "👑"}
            <span className="truncate font-medium text-ink">{p.name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="font-draw-display font-semibold text-clay-600">{p.score}</span>
            {onKick && p.id !== selfId && (
              <button
                onClick={() => {
                  if (confirm(`Mời ${p.name} ra khỏi phòng?`)) onKick(p.id);
                }}
                title="Mời ra khỏi phòng"
                className="rounded px-1 text-ink/30 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
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
