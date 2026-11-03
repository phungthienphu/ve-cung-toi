"use client";

// Lightweight sound effects synthesized with the Web Audio API — no external
// audio files to download/license. Kept dependency-free so this module works
// the same in dev and on Vercel with zero asset pipeline.

const MUTE_KEY = "vct_muted";

const COMMENTARY_MUTE_KEY = "vct_blv_muted";

export const MUTE_CHANGE_EVENT = "vct-mute-change";

let ctx: AudioContext | null = null;

let musicNodes: { stop: () => void } | null = null;

/** Shared Web Audio context (resumed on demand) for games that decode their own sound files. */
export function getAudioContext(): AudioContext | null {
  return getCtx();
}

export function getCtx(): AudioContext | null {
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
  if (muted) {
    stopMusic();
    for (const stop of muteStops) stop();
  }
  // Games that own their own <audio> tracks (e.g. werewolf) listen for this
  // instead of being hard-wired into this file.
  window.dispatchEvent(new Event(MUTE_CHANGE_EVENT));
}

/** Separate from the main mute toggle — a browser's built-in Vietnamese
 * voice (if it even has one) is hit-or-miss quality, so a player might want
 * to keep sound effects/music but silence just the spoken commentary
 * (see speakCommentary) without losing everything else. */
export function isCommentaryMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(COMMENTARY_MUTE_KEY) === "1";
}

export function setCommentaryMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMMENTARY_MUTE_KEY, muted ? "1" : "0");
  if (muted && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function tone(freq: number, startOffset: number, duration: number, gainPeak = 0.15, type: OscillatorType = "sine") {
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

/** Very soft, slightly randomized tick per keystroke — quiet enough to type
 * a whole sentence without it getting annoying. */
export function playTypeTick(gain = 0.025) {
  tone(1100 + Math.random() * 300, 0, 0.03, gain, "square");
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

/** Short filtered white-noise burst — the raw ingredient for gunshots/explosions. */
export function noiseBurst(duration: number, gainPeak: number, filterFreq: number) {
  const audio = getCtx();
  if (!audio || isMuted()) return;
  const bufferSize = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const gain = audio.createGain();
  const t0 = audio.currentTime;
  gain.gain.setValueAtTime(gainPeak, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  noise.start(t0);
  noise.stop(t0 + duration + 0.02);
}

/** Match ended in the local player's favor. */
export function playMatchWin() {
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.09, 0.3, 0.13, "triangle"));
}

/** Match ended and the local player's side lost. */
export function playMatchLose() {
  [392, 329.63, 261.63, 220].forEach((f, i) => tone(f, i * 0.12, 0.35, 0.1, "sawtooth"));
}

/** Match ended in a draw. */
export function playMatchDraw() {
  [440, 440, 440].forEach((f, i) => tone(f, i * 0.15, 0.18, 0.08, "triangle"));
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

/** Urgent countdown tick — meant to be called at most once per remaining
 * second while the clock's under the "hurry up" threshold, not once per
 * render/tick broadcast (the caller is responsible for that debouncing,
 * since only it knows which second it's already played). Higher-pitched and
 * shorter than playClick so it reads as a ticking clock, not a UI blip. */
// Synthesized effects that are long enough for other quiet sounds (the
// narrator's typing ticks) to politely wait for.
let sfxBusyUntil = 0;

export function isSfxBusy(): boolean {
  return Date.now() < sfxBusyUntil;
}

/** A low, slow bell — the village going to sleep as a new night begins. */
export function playNightFall() {
  sfxBusyUntil = Date.now() + 1900;
  tone(196, 0, 1.4, 0.09, "sine");
  tone(392, 0, 0.9, 0.03, "sine");
  tone(147, 0.35, 1.6, 0.07, "sine");
}

export function playClockTick() {
  tone(1400, 0, 0.06, 0.08, "square");
}

/** A pitch glide (for boings, trombones, heartbeats). */
export function glide(from: number, to: number, startOffset: number, duration: number, gainPeak: number, type: OscillatorType = "sine") {
  const audio = getCtx();
  if (!audio || isMuted()) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  const t0 = audio.currentTime + startOffset;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + Math.min(0.03, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Filtered noise whose colour slides from one frequency to another: swishes, slides, slaps. */
export function noiseSweep(startOffset: number, duration: number, gainPeak: number, fromFreq: number, toFreq: number, type: BiquadFilterType = "bandpass") {
  const audio = getCtx();
  if (!audio || isMuted()) return;
  const size = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, size, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = type;
  filter.Q.value = 1.2;
  const gain = audio.createGain();
  const t0 = audio.currentTime + startOffset;
  filter.frequency.setValueAtTime(fromFreq, t0);
  filter.frequency.exponentialRampToValueAtTime(toFreq, t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + duration * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  source.start(t0);
  source.stop(t0 + duration + 0.02);
}

/** A skill card played: a rising sparkle, a swish of magic and a soft boom. */
export function playSkillCast() {
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.05, 0.35, 0.055, "sine"));
  noiseSweep(0, 0.55, 0.05, 900, 4200);
  glide(110, 45, 0.28, 0.45, 0.16);
}

/** What a 🔍 or 📡 showed you: a bright "ting" — or a worried slide if it's the pig. */
export function playSkillResult(bad: boolean) {
  if (bad) glide(466, 233, 0, 0.4, 0.07, "triangle");
  else [880, 1174.7].forEach((f, i) => tone(f, i * 0.07, 0.25, 0.07, "sine"));
}

const muteStops = new Set<() => void>();
/** Music owners register their own cleanup without coupling the audio core to a game. */
export function registerMuteStop(stop: () => void) { muteStops.add(stop); }
