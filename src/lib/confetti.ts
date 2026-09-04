"use client";

import confetti from "canvas-confetti";

/** A small, quick confetti pop — used when someone guesses correctly. */
export function burstConfetti() {
  confetti({
    particleCount: 40,
    spread: 55,
    startVelocity: 35,
    origin: { x: 0.5, y: 0.3 },
    scalar: 0.8,
    ticks: 120,
  });
}

/** Bigger celebratory fireworks — used on the game-end results screen. */
export function fireworks() {
  const duration = 2200;
  const end = Date.now() + duration;
  const colors = ["#3854ff", "#facc15", "#ec4899", "#22c55e", "#06b6d4"];

  (function frame() {
    confetti({ particleCount: 3, angle: 60, spread: 65, origin: { x: 0, y: 0.6 }, colors });
    confetti({ particleCount: 3, angle: 120, spread: 65, origin: { x: 1, y: 0.6 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  confetti({ particleCount: 120, spread: 100, startVelocity: 45, origin: { y: 0.4 }, colors });
}
