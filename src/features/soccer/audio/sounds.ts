"use client";

import { getCtx, isCommentaryMuted, isMuted, noiseBurst, registerMuteStop, tone } from "@/lib/audio/core";

// ---------- soccer game ----------

/** Boot meets ball — pitch/volume scale with `power` (0..1, the charge
 * fraction from handleKickRelease) so a tap and a full-power strike sound
 * distinctly different, not just "the same thump again". */
export function playSoccerKick(power: number) {
  noiseBurst(0.09, 0.08 + power * 0.12, 1100 + power * 900);
  tone(160 - power * 40, 0, 0.12, 0.1 + power * 0.09, "square");
}

/** A tackle attempt lands — `hit` (a real contact, steal or foul) gets a
 * proper grounded thud; a whiff just gets a soft passing-air whoosh, since
 * nothing actually connected. */
export function playSoccerTackle(hit: boolean) {
  if (!hit) {
    tone(260, 0, 0.12, 0.06, "sine");
    return;
  }
  noiseBurst(0.2, 0.18, 800);
  tone(85, 0, 0.16, 0.15, "sawtooth");
}

/** The referee's whistle — kickoff, a foul, or play resuming after one.
 * Two short bright blasts, distinct from playBombWhistle's single falling
 * sweep (that one signals an incoming explosion, not an official's call). */
export function playWhistle() {
  const audio = getCtx();
  if (!audio || isMuted()) return;
  for (const startOffset of [0, 0.16]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    const t0 = audio.currentTime + startOffset;
    osc.frequency.setValueAtTime(2200, t0);
    osc.frequency.setValueAtTime(2600, t0 + 0.05);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.09, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + 0.15);
  }
}

/** GOAL — a bigger fanfare than playMatchWin (this fires mid-match, several
 * times a game, so it needs its own identity) plus a soft crowd-roar noise
 * bed underneath the notes. */
export function playSoccerGoal() {
  noiseBurst(1.1, 0.09, 2200);
  [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => tone(f, i * 0.08, 0.35, 0.14, "triangle"));
}

/** A card shown — yellow is a single short buzz, red is lower, longer, and
 * doubled, reading as distinctly more severe without needing to say why. */
export function playCardShown(card: "yellow" | "red") {
  if (card === "yellow") {
    tone(300, 0, 0.22, 0.12, "square");
    return;
  }
  tone(160, 0, 0.3, 0.14, "sawtooth");
  tone(120, 0.22, 0.35, 0.13, "sawtooth");
}

// Soccer's looping background track — same real-audio-file pattern as
// startTankBgMusic (see its doc): drop a royalty-free track at this exact
// path and it starts working, nothing else to wire up.
let soccerBgMusicEl: HTMLAudioElement | null = null;

export function startSoccerBgMusic() {
  if (typeof window === "undefined" || isMuted()) return;
  if (!soccerBgMusicEl) {
    soccerBgMusicEl = new Audio("/soccer/bg-music.mp3");
    soccerBgMusicEl.loop = true;
    soccerBgMusicEl.volume = 0.05;
  }
  // Silently no-op if the file doesn't exist yet, or autoplay is blocked —
  // same reasoning as startTankBgMusic.
  soccerBgMusicEl.play().catch(() => {});
}

export function stopSoccerBgMusic() {
  soccerBgMusicEl?.pause();
  if (soccerBgMusicEl) soccerBgMusicEl.currentTime = 0;
}

// Cached once found, since getVoices() is a full re-scan of every installed
// voice — no need to redo that search on every single commentary line.
let cachedViVoice: SpeechSynthesisVoice | null | undefined;

// undefined = not looked up yet

function findVietnameseVoice(): SpeechSynthesisVoice | null {
  if (cachedViVoice !== undefined) return cachedViVoice;
  const voices = window.speechSynthesis.getVoices();
  cachedViVoice = voices.find((v) => v.lang.toLowerCase().startsWith("vi")) ?? null;
  return cachedViVoice;
}

/**
 * The commentator actually reads a line out loud, via the browser's built-in
 * Web Speech API — same "no external file to license" spirit as every other
 * sound here, just synthesized speech instead of synthesized tones. Quality
 * depends entirely on what Vietnamese voice (if any) the player's browser/OS
 * ships — Chrome on a machine with internet access usually has a decent one;
 * plenty of setups have none, in which case the browser falls back to
 * whatever default voice it has and reads Vietnamese text with an accent.
 * There's no way to guarantee better than that without shipping actual
 * voice-over audio files.
 */
export function speakCommentary(text: string) {
  if (typeof window === "undefined" || isMuted() || isCommentaryMuted()) return;
  if (!("speechSynthesis" in window)) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "vi-VN";
  utterance.rate = 1.05; // a touch faster than the browser default — reads more like excited commentary than a narrator
  utterance.pitch = 1.1;
  utterance.volume = 0.9;
  const voice = findVietnameseVoice();
  if (voice) utterance.voice = voice;

  // getVoices() can come back empty on the very first call (some browsers
  // load the voice list asynchronously) — if so, wait for it once and retry
  // rather than silently speaking with no voice selected at all.
  if (!voice && window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        cachedViVoice = undefined;
        const retryVoice = findVietnameseVoice();
        if (retryVoice) utterance.voice = retryVoice;
        window.speechSynthesis.speak(utterance);
      },
      { once: true }
    );
    return;
  }

  window.speechSynthesis.speak(utterance);
}

// A continuous, gentle stadium-crowd murmur — filtered looping noise with a
// slow gain wobble (via an LFO) so it reads as a living crowd rather than a
// flat hiss. Meant to run for the whole length of a match, cheaply filling
// the silence while there's no licensed background music track yet (see
// startSoccerBgMusic's doc) — this is closer to sound.ts's other synthesized
// noiseBurst effects, just sustained and much quieter.
let crowdMurmurNodes: { stop: () => void } | null = null;

export function startCrowdMurmur() {
  const audio = getCtx();
  if (!audio || isMuted() || crowdMurmurNodes) return;

  const bufferSize = audio.sampleRate * 2; // 2s of noise, looped
  const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 450; // a low murmur, not a hiss
  filter.Q.value = 0.6;

  const gain = audio.createGain();
  gain.gain.value = 0.03;

  // Slow, quiet wobble on top of the base volume — an actual crowd swells
  // and dips, a static gain level doesn't read as "alive".
  const lfo = audio.createOscillator();
  lfo.frequency.value = 0.15;
  const lfoGain = audio.createGain();
  lfoGain.gain.value = 0.012;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);

  noise.start();
  lfo.start();

  crowdMurmurNodes = {
    stop: () => {
      noise.stop();
      lfo.stop();
    },
  };
}

export function stopCrowdMurmur() {
  crowdMurmurNodes?.stop();
  crowdMurmurNodes = null;
}

registerMuteStop(stopSoccerBgMusic);
registerMuteStop(stopCrowdMurmur);
