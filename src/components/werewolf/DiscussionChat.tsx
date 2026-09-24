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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--ww-border)] bg-[var(--ww-surface-strong)]">
      <div ref={listRef} className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--ww-text-faint)]">{content.emptyChat}</p>
        ) : entries.map((entry) => (
          <ChatBubble key={entry.id} entry={entry} isSelf={entry.playerId === selfId} />
        ))}
      </div>

      <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t border-[var(--ww-border)] bg-[var(--ww-surface-soft)] p-3">
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
          className="max-h-24 min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] px-3 py-2 text-sm text-[var(--ww-text)] outline-none placeholder:text-[var(--ww-text-faint)] focus:border-[var(--ww-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend || !text.trim()}
          className="rounded-xl bg-[var(--ww-accent-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ww-accent-ink)] transition hover:opacity-90 disabled:opacity-30"
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
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-left ${isSelf ? "rounded-br-sm bg-[var(--ww-accent-soft)]" : "rounded-bl-sm bg-[var(--ww-surface-soft)]"}`}>
        <div className={`mb-0.5 text-[11px] font-semibold ${isSelf ? "text-[var(--ww-accent)]" : "text-[var(--ww-text-muted)]"}`}>
          {entry.playerName}
        </div>
        <p className="break-words text-sm leading-5 text-[var(--ww-text)]">{entry.text}</p>
      </div>
    </div>
  );
}

