'use client';

import { useEffect, useMemo, useRef } from 'react';
import { hillHeight } from '@shared/hill/terrain';
import type { HillMapId } from '@shared/hill/types';

// The race minimap, kept deliberately plain (the owner's call): one line
// rising and falling with the course, and a dot per car on it. Distances
// count from x = 5, like the race itself.

const SAMPLES = 120;
const WIDTH = 320;
const HEIGHT = 36;
const TOP = 7;
const BAND = 22;

export function HillMiniMap({
  seed,
  map,
  length,
  cars,
  myId,
  names,
}: {
  seed: number;
  map: HillMapId;
  /** Metres shown, start to right edge. */
  length: number;
  cars: { id: string; distance: number }[];
  myId: string;
  names: (id: string) => string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const profile = useMemo(() => {
    const heights = Array.from({ length: SAMPLES + 1 }, (_, i) => hillHeight(seed, 5 + (i / SAMPLES) * length, map));
    const low = Math.min(...heights);
    return { heights, low, span: Math.max(4, Math.max(...heights) - low) };
  }, [seed, map, length]);
  /** Height on the drawing, 0 (top) … 1 (bottom), at a distance along the course. */
  const depth = (distance: number) => {
    const t = Math.max(0, Math.min(1, distance / length)) * SAMPLES;
    const i = Math.min(SAMPLES - 1, Math.floor(t));
    const height = profile.heights[i] + (profile.heights[i + 1] - profile.heights[i]) * (t - i);
    return 1 - (height - profile.low) / profile.span;
  };

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.beginPath();
    profile.heights.forEach((height, i) => {
      const x = (i / SAMPLES) * WIDTH;
      const y = TOP + (1 - (height - profile.low) / profile.span) * BAND;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, [profile]);

  return (
    <div className="relative mt-1.5 h-9" aria-label="Bản đồ thu nhỏ đường đua">
      <canvas ref={canvas} width={WIDTH} height={HEIGHT} className="absolute inset-0 h-full w-full" />
      {[...cars]
        .sort((a, b) => Number(a.id === myId) - Number(b.id === myId))
        .map((car) => {
          const mine = car.id === myId;
          return (
            <span
              key={car.id}
              title={names(car.id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-[left,top] duration-100 ${
                mine ? 'z-10 h-3.5 w-3.5 border-white bg-amber-400' : 'h-2.5 w-2.5 border-emerald-950 bg-white'
              }`}
              style={{ left: `${Math.min(100, (car.distance / length) * 100)}%`, top: `${((TOP + depth(car.distance) * BAND) / HEIGHT) * 100}%` }}
            />
          );
        })}
    </div>
  );
}
