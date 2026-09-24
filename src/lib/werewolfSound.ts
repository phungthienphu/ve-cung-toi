"use client";

// Werewolf's audio: real files under /ma-soi/sound (looping ambience per time
// of day + one-shot stingers), independent of the synthesized UI sounds in
// sound.ts. Everything respects the global mute toggle, and browsers that
// block autoplay simply get the track started on the first tap instead.

import { useEffect, useRef } from "react";
import type { PublicWerewolfState } from "@shared/werewolfTypes";
import { isMuted, MUTE_CHANGE_EVENT } from "@/lib/sound";

const BASE = "/ma-soi/sound";
const TRACKS = {
  lobby: { src: `${BASE}/nhac-ngoai-sanh.mp3`, volume: 0.35 },
  night: { src: `${BASE}/ban-dem.mp3`, volume: 0.4 },
  day: { src: `${BASE}/ban-ngay.mp3`, volume: 0.3 },
} as const;
const STINGERS = {
  wolfHowl: { src: `${BASE}/soi-hu.mp3`, volume: 0.7 },
  execution: { src: `${BASE}/dan-lang-xu-ban.mp3`, volume: 0.8 },
  endGame: { src: `${BASE}/end-game.mp3`, volume: 0.7 },
} as const;

type TrackName = keyof typeof TRACKS;
type StingerName = keyof typeof STINGERS;

const FADE_MS = 700;

function fadeTo(el: HTMLAudioElement, target: number, onDone?: () => void) {
  const from = el.volume;
  const start = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - start) / FADE_MS);
    el.volume = Math.max(0, Math.min(1, from + (target - from) * t));
    if (t < 1) requestAnimationFrame(step);
    else onDone?.();
  };
  requestAnimationFrame(step);
}

function sceneFor(state: PublicWerewolfState): TrackName | null {
  switch (state.phase) {
    case "lobby":
      return "lobby";
    case "roleReveal":
    case "nightExplore":
    case "wolfLock":
    case "nightResolve":
      return "night";
    case "dawn":
    case "discussion":
    case "voting":
    case "voteResult":
      return "day";
    case "gameEnd":
      return null;
  }
}

function eliminatedByVote(state: PublicWerewolfState): boolean {
  const top = state.lastVoteResult[0];
  return Boolean(top) && state.lastVoteResult.filter((r) => r.votes === top.votes).length === 1;
}

/** Drives the whole soundtrack from the public game state. Mount once in the
 * game room; it cleans up (stops everything) on unmount. */
export function useWerewolfSound(state: PublicWerewolfState | null) {
  const current = useRef<{ name: TrackName; el: HTMLAudioElement } | null>(null);
  const wantedRef = useRef<TrackName | null>(null);
  const stingerEls = useRef<HTMLAudioElement[]>([]);
  const lastStingerKey = useRef<string>("");

  const phase = state?.phase ?? null;
  const day = state?.day ?? 0;
  const deaths = state?.nightDeaths.length ?? 0;
  const voteKilled = state ? eliminatedByVote(state) : false;

  function stopCurrent() {
    const prev = current.current;
    current.current = null;
    if (!prev) return;
    fadeTo(prev.el, 0, () => prev.el.pause());
  }

  function startTrack(name: TrackName | null) {
    wantedRef.current = name;
    if (isMuted() || !name) {
      stopCurrent();
      return;
    }
    if (current.current?.name === name) {
      const { el } = current.current;
      if (el.paused) el.play().then(() => fadeTo(el, TRACKS[name].volume)).catch(() => {});
      return;
    }
    stopCurrent();
    const cfg = TRACKS[name];
    const el = new Audio(cfg.src);
    el.loop = true;
    el.volume = 0;
    current.current = { name, el };
    el.play().then(() => fadeTo(el, cfg.volume)).catch(() => {
      // Autoplay blocked — retried by the gesture listener below.
    });
  }

  function playStinger(name: StingerName) {
    if (isMuted()) return;
    const cfg = STINGERS[name];
    const el = new Audio(cfg.src);
    el.volume = cfg.volume;
    stingerEls.current.push(el);
    el.addEventListener("ended", () => {
      stingerEls.current = stingerEls.current.filter((x) => x !== el);
    });
    el.play().catch(() => {});
    // Ambience ducks under a stinger so the howl/verdict actually lands.
    const music = current.current;
    if (music) {
      const base = TRACKS[music.name].volume;
      fadeTo(music.el, base * 0.25);
      el.addEventListener("ended", () => {
        if (current.current?.el === music.el) fadeTo(music.el, base);
      });
    }
  }

  // Scene changes → ambience.
  useEffect(() => {
    if (!state) return;
    startTrack(sceneFor(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // One-shot stingers, keyed so a re-render never replays them.
  useEffect(() => {
    if (!phase) return;
    const key = `${phase}:${day}`;
    if (lastStingerKey.current === key) return;
    lastStingerKey.current = key;
    if (phase === "dawn" && deaths > 0) playStinger("wolfHowl");
    else if (phase === "voteResult" && voteKilled) playStinger("execution");
    else if (phase === "gameEnd") playStinger("endGame");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, day]);

  // Mute toggle + autoplay-unlock on first interaction.
  useEffect(() => {
    const onMuteChange = () => {
      if (isMuted()) {
        stopCurrent();
        for (const el of stingerEls.current) el.pause();
        stingerEls.current = [];
      } else {
        startTrack(wantedRef.current);
      }
    };
    const onGesture = () => {
      if (!isMuted() && wantedRef.current) startTrack(wantedRef.current);
    };
    window.addEventListener(MUTE_CHANGE_EVENT, onMuteChange);
    window.addEventListener("pointerdown", onGesture);
    return () => {
      window.removeEventListener(MUTE_CHANGE_EVENT, onMuteChange);
      window.removeEventListener("pointerdown", onGesture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stingers = stingerEls.current;
    return () => {
      current.current?.el.pause();
      current.current = null;
      for (const el of stingers) el.pause();
    };
  }, []);
}
