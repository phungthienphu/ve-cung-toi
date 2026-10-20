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

const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

/**
 * A full fireworks show for festive banners: shells bursting all over the
 * sky with a sparkle trail, while flowers and hearts drift down. Drawn above
 * the banner's backdrop (zIndex 200). Returns a stop function — particles
 * already in the air finish falling.
 */
export function celebrationFireworks(durationMs = 5000): () => void {
  const palettes = [
    ["#f43f5e", "#fda4af", "#ffffff"],
    ["#ec4899", "#f9a8d4", "#fde68a"],
    ["#facc15", "#fde68a", "#fb7185"],
    ["#a855f7", "#f0abfc", "#ffffff"],
    ["#fb923c", "#fecdd3", "#facc15"],
  ];
  const base = { zIndex: 200, disableForReducedMotion: true };
  const flower = confetti.shapeFromText({ text: "🌸", scalar: 2 });
  const heart = confetti.shapeFromText({ text: "💖", scalar: 2 });
  const end = Date.now() + durationMs;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let stopped = false;
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

  const shell = () => {
    const origin = { x: 0.08 + Math.random() * 0.84, y: 0.12 + Math.random() * 0.33 };
    confetti({ ...base, particleCount: 80, spread: 360, startVelocity: 26 + Math.random() * 12, gravity: 0.65, decay: 0.92, ticks: 95, scalar: 0.95, origin, colors: pick(palettes), shapes: ["circle", "star"] });
    confetti({ ...base, particleCount: 24, spread: 360, startVelocity: 10, gravity: 0.35, decay: 0.94, ticks: 130, scalar: 0.45, origin, colors: ["#ffffff", "#fef3c7"] });
  };
  const petals = () =>
    confetti({ ...base, particleCount: 4, angle: 270, spread: 140, startVelocity: 8, gravity: 0.45, drift: Math.random() - 0.5, ticks: 260, scalar: 2.2, flat: true, shapes: [flower, heart], origin: { x: Math.random(), y: -0.05 } });

  // Opening: a big bloom from the middle and two side cannons.
  confetti({ ...base, particleCount: 140, spread: 110, startVelocity: 52, origin: { x: 0.5, y: 0.7 }, colors: ["#f43f5e", "#ec4899", "#facc15", "#ffffff"] });
  confetti({ ...base, particleCount: 60, angle: 60, spread: 60, startVelocity: 60, origin: { x: 0, y: 0.8 }, colors: pick(palettes) });
  confetti({ ...base, particleCount: 60, angle: 120, spread: 60, startVelocity: 60, origin: { x: 1, y: 0.8 }, colors: pick(palettes) });

  const shellLoop = () => {
    if (stopped || Date.now() > end) return;
    shell();
    later(260 + Math.random() * 300, shellLoop);
  };
  const petalLoop = () => {
    if (stopped || Date.now() > end + 1500) return;
    petals();
    later(420, petalLoop);
  };
  later(350, shellLoop);
  petalLoop();

  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
  };
}
