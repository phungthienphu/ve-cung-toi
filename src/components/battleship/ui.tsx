"use client";

import { useEffect, useRef, useState } from "react";
import type { BattleshipChatEntry, BattleshipPlayer, PublicBattleshipState, PublicBoard } from "@shared/battleshipTypes";

export const card = "rounded-lg border border-white/10 bg-slate-900/70 backdrop-blur-sm";
export const btnPrimary =
  "rounded-md bg-amber-400 px-4 py-2.5 font-bold text-slate-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40";
export const btnGhost =
  "rounded-md border border-white/15 px-3 py-2 text-sm text-sky-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";
export const TEAM_COLOR = { A: "text-sky-300", B: "text-rose-300" } as const;
export const TEAM_BG = { A: "bg-sky-500/15 border-sky-400/40", B: "bg-rose-500/15 border-rose-400/40" } as const;

export function playerName(state: PublicBattleshipState, id: string): string {
  return state.players.find((player) => player.id === id)?.name ?? "?";
}

export function boardOwnerLabel(state: PublicBattleshipState, board: PublicBoard): string {
  return board.team ? `Đội ${board.team === "A" ? "Xanh" : "Đỏ"}` : playerName(state, board.id);
}

export function shipsLeft(board: PublicBoard | undefined): number {
  return board ? board.shipsTotal - board.sunk.length : 0;
}

export function useCountdown(endsAt: number | null | undefined): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;
}

export function PlayerBadge({ player, suffix }: { player: BattleshipPlayer; suffix?: string }) {
  return (
    <span className="min-w-0 truncate">
      {player.name}
      {player.isHost ? " 👑" : ""}
      {!player.connected ? " 📡" : ""}
      {suffix ? <span className="text-sky-200/60"> {suffix}</span> : null}
    </span>
  );
}

export function ChatBox({
  entries,
  selfId,
  onSend,
  placeholder = "Nhắn gì đó…",
  empty = "Chưa có tin nhắn.",
}: {
  entries: BattleshipChatEntry[];
  selfId: string;
  onSend: (text: string) => void;
  placeholder?: string;
  empty?: string;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-2 text-sm">
        {entries.length === 0 && <p className="py-6 text-center text-xs text-sky-100/40">{empty}</p>}
        {entries.map((entry) =>
          entry.system ? (
            <p key={entry.id} className="text-center text-xs text-sky-100/50">{entry.text}</p>
          ) : (
            <p key={entry.id} className="break-words leading-snug">
              <span className={`font-semibold ${entry.playerId === selfId ? "text-amber-300" : "text-sky-300"}`}>{entry.playerName}: </span>
              <span className="text-sky-50">{entry.text}</span>
            </p>
          ),
        )}
      </div>
      <form
        className="flex gap-2 border-t border-white/10 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = text.trim();
          if (!value) return;
          onSend(value);
          setText("");
        }}
      >
        <input
          value={text}
          maxLength={200}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-sky-50 outline-none placeholder:text-sky-100/35 focus:border-amber-300"
        />
        <button type="submit" disabled={!text.trim()} className={btnGhost}>Gửi</button>
      </form>
    </div>
  );
}
