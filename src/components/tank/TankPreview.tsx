"use client";

import { useEffect, useRef } from "react";
import { TANK_COLORS, TANK_SKINS, TANK_SKINS_WITH_TURRET, type TankSkin } from "@shared/tankTypes";
import { getSprite } from "@/lib/imageCache";

interface Props {
  color: string;
}

const SIZE = 120;

function skinForColor(color: string): TankSkin {
  const idx = TANK_COLORS.indexOf(color);
  return TANK_SKINS[idx >= 0 ? idx : 0];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A small standalone animated render of the real in-game tank sprite for
 * the color-pick screen — the turret idly scans back and forth (for skins
 * that have one) so the choice feels alive instead of a flat swatch. */
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
      const y = cy + bob;

      ctx.clearRect(0, 0, SIZE, SIZE);

      ctx.fillStyle = "rgba(15,23,42,0.15)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 30, 30, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      const skin = skinForColor(color);
      const renderSize = SIZE * 0.62;

      if (TANK_SKINS_WITH_TURRET.has(skin)) {
        const body = getSprite(`/Retina/tankBody_${skin}.png`);
        if (body) {
          const h = renderSize;
          const w = h * (body.width / body.height);
          ctx.drawImage(body, cx - w / 2, y - h / 2, w, h);
        }
        const barrel = getSprite(`/Retina/tank${capitalize(skin)}_barrel1.png`);
        if (barrel) {
          const turretAngle = Math.sin(t / 1100) * 0.7 - Math.PI / 2;
          ctx.save();
          ctx.translate(cx, y);
          ctx.rotate(turretAngle + Math.PI / 2);
          const h = renderSize * 0.7;
          const w = h * (barrel.width / barrel.height);
          ctx.drawImage(barrel, -w / 2, -h, w, h);
          ctx.restore();
        }
      } else {
        const composed = getSprite(`/Retina/tank_${skin}.png`);
        if (composed) {
          const h = renderSize * 1.3;
          const w = h * (composed.width / composed.height);
          const wobble = Math.sin(t / 700) * 0.06;
          ctx.save();
          ctx.translate(cx, y);
          ctx.rotate(wobble);
          ctx.drawImage(composed, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
      }

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [color]);

  return <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ width: SIZE, height: SIZE }} className="mx-auto" />;
}
