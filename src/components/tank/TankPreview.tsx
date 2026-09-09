"use client";

import { useEffect, useRef } from "react";

interface Props {
  color: string;
}

const SIZE = 120;
const BODY = 46;

/** A small standalone animated tank render for the color-pick screen — the
 * turret idly scans back and forth and the tracks "roll" so the choice feels
 * alive instead of a flat color swatch. Deliberately not sharing code with
 * TankCanvas's in-game drawTank: this only ever needs to look good sitting
 * still in a lobby card, not stay in sync with server state. */
export default function TankPreview({ color }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    const start = performance.now();

    function draw(now: number) {
      if (!ctx) return;
      const t = now - start;
      const cx = SIZE / 2;
      const cy = SIZE / 2;
      const bob = Math.sin(t / 500) * 2;
      const turretAngle = Math.sin(t / 1100) * 0.9 - Math.PI / 2;

      ctx.clearRect(0, 0, SIZE, SIZE);

      // Soft ground shadow.
      ctx.fillStyle = "rgba(15,23,42,0.15)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + BODY / 2 + 6, BODY / 1.6, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      const y = cy + bob;
      const half = BODY / 2;

      // Tracks — dashed treads that scroll to read as rolling.
      const treadOffset = (t / 60) % 12;
      for (const side of [-1, 1]) {
        const tx = cx + side * (half + 6);
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(Math.round(tx - 5), Math.round(y - half - 4), 10, BODY + 8);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 2;
        for (let o = -treadOffset; o < BODY + 8; o += 12) {
          ctx.beginPath();
          ctx.moveTo(tx - 5, y - half - 4 + o);
          ctx.lineTo(tx + 5, y - half - 4 + o);
          ctx.stroke();
        }
      }

      // Body.
      const grad = ctx.createLinearGradient(cx, y - half, cx, y + half);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "rgba(0,0,0,0.25)");
      ctx.fillStyle = grad;
      ctx.fillRect(Math.round(cx - half), Math.round(y - half), BODY, BODY);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.round(cx - half) + 1, Math.round(y - half) + 1, BODY - 2, BODY - 2);

      // Turret base.
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(cx, y, half * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Barrel, slowly scanning.
      const barrelLen = half + 16;
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx + Math.cos(turretAngle) * barrelLen, y + Math.sin(turretAngle) * barrelLen);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [color]);

  return <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ width: SIZE, height: SIZE }} className="mx-auto" />;
}
