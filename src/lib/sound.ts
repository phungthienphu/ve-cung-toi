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

/** Short filtered white-noise burst — the raw ingredient for gunshots/explosions. */
function noiseBurst(duration: number, gainPeak: number, filterFreq: number) {
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

/** Tank cannon firing — quick tonal "pew" layered over a noise crack. */
export function playTankShoot() {
  tone(920, 0, 0.05, 0.05, "square");
  noiseBurst(0.07, 0.07, 4500);
}

/** Bullet impact — a bullet vanishing against a wall or a tank. */
export function playTankExplosion() {
  noiseBurst(0.3, 0.16, 1100);
  tone(90, 0, 0.28, 0.09, "sawtooth");
}

/** The default "big shot" skill firing — a heavier, lower-pitched thump than a normal shot. */
export function playTankBigShot() {
  tone(220, 0, 0.1, 0.1, "square");
  tone(70, 0, 0.16, 0.12, "sawtooth");
  noiseBurst(0.12, 0.1, 3000);
}

/** A big shot detonating — bigger and longer than a normal bullet impact. */
export function playTankBigExplosion() {
  noiseBurst(0.45, 0.22, 900);
  tone(60, 0, 0.4, 0.14, "sawtooth");
  tone(50, 0.05, 0.35, 0.1, "sawtooth");
}

/** A shield absorbing a hit — a short metallic "ping", distinct from a real impact. */
export function playShieldBlock() {
  tone(1200, 0, 0.08, 0.07, "sine");
  tone(1800, 0.02, 0.05, 0.05, "sine");
}

/** Self just got set on fire by a fire bullet — a crackling whoosh. */
export function playFireIgnite() {
  noiseBurst(0.25, 0.1, 2200);
  tone(400, 0, 0.15, 0.08, "sawtooth");
}

/** Self took damage — bullet, trap, or terrain hazard. */
export function playTankHit() {
  tone(160, 0, 0.12, 0.1, "square");
}

/** Self picked up an item or healed off a pickup. */
export function playTankPickup() {
  [660, 880].forEach((f, i) => tone(f, i * 0.05, 0.12, 0.07, "triangle"));
}

/** Metallic clang — one tank successfully shoves another. */
export function playTankImpact() {
  tone(180, 0, 0.08, 0.1, "square");
  tone(1400, 0, 0.04, 0.05, "square");
}

/** Self's tank got destroyed — heavier and longer than a normal hit/impact. */
export function playTankDestroyed() {
  noiseBurst(0.5, 0.25, 700);
  tone(140, 0, 0.3, 0.14, "sawtooth");
  tone(70, 0.08, 0.35, 0.12, "sawtooth");
}

/** Boost just kicked in — a rising "power up" whoosh. */
export function playBoostStart() {
  const audio = getCtx();
  if (!audio || isMuted()) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sawtooth";
  const t0 = audio.currentTime;
  osc.frequency.setValueAtTime(150, t0);
  osc.frequency.exponentialRampToValueAtTime(500, t0 + 0.2);
  gain.gain.setValueAtTime(0.08, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + 0.25);
}

/** Ultimate energy just filled up — a bright ready-to-use chime. */
export function playUltimateReady() {
  [523.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.06, 0.2, 0.09, "sine"));
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
