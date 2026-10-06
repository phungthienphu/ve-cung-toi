"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { SHAPE_TOOLS, type ClientMessage, type DrawTool, type StrokePoint, type StrokeSegment } from "@shared/types";
import type { GameRoomHandle } from "@/lib/useGameRoom";

const CANVAS_W = 900;
const CANVAS_H = 560;
const SEND_THROTTLE_MS = 40;
const SETTINGS_KEY = "vct_draw_tools";
const MIN_SIZE = 2;
const MAX_SIZE = 24;

const PENCIL_CURSOR_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>
  <g transform='rotate(45 16 16)'>
    <rect x='13' y='2' width='6' height='20' rx='1.5' fill='#334155'/>
    <rect x='13' y='2' width='6' height='6' rx='1.5' fill='#fbbf24'/>
    <polygon points='13,22 19,22 16,30' fill='#f8fafc' stroke='#334155' stroke-width='1'/>
    <polygon points='14.5,26 17.5,26 16,30' fill='#1e293b'/>
  </g>
</svg>`;
const PENCIL_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(PENCIL_CURSOR_SVG)}") 4 28, crosshair`;

const PALETTE = [
  // neutrals
  "#1e1e1e", "#4b5563", "#9ca3af", "#e5e7eb", "#ffffff",
  // warm
  "#7f1d1d", "#ef4444", "#fb7185", "#f97316", "#fdba74",
  "#a16207", "#facc15", "#fde68a", "#f5d0a9", "#92400e",
  // cool
  "#14532d", "#22c55e", "#a3e635", "#0e7490", "#06b6d4",
  "#1e3a8a", "#3b82f6", "#93c5fd", "#6d28d9", "#a78bfa",
  "#be185d", "#ec4899", "#f9a8d4",
];

const TOOLS: { id: DrawTool; label: string; icon: string; key: string }[] = [
  { id: "pen", label: "Bút", icon: "✏️", key: "B" },
  { id: "eraser", label: "Tẩy", icon: "🧽", key: "E" },
  { id: "rect", label: "Hình vuông", icon: "▢", key: "R" },
  { id: "circle", label: "Hình tròn", icon: "◯", key: "C" },
  { id: "triangle", label: "Tam giác", icon: "△", key: "T" },
  { id: "star", label: "Ngôi sao", icon: "☆", key: "S" },
];

const isShape = (tool: DrawTool) => SHAPE_TOOLS.includes(tool);

interface ToolSettings {
  color: string;
  size: number;
  tool: DrawTool;
  filled: boolean;
}

const DEFAULT_SETTINGS: ToolSettings = { color: "#1e1e1e", size: 6, tool: "pen", filled: false };

function loadSettings(): ToolSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ToolSettings>;
    return {
      color: typeof parsed.color === "string" ? parsed.color : DEFAULT_SETTINGS.color,
      size: typeof parsed.size === "number" ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, parsed.size)) : DEFAULT_SETTINGS.size,
      tool: TOOLS.some((item) => item.id === parsed.tool) ? (parsed.tool as DrawTool) : DEFAULT_SETTINGS.tool,
      filled: !!parsed.filled,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Draws a shape inside the box spanned by a drag from `a` to `b`. */
function drawShape(ctx: CanvasRenderingContext2D, tool: DrawTool, a: StrokePoint, b: StrokePoint, color: string, size: number, filled: boolean) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  ctx.beginPath();
  if (tool === "rect") {
    ctx.rect(x, y, w, h);
  } else if (tool === "circle") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (tool === "triangle") {
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  } else if (tool === "star") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 1 : 0.42;
      const px = cx + Math.cos(angle) * (w / 2) * r;
      const py = cy + Math.sin(angle) * (h / 2) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.stroke();
}

