"use client";

// Lightweight sound effects synthesized with the Web Audio API — no external
// audio files to download/license. Kept dependency-free so this module works
// the same in dev and on Vercel with zero asset pipeline.

const MUTE_KEY = "vct_muted";

let ctx: AudioContext | null = null;
let musicNodes: { stop: () => void } | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  if (muted) stopMusic();
}

function tone(freq: number, startOffset: number, duration: number, gainPeak = 0.15, type: OscillatorType = "sine") {
  const audio = getCtx();
  if (!audio || isMuted()) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = audio.currentTime + startOffset;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Soft UI click — for buttons like "Tạo phòng", "Vào phòng", "Bắt đầu". */
export function playClick() {
  tone(720, 0, 0.08, 0.08, "triangle");
}

/** Short two-note "pop" for lighter interactions (choosing a word, sending chat). */
export function playPop() {
  tone(500, 0, 0.06, 0.06, "sine");
}

/** Cheerful ascending arpeggio for a correct guess. */
export function playCorrect() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.07, 0.25, 0.12, "triangle"));
}

/** A little chime when someone joins the room. */
export function playJoin() {
  [440, 660].forEach((f, i) => tone(f, i * 0.06, 0.18, 0.07, "sine"));
}

/** A soft "aww" descending tone for round timeout / wrong-ish moments. */
export function playWhoosh() {
  const audio = getCtx();
  if (!audio || isMuted()) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sawtooth";
  const t0 = audio.currentTime;
  osc.frequency.setValueAtTime(300, t0);
  osc.frequency.exponentialRampToValueAtTime(80, t0 + 0.3);
  gain.gain.setValueAtTime(0.06, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + 0.35);
}

/**
 * Gentle looping background chime — a slow pentatonic arpeggio at very low
 * volume. This is a generated ambient loop, not a licensed music track; swap
 * in a real <audio> file later if you get one you're cleared to use.
 */
export function startMusic() {
  const audio = getCtx();
  if (!audio || isMuted() || musicNodes) return;

  const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66];
  const noteLength = 0.9;
  let stopped = false;
  let stepTimer: ReturnType<typeof setTimeout> | null = null;

  function playStep(i: number) {
    if (stopped) return;
    const freq = notes[i % notes.length];
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t0 = audio!.currentTime;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.035, t0 + 0.2);
    gain.gain.linearRampToValueAtTime(0, t0 + noteLength);
    osc.connect(gain);
    gain.connect(audio!.destination);
    osc.start(t0);
    osc.stop(t0 + noteLength + 0.05);
    stepTimer = setTimeout(() => playStep(i + 1), noteLength * 1000);
  }
  playStep(0);

  musicNodes = {
    stop: () => {
      stopped = true;
      if (stepTimer) clearTimeout(stepTimer);
    },
  };
}

export function stopMusic() {
  musicNodes?.stop();
  musicNodes = null;
}

export function toggleMusic(): boolean {
  if (musicNodes) {
    stopMusic();
    return false;
  }
  startMusic();
  return true;
}
