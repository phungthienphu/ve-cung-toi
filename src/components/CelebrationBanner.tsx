"use client";

import { useEffect, useState } from "react";
import { celebrationFireworks } from "@/lib/confetti";
import { drawFontClass } from "@/lib/drawFonts";

export interface CelebrationBannerProps {
  /** sessionStorage key; use a new one per occasion so each greeting shows on its own. */
  storageKey: string;
  title: string;
  description: string;
  emoji?: string;
  buttonLabel?: string;
  /** First / last local day ("YYYY-MM-DD") to show it — outside that it stays hidden without a code change. */
  from?: string;
  until?: string;
}

const localDay = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const DECOR = [
  { emoji: "🌸", className: "left-4 top-6 text-3xl", delay: "0s" },
  { emoji: "🌷", className: "right-5 top-10 text-3xl", delay: "0.6s" },
  { emoji: "✨", className: "left-8 bottom-24 text-2xl", delay: "1.1s" },
  { emoji: "💖", className: "right-8 bottom-28 text-2xl", delay: "0.3s" },
];

// A festive greeting that pops up once per browser session (a new tab or a
// reopened browser shows it again; navigating around the site doesn't),
// with a fireworks show behind it. Rendered from the root layout.
export default function CelebrationBanner({ storageKey, title, description, emoji = "💐", buttonLabel = "Cảm ơn nha! 💖", from, until }: CelebrationBannerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const today = localDay();
    if ((from && today < from) || (until && today > until)) return;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      // Marked as soon as it shows, so a reload mid-greeting doesn't replay it.
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Storage blocked (private mode): just show it on this load.
    }
    setOpen(true);
  }, [storageKey, from, until]);

  useEffect(() => {
    if (!open) return;
    const stop = celebrationFireworks();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      stop();
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`${drawFontClass} fixed inset-0 z-[150] flex items-center justify-center bg-[#3b0a2a]/55 p-4 backdrop-blur-sm`}
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
        onClick={(event) => event.stopPropagation()}
        className="celebration-pop relative w-full max-w-md rounded-[2rem] bg-gradient-to-br from-rose-500 via-pink-500 to-amber-400 p-1.5 shadow-[0_30px_80px_-20px_rgba(244,63,94,0.85)]"
      >
        <div className="relative overflow-hidden rounded-[1.65rem] bg-gradient-to-b from-white to-rose-50 px-6 pb-6 pt-14 text-center">
          {DECOR.map((item) => (
            <span key={item.emoji} aria-hidden className={`celebration-float pointer-events-none absolute ${item.className}`} style={{ animationDelay: item.delay }}>
              {item.emoji}
            </span>
          ))}
          <button
            onClick={() => setOpen(false)}
            aria-label="Đóng"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-lg text-rose-300 transition hover:bg-rose-100 hover:text-rose-500"
          >
            ✕
          </button>

          <h2 id="celebration-title" className="celebration-shimmer font-draw-display text-3xl font-extrabold leading-tight sm:text-4xl">
            {title}
          </h2>
          <p className="mx-auto mt-3 max-w-sm leading-relaxed text-ink/75">{description}</p>
          <button
            onClick={() => setOpen(false)}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 py-3.5 font-draw-display text-lg font-extrabold text-white shadow-lg shadow-rose-500/40 transition hover:brightness-110 active:scale-[0.98]"
          >
            {buttonLabel}
          </button>
        </div>
        <span
          aria-hidden
          className="celebration-float absolute -top-10 left-1/2 -ml-10 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-rose-400 to-pink-500 text-5xl shadow-xl"
        >
          {emoji}
        </span>
      </div>
    </div>
  );
}
