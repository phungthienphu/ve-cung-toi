"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isMuted, setMuted, toggleMusic } from "@/lib/sound";

export default function SoundToggle() {
  const [muted, setMutedState] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  // Werewolf ships its own real soundtrack, so the generic synth-chime button
  // would only be a confusing second "music" control there.
  const pathname = usePathname();
  const inWerewolf = pathname.startsWith("/werewolf");
  // The Math Quest notebook and the tutor's pages play no sounds; the floating
  // buttons would only cover their bottom buttons on a phone.
  const inMathQuest = pathname.startsWith("/math-quest");
  // Ai Là Heo rooms put your hand along the bottom; sound is in the room's ⚙️ settings.
  const inOldMaidRoom = /^\/ai-la-heo\/[^/]+/.test(pathname);

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

  if (inMathQuest || inOldMaidRoom) return null;
  return (
    <div className="fixed bottom-4 right-4 z-40 flex gap-2">
      {!muted && !inWerewolf && (
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
