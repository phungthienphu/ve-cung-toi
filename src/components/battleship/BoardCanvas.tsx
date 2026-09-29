"use client";

import { useEffect, useRef, useState } from "react";
import { cellXY, shipCells, type ShipPlacement, type ShotEvent } from "@shared/battleshipTypes";
import { drawFire, drawShip } from "./drawShips";

const COLS = "ABCDEFGHIJ";
const FLASH_MS = 800;

export interface AimMarker {
  cells: number[];
  color: string;
  /** Solid crosshair (yours) vs. small dot (teammates). */
  kind: "mine" | "team";
}

interface BoardCanvasProps {
  size: number;
  hits: number[];
  misses: number[];
  /** Ships to draw normally (your own fleet, or every fleet once revealed). */
  ships?: ShipPlacement[];
  /** Sunk ships on this board (drawn wrecked). */
  sunk?: ShipPlacement[];
  aims?: AimMarker[];
  /** Placement editor: index of the selected ship and whether a preview is valid. */
  selectedShip?: number | null;
  /** Latest shots, to animate the ones that landed on this board. */
  flashes?: ShotEvent[];
  boardId?: string;
  interactive?: boolean;
  /** Dims the board (e.g. a sunk-out fleet). */
  dimmed?: boolean;
  onCellClick?: (cell: number) => void;
}

// One board: water, grid with A–J / 1–10 labels, ships, shots, aim markers,
// and a short splash/explosion flash for the newest shots.
export function BoardCanvas({
  size,
  hits,
  misses,
  ships = [],
  sunk = [],
  aims = [],
  selectedShip = null,
  flashes = [],
  boardId,
  interactive = false,
  dimmed = false,
  onCellClick,
}: BoardCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [frame, setFrame] = useState(0);
  const seenFlashes = useRef(new Map<string, number>());

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Register newly-arrived shots on this board and keep redrawing while any
  // of them is still animating.
  const mine = flashes.filter((shot) => !boardId || shot.boardId === boardId);
  const flashKey = mine.map((shot) => shot.id).join(",");
  useEffect(() => {
    const now = performance.now();
    for (const shot of mine) if (!seenFlashes.current.has(shot.id)) seenFlashes.current.set(shot.id, now);
    let raf = 0;
    const tick = () => {
      const active = [...seenFlashes.current.values()].some((start) => performance.now() - start < FLASH_MS);
      setFrame((value) => value + 1);
      if (active) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashKey]);

  const pad = Math.max(14, Math.round(width * 0.05));
  const cell = width > 0 ? (width - pad) / size : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cell <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const total = pad + cell * size;
    canvas.width = Math.round(total * dpr);
    canvas.height = Math.round(total * dpr);
    canvas.style.height = `${total}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, total, total);

    // Labels
    ctx.fillStyle = "rgba(224,242,254,0.75)";
    ctx.font = `600 ${Math.max(9, Math.round(cell * 0.3))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < size; i++) {
      ctx.fillText(COLS[i], pad + (i + 0.5) * cell, pad / 2);
      ctx.fillText(String(i + 1), pad / 2, pad + (i + 0.5) * cell);
    }

    // Water
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        ctx.fillStyle = (x + y) % 2 ? "#2f78aa" : "#2b6f9e";
        ctx.fillRect(pad + x * cell, pad + y * cell, cell, cell);
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i++) {
      ctx.beginPath();
      ctx.moveTo(pad + i * cell, pad);
      ctx.lineTo(pad + i * cell, pad + size * cell);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad, pad + i * cell);
      ctx.lineTo(pad + size * cell, pad + i * cell);
      ctx.stroke();
    }

    const center = (c: number) => {
      const { x, y } = cellXY(c, size);
      return { x: pad + (x + 0.5) * cell, y: pad + (y + 0.5) * cell };
    };

    if (interactive && hover !== null) {
      const { x, y } = cellXY(hover, size);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(pad + x * cell, pad + y * cell, cell, cell);
    }

    // Ships
    const sunkKeys = new Set(sunk.map((ship) => `${ship.kind}:${ship.x}:${ship.y}`));
    ships.forEach((ship, index) => {
      if (sunkKeys.has(`${ship.kind}:${ship.x}:${ship.y}`)) return;
      drawShip(ctx, ship, cell, pad, pad, { outline: index === selectedShip ? "#fde047" : undefined });
    });
    for (const ship of sunk) drawShip(ctx, ship, cell, pad, pad, { sunk: true, alpha: 0.9 });

    // Shots
    const sunkCells = new Set(sunk.flatMap((ship) => shipCells(ship, size)));
    for (const c of misses) {
      const { x, y } = center(c);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, cell * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const c of hits) {
      const { x, y } = center(c);
      if (!sunkCells.has(c)) {
        ctx.fillStyle = "rgba(127,29,29,0.35)";
        ctx.fillRect(x - cell / 2 + 1, y - cell / 2 + 1, cell - 2, cell - 2);
      }
      drawFire(ctx, x, y, cell * 0.85);
    }

    // Aims
    for (const aim of aims) {
      for (const c of aim.cells) {
        const { x, y } = center(c);
        ctx.strokeStyle = aim.color;
        ctx.fillStyle = aim.color;
        if (aim.kind === "mine") {
          const r = cell * 0.34;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - r - 4, y);
          ctx.lineTo(x + r + 4, y);
          ctx.moveTo(x, y - r - 4);
          ctx.lineTo(x, y + r + 4);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, Math.max(3, cell * 0.14), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // New-shot flashes
    const now = performance.now();
    for (const shot of mine) {
      const start = seenFlashes.current.get(shot.id);
      if (start === undefined) continue;
      const t = (now - start) / FLASH_MS;
      if (t >= 1) continue;
      const { x, y } = center(shot.cell);
      ctx.strokeStyle = shot.result === "miss" ? `rgba(255,255,255,${1 - t})` : `rgba(251,146,60,${1 - t})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, cell * (0.2 + t * 0.7), 0, Math.PI * 2);
      ctx.stroke();
    }

    if (dimmed) {
      ctx.fillStyle = "rgba(2,6,23,0.45)";
      ctx.fillRect(pad, pad, cell * size, cell * size);
    }
  }, [cell, pad, size, hits, misses, ships, sunk, aims, selectedShip, hover, interactive, dimmed, frame, mine]);

  const cellFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): number | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left - pad) / cell);
    const y = Math.floor((event.clientY - rect.top - pad) / cell);
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    return y * size + x;
  };

  return (
    <div ref={wrapRef} className="w-full select-none">
      <canvas
        ref={canvasRef}
        className={`block w-full touch-manipulation ${interactive ? "cursor-crosshair" : ""}`}
        onPointerMove={(event) => interactive && event.pointerType === "mouse" && setHover(cellFromEvent(event))}
        onPointerLeave={() => setHover(null)}
        onPointerUp={(event) => {
          if (!interactive || !onCellClick) return;
          const c = cellFromEvent(event);
          if (c !== null) onCellClick(c);
        }}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  );
}
