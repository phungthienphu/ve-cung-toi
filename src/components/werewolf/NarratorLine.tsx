"use client";

import { useEffect, useState } from "react";
import type { PublicWerewolfState } from "@shared/werewolfTypes";
import { isSfxBusy, playTypeTick } from "@/lib/sound";
import { isStingerPlaying } from "@/lib/werewolfSound";
import { narrationFor } from "./narration";

const MAX_TYPING_MS = 3500;
const MAX_CHAR_MS = 28;
const TICK_EVERY_CHARS = 3;
// A touch quieter than a real keystroke (0.025) but still audible over the music.
const NARRATOR_TICK_GAIN = 0.02;

// The narrator's caption for the current scene. Text only (no voice), the same
// line on every device — see narration.ts. Each new line is "typed" out with a
// soft keystroke sound, like a storyteller writing it as you watch.
export function NarratorLine({ state }: { state: PublicWerewolfState }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const line = narrationFor(state, now);
  if (!line) return null;

  return (
    <div className="shrink-0 rounded-md border border-[var(--ww-border)] bg-[var(--ww-surface)] px-4 py-2.5 shadow-lg backdrop-blur-md">
      <TypedLine key={line} text={line} />
    </div>
  );
}

function TypedLine({ text }: { text: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const perChar = Math.min(MAX_CHAR_MS, MAX_TYPING_MS / text.length);
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      setShown(count);
      if (count % TICK_EVERY_CHARS === 0 && text[count - 1] !== " " && !isStingerPlaying() && !isSfxBusy()) playTypeTick(NARRATOR_TICK_GAIN);
      if (count >= text.length) clearInterval(timer);
    }, perChar);
    return () => clearInterval(timer);
  }, [text]);

  // The full quote is rendered invisibly underneath so the box keeps its final
  // height while the visible copy types over it (no layout jump per character).
  const quote = `“${text}”`;
  return (
    <p className="flex items-start gap-2 text-sm italic leading-relaxed text-[var(--ww-text-muted)]">
      <span aria-hidden className="not-italic">🎙️</span>
      <span className="relative" aria-label={text}>
        <span className="invisible" aria-hidden>{quote}</span>
        <span className="absolute inset-0" aria-hidden>{quote.slice(0, shown + 1)}</span>
      </span>
    </p>
  );
}
