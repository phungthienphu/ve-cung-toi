"use client";

import { glide, noiseBurst, noiseSweep, tone } from "@/lib/audio/core";

// ---------- Con Đường Hoàng Kim ----------
export function playHillJump() { glide(180, 640, 0, 0.16, 0.07, "triangle"); }

export function playHillDash() { noiseSweep(0, 0.28, 0.09, 350, 2200); glide(85, 210, 0, 0.22, 0.06, "sawtooth"); }

export function playHillLanding() { noiseBurst(0.12, 0.08, 600); tone(75, 0, 0.12, 0.07, "sine"); }

/** Two cars banging together; `strength` 0–1 makes it louder and deeper. */
export function playHillBump(strength: number) { const s = Math.max(0.2, Math.min(1, strength)); noiseBurst(0.09, 0.05 + 0.08 * s, 1100); tone(120 - 40 * s, 0, 0.16, 0.05 + 0.07 * s, "square"); }

/** Stomped flat: a squashy slide down plus a thud. */
export function playHillSquash() { glide(340, 80, 0, 0.22, 0.08, "sawtooth"); noiseBurst(0.1, 0.07, 500); }

/** Hitting water at speed. */
export function playHillSplash(strength: number) { const s = Math.max(0.3, Math.min(1, strength)); noiseSweep(0, 0.35, 0.05 + 0.06 * s, 1800, 500, "lowpass"); }

/** A roof scraping along the ground. */
export function playHillScrape() { noiseSweep(0, 0.18, 0.035, 2600, 4400); }

/** Arcade starting lights: three short beeps, then a brighter launch chord. */
export function playHillCountdown() { tone(660, 0, .13, .12, "square"); }

export function playHillStart() { [660, 880, 1320].forEach((f, i) => tone(f, i * .045, .38, .075, "triangle")); noiseSweep(0, .25, .06, 250, 1600); }

export function playHillThrottle() { glide(65, 160, 0, .24, .045, "sawtooth"); }

export function playHillBrake(speed: number) { noiseSweep(0, .28, .025 + Math.min(speed / 30, 1) * .045, 2200, 850, "bandpass"); glide(900, 360, 0, .23, .025, "triangle"); }

/** Short filtered rush plus irregular rounded bubbles, repeated only while tyres are wet. */
export function playHillWaterFlow(speed: number) {
  const strength = Math.min(1, speed / 12);
  noiseSweep(0, .3, .016 + strength * .025, 700, 1350, "lowpass");
  for (let i = 0; i < 3; i++) glide(180 + Math.random() * 280, 70 + Math.random() * 80, i * .07, .09, .018 + strength * .012, "sine");
}