function drawLine(ctx: CanvasRenderingContext2D, from: StrokePoint, to: StrokePoint, color: string, size: number, tool: DrawTool) {
  ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
  ctx.lineWidth = tool === "eraser" ? size * 3 : size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawDot(ctx: CanvasRenderingContext2D, p: StrokePoint, color: string, size: number, tool: DrawTool) {
  ctx.fillStyle = tool === "eraser" ? "#ffffff" : color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, (tool === "eraser" ? size * 3 : size) / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSegment(ctx: CanvasRenderingContext2D, seg: StrokeSegment) {
  if (isShape(seg.tool)) {
    const [a, b] = seg.points;
    if (a && b) drawShape(ctx, seg.tool, a, b, seg.color, seg.size, !!seg.filled);
    return;
  }
  const pts = seg.points;
  if (pts.length === 1) drawDot(ctx, pts[0], seg.color, seg.size, seg.tool);
  for (let i = 1; i < pts.length; i++) drawLine(ctx, pts[i - 1], pts[i], seg.color, seg.size, seg.tool);
}

/** Shift-drag: square box, so rectangles/circles/stars come out even. */
function constrain(start: StrokePoint, end: StrokePoint): StrokePoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: start.x + Math.sign(dx || 1) * side, y: start.y + Math.sign(dy || 1) * side };
}

