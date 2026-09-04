"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ClientMessage, StrokePoint, StrokeSegment } from "@shared/types";
import type { GameRoomHandle } from "@/lib/useGameRoom";

const CANVAS_W = 900;
const CANVAS_H = 560;
const SEND_THROTTLE_MS = 40;

const PALETTE = [
  "#1e1e1e", "#ffffff", "#7f7f7f", "#c1c1c1",
  "#ef4444", "#f97316", "#facc15", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

export interface DrawingCanvasHandle {
  getDataUrl: () => string | null;
}

interface Props {
  isDrawer: boolean;
  strokeEvents: GameRoomHandle["strokeEvents"];
  clearStrokeEvents: () => void;
  send: (msg: ClientMessage) => void;
}

const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(function DrawingCanvas(
  { isDrawer, strokeEvents, clearStrokeEvents, send },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const localStrokes = useRef<Map<string, StrokeSegment>>(new Map());
  const drawingRef = useRef<{ strokeId: string; lastPoint: StrokePoint; lastSent: number } | null>(null);

  const [color, setColor] = useState("#1e1e1e");
  const [size, setSize] = useState(6);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  useImperativeHandle(ref, () => ({
    getDataUrl: () => canvasRef.current?.toDataURL("image/png") ?? null,
  }));

  function getCtx() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }

  function fillWhite() {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // Initialize a blank white canvas once.
  useEffect(() => {
    fillWhite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawLine(ctx: CanvasRenderingContext2D, from: StrokePoint, to: StrokePoint, strokeColor: string, strokeSize: number, strokeTool: "pen" | "eraser") {
    ctx.strokeStyle = strokeTool === "eraser" ? "#ffffff" : strokeColor;
    ctx.lineWidth = strokeTool === "eraser" ? strokeSize * 3 : strokeSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  function drawDot(ctx: CanvasRenderingContext2D, p: StrokePoint, strokeColor: string, strokeSize: number, strokeTool: "pen" | "eraser") {
    ctx.fillStyle = strokeTool === "eraser" ? "#ffffff" : strokeColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (strokeTool === "eraser" ? strokeSize * 3 : strokeSize) / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Replay incoming stroke events (remote drawing, or resynced history).
  useEffect(() => {
    if (strokeEvents.length === 0) return;
    const ctx = getCtx();
    if (!ctx) return;

    for (const evt of strokeEvents) {
      if (evt.kind === "clear") {
        localStrokes.current.clear();
        fillWhite();
      } else if (evt.kind === "stroke" && evt.segment) {
        localStrokes.current.set(evt.segment.strokeId, evt.segment);
        const pts = evt.segment.points;
        if (pts.length === 1) {
          drawDot(ctx, pts[0], evt.segment.color, evt.segment.size, evt.segment.tool);
        }
        for (let i = 1; i < pts.length; i++) {
          drawLine(ctx, pts[i - 1], pts[i], evt.segment.color, evt.segment.size, evt.segment.tool);
        }
      } else if (evt.kind === "point" && evt.strokeId && evt.point) {
        const seg = localStrokes.current.get(evt.strokeId);
        if (seg) {
          const last = seg.points[seg.points.length - 1];
          seg.points.push(evt.point);
          if (last) drawLine(ctx, last, evt.point, seg.color, seg.size, seg.tool);
        }
      } else if (evt.kind === "end" && evt.strokeId) {
        localStrokes.current.delete(evt.strokeId);
      }
    }
    clearStrokeEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokeEvents]);

  function toCanvasPoint(e: { clientX: number; clientY: number }): StrokePoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    return { x: Math.round(x), y: Math.round(y) };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawer) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const strokeId = Math.random().toString(36).slice(2, 10);
    const point = toCanvasPoint(e);
    const segment: StrokeSegment = { strokeId, color, size, tool, points: [point] };
    drawingRef.current = { strokeId, lastPoint: point, lastSent: Date.now() };

    const ctx = getCtx();
    if (ctx) drawDot(ctx, point, color, size, tool);

    send({ type: "stroke", segment });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawer || !drawingRef.current) return;
    const point = toCanvasPoint(e);
    const ctx = getCtx();
    if (ctx) drawLine(ctx, drawingRef.current.lastPoint, point, color, size, tool);

    const now = Date.now();
    if (now - drawingRef.current.lastSent >= SEND_THROTTLE_MS) {
      send({ type: "stroke_point", strokeId: drawingRef.current.strokeId, point });
      drawingRef.current.lastSent = now;
    }
    drawingRef.current.lastPoint = point;
  }

  function handlePointerUp() {
    if (!isDrawer || !drawingRef.current) return;
    send({ type: "stroke_point", strokeId: drawingRef.current.strokeId, point: drawingRef.current.lastPoint });
    send({ type: "stroke_end", strokeId: drawingRef.current.strokeId });
    drawingRef.current = null;
  }

  function handleClear() {
    if (!isDrawer) return;
    fillWhite();
    localStrokes.current.clear();
    send({ type: "clear_canvas" });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className={`block w-full touch-none ${isDrawer ? "cursor-crosshair" : "cursor-default"}`}
          style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      {isDrawer && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
          <div className="flex gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setTool("pen");
                }}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  color === c && tool === "pen" ? "border-brand-500 scale-110" : "border-slate-200"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Màu ${c}`}
              />
            ))}
          </div>

          <input
            type="range"
            min={2}
            max={24}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-24"
          />

          <button
            onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tool === "eraser" ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            🧽 Tẩy
          </button>

          <button
            onClick={handleClear}
            className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-100"
          >
            🗑️ Xóa hết
          </button>
        </div>
      )}
    </div>
  );
});

export default DrawingCanvas;
