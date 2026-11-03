"use client";

import { useEffect, useRef } from "react";
import { hillHeight } from "@shared/hill/terrain";
import { HILL_BASE_SEED, HILL_MAPS, HILL_VEHICLES, type HillMapId, type HillVehicleId } from "@shared/hill/types";
import { drawVehicle, drawWheel } from "./drawVehicle";

// Small canvas pictures for the menus, drawn with the in-game artwork so a
// card shows exactly the car and the road you will get.

function useCanvas(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    paint(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, ...deps]);
  return ref;
}

/** A vehicle side-on, wheels and springs included, scaled to fit the box. */
export function VehicleArt({ vehicle, width, height, locked = false, className = "" }: { vehicle: HillVehicleId; width: number; height: number; locked?: boolean; className?: string }) {
  const ref = useCanvas(
    width,
    height,
    (ctx) => {
      const car = HILL_VEHICLES[vehicle];
      const wheelY = -0.8;
      const spanX = car.halfWidth * 2 + 0.5;
      // The bus carries sacks and a chicken coop on its roof.
      const top = vehicle === "bus" ? 1.65 : 1.25;
      const bottom = wheelY - car.wheelRadius;
      const scale = Math.min(width / spanX, height / (top - bottom + 0.2));
      ctx.save();
      ctx.translate(width / 2, height / 2 + ((top + bottom) / 2) * scale);
      ctx.scale(scale, -scale);
      ctx.strokeStyle = "#d3d8ce";
      ctx.lineWidth = 4 / scale;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo((side * car.wheelbase) / 2, 0);
        ctx.lineTo((side * car.wheelbase) / 2, wheelY);
        ctx.stroke();
      }
      drawVehicle(ctx, { vehicle, grounded: true });
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate((side * car.wheelbase) / 2, wheelY);
        drawWheel(ctx, vehicle);
        ctx.restore();
      }
      ctx.restore();
      if (locked) {
        // A dark silhouette: you can see what it is, not own it yet.
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = "rgba(8, 30, 24, 0.82)";
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "source-over";
      }
    },
    [vehicle, locked],
  );
  return <canvas ref={ref} style={{ width, height }} className={className} aria-hidden />;
}

/** A postcard of a map: its sky, hills and the real terrain profile past the start. */
export function MapArt({ map, width, height, className = "" }: { map: HillMapId; width: number; height: number; className?: string }) {
  const ref = useCanvas(
    width,
    height,
    (ctx) => {
      const info = HILL_MAPS[map];
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, info.sky[0]);
      sky.addColorStop(1, info.sky[1]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = map === "moon" ? "#e8ecff" : "#fff1ae";
      ctx.beginPath();
      ctx.arc(width * 0.8, height * 0.22, height * 0.13, 0, Math.PI * 2);
      ctx.fill();
      for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = info.hills[layer];
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let px = 0; px <= width + 6; px += 6) ctx.lineTo(px, height * (0.42 + layer * 0.09) + Math.sin(px / (26 - layer * 5) + layer) * (6 + layer * 2));
        ctx.lineTo(width, height);
        ctx.fill();
      }
      // 70 m of the actual road, starting where the flat start ends.
      const from = 36;
      const span = 70;
      const heights = Array.from({ length: span + 1 }, (_, i) => hillHeight(HILL_BASE_SEED, from + i, map));
      const low = Math.min(...heights);
      const high = Math.max(...heights);
      const vertical = (height * 0.38) / Math.max(4, high - low);
      const y = (value: number) => height * 0.92 - (value - low) * vertical;
      ctx.beginPath();
      ctx.moveTo(0, height);
      heights.forEach((value, i) => ctx.lineTo((i / span) * width, y(value)));
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = info.ground;
      ctx.fill();
      ctx.beginPath();
      heights.forEach((value, i) => (i ? ctx.lineTo((i / span) * width, y(value)) : ctx.moveTo(0, y(value))));
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#42743a";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = info.edge;
      ctx.lineWidth = 2;
      ctx.stroke();
    },
    [map],
  );
  return <canvas ref={ref} style={{ width, height }} className={className} aria-hidden />;
}