const newStrokeId = () => Math.random().toString(36).slice(2, 10);

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
  // Transparent layer on top, used only for the live preview while dragging a shape.
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  // Every stroke on the canvas this turn, in order (same as the server's list),
  // so an undo can wipe the canvas and redraw what's left.
  const history = useRef<StrokeSegment[]>([]);
  const drawingRef = useRef<{ segment: StrokeSegment; lastSent: number } | null>(null);
  const shapeRef = useRef<{ start: StrokePoint; end: StrokePoint } | null>(null);

  const [settings, setSettings] = useState<ToolSettings>(DEFAULT_SETTINGS);
  const { color, size, tool, filled } = settings;
  const [strokeCount, setStrokeCount] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const update = useCallback((patch: Partial<ToolSettings>) => setSettings((prev) => ({ ...prev, ...patch })), []);

  // Remember the drawer's tool/colour/size between turns and visits.
  const settingsLoaded = useRef(false);
  useEffect(() => {
    setSettings(loadSettings());
  }, []);
  useEffect(() => {
    if (!settingsLoaded.current) {
      settingsLoaded.current = true;
      return;
    }
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Storage blocked (private mode etc.) — just don't remember.
    }
  }, [settings]);

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

  function redrawAll() {
    fillWhite();
    const ctx = getCtx();
    if (ctx) for (const seg of history.current) drawSegment(ctx, seg);
  }

  const syncCount = () => setStrokeCount(history.current.length);

  // Initialize a blank white canvas once.
  useEffect(() => {
    fillWhite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Replay incoming stroke events (remote drawing, undo, or resynced history).
  useEffect(() => {
    if (strokeEvents.length === 0) return;
    const ctx = getCtx();
    if (!ctx) return;

    for (const evt of strokeEvents) {
      if (evt.kind === "clear") {
        history.current = [];
        fillWhite();
      } else if (evt.kind === "undo" && evt.strokeId) {
        history.current = history.current.filter((seg) => seg.strokeId !== evt.strokeId);
        redrawAll();
      } else if (evt.kind === "stroke" && evt.segment) {
        const seg = { ...evt.segment, points: [...evt.segment.points] };
        // A reconnect resends the whole history — replace rather than duplicate.
        const index = history.current.findIndex((candidate) => candidate.strokeId === seg.strokeId);
        if (index >= 0) history.current[index] = seg;
        else history.current.push(seg);
        drawSegment(ctx, seg);
      } else if (evt.kind === "point" && evt.strokeId && evt.point) {
        const seg = history.current.find((candidate) => candidate.strokeId === evt.strokeId);
        if (seg) {
          const last = seg.points[seg.points.length - 1];
          seg.points.push(evt.point);
          if (last) drawLine(ctx, last, evt.point, seg.color, seg.size, seg.tool);
        }
      }
    }
    syncCount();
    clearStrokeEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokeEvents]);

  function toCanvasPoint(e: { clientX: number; clientY: number }): StrokePoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    return { x: Math.round(Math.min(CANVAS_W, Math.max(0, x))), y: Math.round(Math.min(CANVAS_H, Math.max(0, y))) };
  }

  function clearOverlay() {
    overlayRef.current?.getContext("2d")?.clearRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawer) return;
    // Captured, so a stroke keeps going if the pointer slips off the edge.
    e.currentTarget.setPointerCapture(e.pointerId);
    setConfirmClear(false);
    const point = toCanvasPoint(e);
    if (isShape(tool)) {
      shapeRef.current = { start: point, end: point };
      return;
    }
    const segment: StrokeSegment = { strokeId: newStrokeId(), color, size, tool, points: [point] };
    drawingRef.current = { segment, lastSent: Date.now() };
    history.current.push(segment);
    syncCount();

    const ctx = getCtx();
    if (ctx) drawDot(ctx, point, color, size, tool);

    send({ type: "stroke", segment: { ...segment, points: [point] } });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawer) return;
    const shape = shapeRef.current;
    if (shape) {
      const raw = toCanvasPoint(e);
      shape.end = e.shiftKey && tool !== "triangle" ? constrain(shape.start, raw) : raw;
      const overlay = overlayRef.current?.getContext("2d");
      if (overlay) {
        clearOverlay();
        drawShape(overlay, tool, shape.start, shape.end, color, size, filled);
      }
      return;
    }
    const drawing = drawingRef.current;
    if (!drawing) return;
    const point = toCanvasPoint(e);
    const last = drawing.segment.points[drawing.segment.points.length - 1];
    drawing.segment.points.push(point);
    const ctx = getCtx();
    if (ctx) drawLine(ctx, last, point, color, size, tool);

    const now = Date.now();
    if (now - drawing.lastSent >= SEND_THROTTLE_MS) {
      send({ type: "stroke_point", strokeId: drawing.segment.strokeId, point });
      drawing.lastSent = now;
    }
  }

  function handlePointerUp() {
    if (!isDrawer) return;
    const shape = shapeRef.current;
    if (shape) {
      shapeRef.current = null;
      clearOverlay();
      // A plain click (no drag) would make an invisible shape — skip it.
      if (Math.abs(shape.end.x - shape.start.x) < 3 && Math.abs(shape.end.y - shape.start.y) < 3) return;
      const segment: StrokeSegment = { strokeId: newStrokeId(), color, size, tool, points: [shape.start, shape.end], filled };
      history.current.push(segment);
      syncCount();
      const ctx = getCtx();
      if (ctx) drawSegment(ctx, segment);
      send({ type: "stroke", segment });
      send({ type: "stroke_end", strokeId: segment.strokeId });
      return;
    }
    const drawing = drawingRef.current;
    if (!drawing) return;
    const last = drawing.segment.points[drawing.segment.points.length - 1];
    send({ type: "stroke_point", strokeId: drawing.segment.strokeId, point: last });
    send({ type: "stroke_end", strokeId: drawing.segment.strokeId });
    drawingRef.current = null;
  }

  const handleUndo = useCallback(() => {
    if (!isDrawer || history.current.length === 0 || drawingRef.current || shapeRef.current) return;
    // The server drops its last stroke and tells everyone (us included); the
    // canvas then redraws from history, so every screen stays identical.
    send({ type: "undo_stroke" });
  }, [isDrawer, send]);

  function handleClear() {
    if (!isDrawer) return;
    // Two taps, so a stray click can't wipe a whole drawing.
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    history.current = [];
    syncCount();
    fillWhite();
    send({ type: "clear_canvas" });
  }

  useEffect(() => {
    if (!confirmClear) return;
    const timer = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmClear]);

  // Keyboard shortcuts for the drawer (ignored while typing in chat).
  useEffect(() => {
    if (!isDrawer) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        handleUndo();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toUpperCase();
      const match = TOOLS.find((item) => item.key === key);
      if (match) update({ tool: match.id });
      else if (key === "F") update({ filled: !filled });
      else if (event.key === "[") update({ size: Math.max(MIN_SIZE, size - 2) });
      else if (event.key === "]") update({ size: Math.min(MAX_SIZE, size + 2) });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDrawer, handleUndo, update, filled, size]);

  const shapeActive = isShape(tool);
  const pickColor = (next: string) => update({ color: next, tool: tool === "eraser" ? "pen" : tool });
  const previewDot = Math.max(4, Math.min(26, tool === "eraser" ? size * 3 : size));

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* Full column width at the canvas's real 900×560 ratio. It used to be
          stretched to fill a fixed-height box, so a square on the drawer's
          screen (shorter box, toolbar below) showed up as a tall rectangle
          for everyone else. */}
      <div className="min-w-0 rounded-2xl p-1.5 shadow-xl" style={{ background: "linear-gradient(180deg, #a9764c, #8a5c38)" }}>
        <div className="relative w-full overflow-hidden rounded-xl bg-white" style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="block h-full w-full touch-none"
            style={{ cursor: isDrawer ? (shapeActive ? "crosshair" : PENCIL_CURSOR) : "default" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          <canvas ref={overlayRef} width={CANVAS_W} height={CANVAS_H} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>
      </div>

      {isDrawer && (
        <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-cream-200 bg-white p-2.5 shadow-xl">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex gap-0.5 rounded-lg bg-cream-50 p-1">
              {TOOLS.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => update({ tool: item.id })}
                  title={`${item.label} (phím ${item.key})`}
                  aria-label={item.label}
                  aria-pressed={tool === item.id}
                  className={`flex h-9 w-9 items-center justify-center rounded-md text-base transition ${
                    tool === item.id ? "bg-clay-500 text-white shadow" : "text-ink/70 hover:bg-white"
                  } ${index === 2 ? "ml-1.5" : ""}`}
                >
                  {item.icon}
                </button>
              ))}
            </div>

            <button
              onClick={() => update({ filled: !filled })}
              disabled={!shapeActive}
              title="Tô kín hình (phím F)"
              aria-pressed={filled}
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                filled && shapeActive ? "border-clay-500 bg-clay-500/10 text-clay-700" : "border-cream-200 text-ink/70 hover:border-clay-500"
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-sm border-2 border-current ${filled ? "bg-current" : ""}`} />
              Tô kín
            </button>

            {/* Size slider with a live dot in the current colour. */}
            <div className="flex h-9 items-center gap-2 rounded-lg border border-cream-200 px-2" title="Cỡ nét (phím [ và ])">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                <span
                  className="rounded-full border border-ink/20"
                  style={{ width: previewDot, height: previewDot, backgroundColor: tool === "eraser" ? "#ffffff" : color }}
                />
              </span>
              <input
                type="range"
                min={MIN_SIZE}
                max={MAX_SIZE}
                value={size}
                onChange={(e) => update({ size: Number(e.target.value) })}
                className="w-20 accent-clay-500 sm:w-24"
                aria-label="Cỡ nét"
              />
            </div>

            <div className="ml-auto flex gap-1.5">
              <button
                onClick={handleUndo}
                disabled={strokeCount === 0}
                title="Hoàn tác nét vừa vẽ (Ctrl+Z)"
                className="h-9 rounded-lg border border-cream-200 px-3 text-sm font-medium text-ink/70 transition hover:border-clay-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ↶ Hoàn tác
              </button>
              <button
                onClick={handleClear}
                disabled={strokeCount === 0}
                className={`h-9 rounded-lg border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  confirmClear ? "border-red-500 bg-red-500 text-white" : "border-cream-200 text-red-600 hover:border-red-400 hover:bg-red-50"
                }`}
              >
                {confirmClear ? "Bấm lần nữa để xóa" : "Xóa hết"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => pickColor(c)}
                className={`h-6 w-6 rounded-full border-2 transition ${
                  color === c && tool !== "eraser" ? "scale-110 border-clay-500" : "border-cream-200 hover:scale-110"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Màu ${c}`}
              />
            ))}
            <label
              title="Chọn màu khác"
              className={`relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border-2 transition hover:scale-110 ${
                !PALETTE.includes(color) && tool !== "eraser" ? "scale-110 border-clay-500" : "border-cream-200"
              }`}
              style={{ background: "conic-gradient(#ef4444, #facc15, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)" }}
            >
              <input
                type="color"
                value={color}
                onChange={(e) => pickColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Chọn màu khác"
              />
            </label>
          </div>

          <p className="hidden text-[11px] text-ink/40 sm:block">
            Mẹo: giữ <b>Shift</b> khi kéo để ra hình đều · <b>Ctrl+Z</b> hoàn tác · phím <b>B E R C T S</b> đổi công cụ · <b>[ ]</b> đổi cỡ nét
          </p>
        </div>
      )}
    </div>
  );
});

export default DrawingCanvas;
