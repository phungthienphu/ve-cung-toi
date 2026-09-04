"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatEntry } from "@shared/types";

interface Props {
  entries: ChatEntry[];
  selfId: string;
  canGuess: boolean;
  onSend: (text: string) => void;
}

export default function Chat({ entries, selfId, canGuess, onSend }: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [entries]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl bg-white shadow-sm">
      <div ref={listRef} className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto p-3 text-sm">
        {entries.map((entry) => {
          if (entry.type === "system") {
            return (
              <div key={entry.id} className="text-center text-xs italic text-slate-400">
                {entry.text}
              </div>
            );
          }
          if (entry.type === "correct") {
            return (
              <div key={entry.id} className="font-medium text-emerald-600">
                🎉 {entry.name} đã đoán đúng!
              </div>
            );
          }
          const isSelf = entry.playerId === selfId;
          return (
            <div key={entry.id} className={isSelf ? "text-brand-700" : "text-slate-700"}>
              <span className="font-semibold">{entry.name}: </span>
              <span>{entry.text}</span>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-100 p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder={canGuess ? "Nhập câu đoán..." : "Nhắn tin..."}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Gửi
        </button>
      </form>
    </div>
  );
}
