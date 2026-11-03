"use client";

import { getCtx, glide, isMuted, noiseSweep, tone } from "@/lib/audio/core";

// ---------- Ai Là Heo ----------

/** A card snapped off a hand or onto the table. */
export function playCardFlick() {
  tone(1500 + Math.random() * 500, 0, 0.045, 0.05, "triangle");
  tone(650, 0.01, 0.05, 0.025, "square");
}

/** A riffle of cards. */
export function playCardShuffle() {
  for (let i = 0; i < 12; i++) tone(900 + Math.random() * 900, i * 0.028, 0.03, 0.028, "square");
}

/** A pair thrown to the middle. */
export function playPairDing() {
  [880, 1320].forEach((f, i) => tone(f, i * 0.08, 0.28, 0.07, "sine"));
}

/** You just drew the pig. Only you hear it. */
export function playJokerSting() {
  tone(116, 0, 0.9, 0.15, "sawtooth");
  tone(98, 0.14, 1.0, 0.13, "sawtooth");
  tone(69, 0.32, 1.3, 0.12, "square");
}

/** "Ụt ịt": two nasal grunts with a falling pitch. */
export function playOink() {
  const audio = getCtx();
  if (!audio || isMuted()) return;
  for (const offset of [0, 0.24]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    const t0 = audio.currentTime + offset;
    osc.frequency.setValueAtTime(330, t0);
    osc.frequency.exponentialRampToValueAtTime(150, t0 + 0.17);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + 0.22);
  }
}

/** Cards flying out to every hand, one after another. */
export function playDealRun(durationMs: number, cards: number) {
  const step = durationMs / 1000 / Math.max(1, cards);
  for (let i = 0; i < cards; i++) tone(1200 + Math.random() * 700, i * step, 0.025, 0.018, "square");
}

/** The drawer's pointer moving onto another card. Very soft — it can happen a lot. */
export function playCardHover() {
  tone(2100 + Math.random() * 250, 0, 0.025, 0.016, "sine");
}

/** A card dangled to tempt the drawer ("nhử"): a springy boing. */
export function playTeaseBoing() {
  glide(240, 640, 0, 0.11, 0.06);
  glide(640, 300, 0.11, 0.2, 0.05);
}

/** Your heart skipping: they're pointing right at the pig in your hand. Only you hear it. */
export function playHeartbeat() {
  glide(75, 48, 0, 0.14, 0.24);
  glide(68, 44, 0.2, 0.16, 0.17);
}

/** Your turn to draw. */
export function playYourTurn() {
  [660, 990].forEach((f, i) => tone(f, i * 0.09, 0.22, 0.08, "triangle"));
}

/** Someone has started drawing from you: uh-oh. */
export function playUhOh() {
  [392, 311].forEach((f, i) => tone(f, i * 0.16, 0.24, 0.07, "triangle"));
}

/**
 * Checking a drawn card against your hand ("dò lá"): a tick per card looked
 * at, climbing in pitch, then a bright "ting" on the mate — or a flat "hmm"
 * if there's none.
 */
export function playCheckSweep(hops: number, stepMs: number, startMs: number, matched: boolean) {
  for (let i = 0; i < hops; i++) tone(700 + i * 45, (startMs + i * stepMs) / 1000, 0.04, 0.03, "triangle");
  const end = (startMs + Math.max(0, hops - 1) * stepMs + 90) / 1000;
  if (matched) [1046.5, 1568].forEach((f, i) => tone(f, end + i * 0.07, 0.3, 0.08, "sine"));
  else glide(330, 230, end, 0.22, 0.045, "triangle");
}

/** A card (or a pair) flung through the air. */
export function playCardSwish(startOffset = 0) {
  noiseSweep(startOffset, 0.4, 0.09, 700, 2800);
}

/** Cards slapping down on the felt. */
export function playCardLand(startOffset = 0) {
  noiseSweep(startOffset, 0.09, 0.14, 2200, 500, "lowpass");
  tone(150, startOffset, 0.08, 0.06, "sine");
}

/** A card slid into a hand. */
export function playCardTuck() {
  noiseSweep(0, 0.22, 0.05, 2600, 900);
}

/** Changing seats: the camera swings round the table, then you sit down. */
export function playSeatMove() {
  noiseSweep(0, 0.75, 0.05, 300, 1500);
  tone(110, 0.7, 0.14, 0.12, "sine");
}

/** "Wah wah wah waaah" for the round's pig. */
export function playSadTrombone() {
  glide(311, 294, 0, 0.34, 0.09, "triangle");
  glide(294, 277, 0.38, 0.34, 0.09, "triangle");
  glide(277, 262, 0.76, 0.34, 0.09, "triangle");
  glide(262, 220, 1.14, 0.95, 0.09, "triangle");
}
