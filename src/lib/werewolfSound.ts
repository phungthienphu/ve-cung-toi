"use client";

// Werewolf's audio: real files under /ma-soi/sound (looping ambience per time
// of day + one-shot stingers), independent of the synthesized UI sounds in
// sound.ts. Everything respects the global mute toggle, and browsers that
// block autoplay simply get the track started on the first tap instead.

import { useEffect, useRef } from "react";
import type { PublicWerewolfState } from "@shared/werewolfTypes";
import { getAudioContext, isMuted, MUTE_CHANGE_EVENT, playNightFall } from "@/lib/sound";

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

// One-shot stingers (howl, verdict, game over) are decoded once and played
// through Web Audio — the same path as the UI ticks. Plain <audio>.play() calls
// that start on their own (a phase change, not a tap) get blocked by browser
// autoplay rules, which is why these used to go silent unless triggered by a
// button. The narrator's typing ticks stay quiet while one is sounding.
const stingerBuffers = new Map<string, Promise<AudioBuffer | null>>();
const liveStingers = new Set<AudioBufferSourceNode>();

export function isStingerPlaying(): boolean {
  return liveStingers.size > 0;
}

function loadStinger(src: string): Promise<AudioBuffer | null> {
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve(null);
  let pending = stingerBuffers.get(src);
  if (!pending) {
    pending = fetch(src)
      .then((response) => response.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null);
    stingerBuffers.set(src, pending);
  }
  return pending;
}

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

function stingerFor(state: PublicWerewolfState): StingerName | null {
  if (state.phase === "dawn" && state.nightDeaths.length > 0) return "wolfHowl";
  if (state.phase === "voteResult" && eliminatedByVote(state)) return "execution";
  if (state.phase === "gameEnd") return "endGame";
  return null;
}

/** Human-readable "what plays in this scene" — used by the design preview. */
export function describeWerewolfSound(state: PublicWerewolfState): string {
  const scene = sceneFor(state);
  const stinger = stingerFor(state);
  const parts = [scene ? `🎵 ${TRACKS[scene].src.split("/").pop()}` : "🔇 không nhạc nền"];
  if (stinger) parts.push(`✨ ${STINGERS[stinger].src.split("/").pop()}`);
  return parts.join("  +  ");
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

  const lastStingerKey = useRef<string>("");
  // A stinger the browser refused to autoplay; replayed on the next tap/key if
  // that happens soon enough for it to still make sense.
  const blockedStinger = useRef<{ name: StingerName; at: number } | null>(null);

  const phase = state?.phase ?? null;
  const day = state?.day ?? 0;

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

  async function playStinger(name: StingerName) {
    if (isMuted()) return;
    const cfg = STINGERS[name];
    const ctx = getAudioContext();
    if (!ctx) return;
    const buffer = await loadStinger(cfg.src);
    if (!buffer || isMuted()) return;
    if (ctx.state !== "running") await ctx.resume().catch(() => {});
    if (ctx.state !== "running") {
      // Still no user gesture on this page — retry on the first tap/key.
      blockedStinger.current = { name, at: Date.now() };
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = cfg.volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    liveStingers.add(source);
    // Ambience ducks under a stinger so the howl/verdict actually lands.
    const music = current.current;
    const base = music ? TRACKS[music.name].volume : 0;
    if (music) fadeTo(music.el, base * 0.25);
    source.onended = () => {
      liveStingers.delete(source);
      if (music && current.current?.el === music.el) fadeTo(music.el, base);
    };
    source.start();
  }

  function stopStingers() {
    for (const source of [...liveStingers]) {
      try {
        source.stop();
      } catch {
        // already ended
      }
    }
    liveStingers.clear();
  }

  // Decode the stinger files up front so they can fire the instant a phase starts.
  useEffect(() => {
    for (const cfg of Object.values(STINGERS)) void loadStinger(cfg.src);
  }, []);

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
    if (phase === "nightExplore") playNightFall();
    const stinger = state ? stingerFor(state) : null;
    if (stinger) playStinger(stinger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, day]);

  // Mute toggle + autoplay-unlock on first interaction.
  useEffect(() => {
    const onMuteChange = () => {
      if (isMuted()) {
        stopCurrent();
        stopStingers();
      } else {
        startTrack(wantedRef.current);
      }
    };
    const onGesture = () => {
      if (isMuted()) return;
      if (wantedRef.current) startTrack(wantedRef.current);
      const blocked = blockedStinger.current;
      blockedStinger.current = null;
      if (blocked && Date.now() - blocked.at < 10_000) playStinger(blocked.name);
    };
    window.addEventListener(MUTE_CHANGE_EVENT, onMuteChange);
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener(MUTE_CHANGE_EVENT, onMuteChange);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      current.current?.el.pause();
      current.current = null;
      stopStingers();
    };
  }, []);

  // Restart this scene's ambience and stinger on demand (design preview).
  return {
    replay: () => {
      if (!state) return;
      startTrack(sceneFor(state));
      const stinger = stingerFor(state);
      if (stinger) playStinger(stinger);
    },
  };
}
