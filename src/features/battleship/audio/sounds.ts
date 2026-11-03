"use client";

import { getCtx, isMuted, noiseBurst, tone } from "@/lib/audio/core";

// ---------- Hải Chiến ----------

/** Naval gun going off. */
export function playCannon() {
  noiseBurst(0.18, 0.2, 900);
  tone(90, 0, 0.22, 0.16, "sine");
}

/** Shell landing in open water. */
export function playSplash() {
  noiseBurst(0.35, 0.09, 2600);
  tone(420, 0.02, 0.12, 0.03, "sine");
}

/** Shell striking a hull. */
export function playShipHit() {
  noiseBurst(0.3, 0.22, 1400);
  tone(140, 0, 0.3, 0.14, "square");
}

/** A whole ship going down — heavy boom and a sinking groan. */
export function playShipSunk() {
  noiseBurst(0.7, 0.26, 700);
  const audio = getCtx();
  if (!audio || isMuted()) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sawtooth";
  const t0 = audio.currentTime + 0.1;
  osc.frequency.setValueAtTime(180, t0);
  osc.frequency.exponentialRampToValueAtTime(45, t0 + 1.1);
  gain.gain.setValueAtTime(0.07, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + 1.15);
}
