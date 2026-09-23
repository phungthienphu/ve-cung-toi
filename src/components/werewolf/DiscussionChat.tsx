"use client";

import { useEffect, useRef, useState } from "react";
import type { WerewolfChatEntry } from "@shared/werewolfTypes";
import { GAME_CONTENT } from "./gameContent";

interface DiscussionChatProps {
  entries: WerewolfChatEntry[];
  selfId: string;
  canSend: boolean;
  onSend: (text: string) => void;
}

export function DiscussionChat({ entries, selfId, canSend, onSend }: DiscussionChatProps) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const content = GAME_CONTENT.discussion;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || !canSend) return;
    onSend(message);
    setText("");
  };

  return (
    <div className="flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55">
      <div ref={listRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
        {entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">{content.emptyChat}</p>
        ) : entries.map((entry) => (
          <ChatBubble key={entry.id} entry={entry} isSelf={entry.playerId === selfId} />
        ))}
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-white/10 bg-slate-900/80 p-3">
        <textarea
          value={text}
          disabled={!canSend}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) submit(event);
          }}
          rows={1}
          maxLength={300}
          placeholder={canSend ? content.inputPlaceholder : content.deadInputPlaceholder}
          className="max-h-24 min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend || !text.trim()}
          className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold disabled:opacity-30"
        >
          {content.sendButton}
        </button>
      </form>
    </div>
  );
}

function ChatBubble({ entry, isSelf }: { entry: WerewolfChatEntry; isSelf: boolean }) {
  return (
    <div className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-left ${isSelf ? "rounded-br-sm bg-violet-500/25" : "rounded-bl-sm bg-white/10"}`}>
        <div className={`mb-0.5 text-[11px] font-semibold ${isSelf ? "text-violet-200" : "text-slate-400"}`}>
          {entry.playerName}
        </div>
        <p className="break-words text-sm leading-5 text-slate-100">{entry.text}</p>
      </div>
    </div>
  );
}

