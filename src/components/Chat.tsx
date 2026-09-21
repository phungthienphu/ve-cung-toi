"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatEntry } from "@shared/types";
import { playCorrect, playPop } from "@/lib/sound";
import { burstConfetti } from "@/lib/confetti";
import { drawFontClass } from "@/lib/drawFonts";

interface Props {
  entries: ChatEntry[];
  selfId: string;
  canGuess: boolean;
  onSend: (text: string) => void;
}

export default function Chat({ entries, selfId, canGuess, onSend }: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const lastSeenId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });

    const last = entries[entries.length - 1];
    const isFirstRender = lastSeenId.current === undefined;
    if (last && !isFirstRender && last.id !== lastSeenId.current && last.type === "correct") {
      playCorrect();
      burstConfetti();
    }
    lastSeenId.current = last ? last.id : null;
  }, [entries]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    playPop();
    onSend(trimmed);
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className={`${drawFontClass} flex h-full min-h-0 min-w-0 flex-col rounded-xl border border-cream-200 bg-white shadow-xl`}>
      <div ref={listRef} className="no-scrollbar min-w-0 flex-1 space-y-1.5 overflow-y-auto p-3 text-sm">
        {entries.map((entry) => {
          if (entry.type === "system") {
            return (
              <div key={entry.id} className="break-words text-center text-xs italic text-ink/40">
                {entry.text}
              </div>
            );
          }
          if (entry.type === "correct") {
            return (
              <div
                key={entry.id}
                className="animate-bounce-in mx-auto w-fit break-words rounded-full bg-sage-100 px-3 py-1 text-center font-semibold text-sage-600"
              >
                🎉 {entry.name} đã đoán đúng!
              </div>
            );
          }
          const isSelf = entry.playerId === selfId;
          return (
            <div
              key={entry.id}
              className={`w-fit max-w-[90%] break-words rounded-2xl rounded-bl-sm px-3 py-1.5 ${
                isSelf ? "ml-auto rounded-bl-2xl rounded-br-sm bg-clay-500/10 text-clay-700" : "bg-cream-50 text-ink/80"
              }`}
            >
              <span className="text-xs font-semibold text-ink/50">{entry.name}: </span>
              <span className="break-all">{entry.text}</span>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-cream-100 p-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={200}
          rows={1}
          placeholder={canGuess ? "Nhập câu đoán..." : "Nhắn tin..."}
          className="max-h-24 min-w-0 flex-1 resize-none rounded-lg border border-cream-200 px-3 py-2 text-sm outline-none transition focus:border-clay-500 focus:ring-1 focus:ring-clay-500"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-clay-500 px-3 py-2 text-sm font-medium text-white hover:bg-clay-600"
        >
          Gửi
        </button>
      </form>
    </div>
  );
}
