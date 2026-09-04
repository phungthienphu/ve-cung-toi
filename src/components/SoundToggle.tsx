"use client";

import { useEffect, useState } from "react";
import { isMuted, setMuted, toggleMusic } from "@/lib/sound";

export default function SoundToggle() {
  const [muted, setMutedState] = useState(true);
  const [musicOn, setMusicOn] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  function handleMuteToggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (next) setMusicOn(false);
  }

  function handleMusicToggle() {
    if (muted) return;
    setMusicOn(toggleMusic());
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex gap-2">
      {!muted && (
        <button
          onClick={handleMusicToggle}
          title={musicOn ? "Tắt nhạc nền" : "Bật nhạc nền"}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-lg shadow-md backdrop-blur transition hover:scale-105"
        >
          {musicOn ? "🎵" : "🎶"}
        </button>
      )}
      <button
        onClick={handleMuteToggle}
        title={muted ? "Bật âm thanh" : "Tắt âm thanh"}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-lg shadow-md backdrop-blur transition hover:scale-105"
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </div>
  );
}
