"use client";

import { useEffect, useRef, useState } from "react";
import {
  SOCCER_BALL_RADIUS,
  SOCCER_BOOST_MAX_ENERGY,
  SOCCER_FIELD_H,
  SOCCER_FIELD_W,
  SOCCER_GOAL_BOTTOM,
  SOCCER_GOAL_DEPTH,
  SOCCER_GOAL_TOP,
  SOCCER_KICK_CHARGE_MAX_MS,
  SOCCER_PLAYER_RADIUS,
  SOCCER_TEAM_COLOR,
  SOCCER_TICK_MS,
  type SoccerCardEvent,
  type SoccerClientMessage,
  type SoccerGoalEvent,
  type SoccerPlayer,
  type SoccerPublicState,
  type SoccerTackleEvent,
} from "@shared/soccerTypes";
import { getSprite } from "@/lib/imageCache";
import { useSoccerInput } from "./useSoccerInput";

interface Props {
  state: SoccerPublicState;
  selfId: string;
  send: (msg: SoccerClientMessage) => void;
}

const TACKLE_FX_DURATION_MS = 1000;

interface TackleParticle {
  angle: number; // direction this clod of dirt flies, relative to the tackle's own angle
  dist: number; // how far out it travels by the end of the effect
  size: number;
}
interface TackleFx {
  id: string;
  x: number;
  y: number;
  angle: number;
  hit: boolean;
  start: number;
  particles: TackleParticle[];
}

function spawnTackleFx(e: SoccerTackleEvent): TackleFx {
  const count = e.hit ? 7 : 3;
  const spread = e.hit ? 26 : 13;
  const particles: TackleParticle[] = Array.from({ length: count }, () => ({
    // Roughly forward-facing cone (±100°) — dirt kicked up by a lunge sprays
    // ahead and to the sides, not backward.
    angle: (Math.random() - 0.5) * ((Math.PI * 200) / 180),
    dist: spread * (0.5 + Math.random() * 0.6),
    size: (e.hit ? 2.5 : 1.6) + Math.random() * 1.8,
  }));
  return { id: e.id, x: e.x, y: e.y, angle: e.angle, hit: e.hit, start: performance.now(), particles };
}

export default function SoccerCanvas({ state, selfId, send }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  const prevStateRef = useRef<SoccerPublicState | null>(null);
  const stateChangedAtRef = useRef(performance.now());
  if (stateRef.current !== state) {
    prevStateRef.current = stateRef.current;
    stateChangedAtRef.current = performance.now();
    stateRef.current = state;
  }

  const input = useSoccerInput({ send, selfId, stateRef, canvasRef });
  const tackleFxRef = useRef<TackleFx[]>([]);
  useEffect(() => {
    if (state.tackleEvents.length === 0) return;
    tackleFxRef.current.push(...state.tackleEvents.map(spawnTackleFx));
  }, [state.tackleEvents]);

  // Transient event toasts (goals, cards) — detected the same way tank's
  // useTankEffects.ts spots one-shot events: whenever a fresh `state` prop
  // carries a non-empty events array, it's brand new this broadcast (the
  // server clears them right after sending, see soccer-server.ts's tick()).
  const [toasts, setToasts] = useState<{ id: string; text: string; expiresAt: number }[]>([]);
  useEffect(() => {
    const events: { id: string; text: string }[] = [
      ...state.goalEvents.map((g: SoccerGoalEvent) => ({
        id: g.id,
        text: `⚽ Đội ${g.scoringTeam === "A" ? "Xanh" : "Đỏ"} ghi bàn! ${g.scoreA} - ${g.scoreB}`,
      })),
      ...state.cardEvents.map((c: SoccerCardEvent) => ({
        id: c.id,
        text: `${c.card === "red" ? "🟥" : "🟨"} ${c.playerName} nhận thẻ ${c.card === "red" ? "đỏ — bị đuổi khỏi sân!" : "vàng"}`,
      })),
    ];
    if (events.length === 0) return;
    const now = Date.now();
    setToasts((prev) => [...prev, ...events.map((e) => ({ ...e, expiresAt: now + 3500 }))]);
  }, [state.goalEvents, state.cardEvents]);
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((prev) => prev.filter((x) => x.expiresAt > Date.now())), 500);
    return () => clearTimeout(t);
  }, [toasts]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SOCCER_FIELD_W * dpr;
    canvas.height = SOCCER_FIELD_H * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    function draw() {
      if (!ctx) return;
      const s = stateRef.current;
      const prevS = prevStateRef.current;
      const now = performance.now();
      const tickT = Math.min(1, (now - stateChangedAtRef.current) / SOCCER_TICK_MS);

      function lerpPlayer(p: SoccerPlayer): { x: number; y: number } {
        const prev = prevS?.players.find((o) => o.id === p.id);
        if (!prev) return { x: p.x, y: p.y };
        if (Math.hypot(p.x - prev.x, p.y - prev.y) > SOCCER_PLAYER_RADIUS * 4) return { x: p.x, y: p.y };
        return { x: prev.x + (p.x - prev.x) * tickT, y: prev.y + (p.y - prev.y) * tickT };
      }
      const ballPos = (() => {
        const prev = prevS?.ball;
        if (!prev) return { x: s.ball.x, y: s.ball.y };
        if (Math.hypot(s.ball.x - prev.x, s.ball.y - prev.y) > SOCCER_BALL_RADIUS * 8) return { x: s.ball.x, y: s.ball.y };
        return { x: prev.x + (s.ball.x - prev.x) * tickT, y: prev.y + (s.ball.y - prev.y) * tickT };
      })();

      drawField(ctx);

      tackleFxRef.current = tackleFxRef.current.filter((fx) => now - fx.start < TACKLE_FX_DURATION_MS);
      // Ground scorch first (a mark on the grass, sits under everyone),
      // flying dirt clods last (airborne, needs to render on top — see the
      // second pass below).
      for (const fx of tackleFxRef.current) drawTackleScorch(ctx, fx, (now - fx.start) / TACKLE_FX_DURATION_MS);

      for (const p of s.players) {
        const pos = lerpPlayer(p);
        drawPlayer(ctx, p, pos.x, pos.y, p.id === selfId, now);
      }

      drawBall(ctx, ballPos.x, ballPos.y);

      for (const fx of tackleFxRef.current) drawTackleParticles(ctx, fx, (now - fx.start) / TACKLE_FX_DURATION_MS);

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [selfId]);

  const self = state.players.find((p) => p.id === selfId);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={SOCCER_FIELD_W}
          height={SOCCER_FIELD_H}
          onMouseMove={input.handleAimMove}
          onMouseLeave={input.handleAimLeave}
          onMouseDown={input.handleMouseDown}
          onMouseUp={input.handleMouseUp}
          className="block w-full touch-none rounded-xl border border-slate-200 bg-green-600 shadow-xl"
          style={{ aspectRatio: `${SOCCER_FIELD_W} / ${SOCCER_FIELD_H}` }}
        />

        {toasts.length > 0 && (
          <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-1">
            {toasts.map((t) => (
              <div key={t.id} className="animate-bounce-in rounded-lg bg-black/75 px-3 py-1.5 text-sm font-semibold text-white shadow-lg">
                {t.text}
              </div>
            ))}
          </div>
        )}

        <div
          ref={input.joyBaseRef}
          onPointerDown={input.handleJoyPointerDown}
          onPointerMove={input.handleJoyPointerMove}
          onPointerUp={input.resetJoystick}
          onPointerCancel={input.resetJoystick}
          className="absolute bottom-3 left-3 h-24 w-24 touch-none rounded-full border border-white/40 bg-black/25 md:hidden"
        >
          <div
            ref={input.joyKnobRef}
            className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow"
          />
        </div>
        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            input.startKick();
          }}
          onPointerUp={input.releaseKick}
          onPointerCancel={input.releaseKick}
          className="absolute bottom-3 right-3 flex h-16 w-16 touch-none items-center justify-center rounded-full border border-white/40 bg-red-500/80 text-xs font-bold text-white shadow-lg md:hidden"
        >
          SÚT
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            input.tackle();
          }}
          className="absolute bottom-24 right-3 flex h-14 w-14 touch-none items-center justify-center rounded-full border border-white/40 bg-amber-400/80 text-xs font-bold text-white shadow-lg md:hidden"
        >
          TẮC
        </button>
      </div>
      <p className="text-center text-[11px] text-ink/40">
        Di chuyển: WASD/mũi tên · Chuột: ngắm hướng, giữ chuột trái để sạc lực rồi thả ra chuyền/sút · Space: tắc bóng · Shift: chạy nước rút
      </p>
      {self && (
        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 shadow-xl">
          <span className="shrink-0 text-xs font-medium text-slate-500">⚡ Nước rút (Shift)</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-amber-400 transition-[width]"
              style={{ width: `${Math.max(0, Math.min(100, (self.boostEnergy / SOCCER_BOOST_MAX_ENERGY) * 100))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function drawField(ctx: CanvasRenderingContext2D) {
  // Alternating vertical mow-stripes, same visual idea as the Kenney Sports
  // Pack preview — purely cosmetic banding, no gameplay meaning.
  const stripeW = 60;
  for (let x = 0; x < SOCCER_FIELD_W; x += stripeW) {
    ctx.fillStyle = Math.floor(x / stripeW) % 2 === 0 ? "#3fa34d" : "#3a9a48";
    ctx.fillRect(x, 0, stripeW, SOCCER_FIELD_H);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, SOCCER_FIELD_W - 8, SOCCER_FIELD_H - 8);

  ctx.beginPath();
  ctx.moveTo(SOCCER_FIELD_W / 2, 4);
  ctx.lineTo(SOCCER_FIELD_W / 2, SOCCER_FIELD_H - 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(SOCCER_FIELD_W / 2, SOCCER_FIELD_H / 2, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(SOCCER_FIELD_W / 2, SOCCER_FIELD_H / 2, 3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill();

  // Goal mouths — a lighter strip at each edge, capped by posts. Net drawn
  // as a faint crosshatch inside the (purely visual) depth band.
  for (const side of [0, 1] as const) {
    const x0 = side === 0 ? 0 : SOCCER_FIELD_W - SOCCER_GOAL_DEPTH;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x0, SOCCER_GOAL_TOP, SOCCER_GOAL_DEPTH, SOCCER_GOAL_BOTTOM - SOCCER_GOAL_TOP);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gx = x0 + (SOCCER_GOAL_DEPTH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(gx, SOCCER_GOAL_TOP);
      ctx.lineTo(gx, SOCCER_GOAL_BOTTOM);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 4;
    ctx.strokeRect(x0, SOCCER_GOAL_TOP, SOCCER_GOAL_DEPTH, SOCCER_GOAL_BOTTOM - SOCCER_GOAL_TOP);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: SoccerPlayer, x: number, y: number, isSelf: boolean, now: number) {
  const color = SOCCER_TEAM_COLOR[p.team];
  const body = getSprite(`/soccer/${color}/body.png`);
  const leg = getSprite(`/soccer/${color}/leg.png`);

  ctx.save();
  if (p.sentOff) ctx.globalAlpha = 0.35; // grayed out on the sideline — see SoccerPlayer.sentOff's doc

  ctx.beginPath();
  ctx.ellipse(x, y + SOCCER_PLAYER_RADIUS * 0.6, SOCCER_PLAYER_RADIUS * 0.8, SOCCER_PLAYER_RADIUS * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fill();

  if (isSelf) {
    ctx.beginPath();
    ctx.arc(x, y, SOCCER_PLAYER_RADIUS + 5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.translate(x, y);
  ctx.rotate(p.angle);
  // A little running wobble: legs shift back and forth perpendicular to the
  // facing direction while moving, sold purely by drawing them slightly
  // offset each frame — no separate leg animation frames exist to swap.
  const wobble = p.moving ? Math.sin(now / 90) * 3 : 0;
  if (leg) ctx.drawImage(leg, -leg.width / 2, -leg.height / 2 + wobble, leg.width, leg.height);
  if (body) ctx.drawImage(body, -body.width / 2, -body.height / 2, body.width, body.height);
  ctx.restore();

  if (p.kickChargeStartedAt !== null) {
    const t = Math.min(1, (Date.now() - p.kickChargeStartedAt) / SOCCER_KICK_CHARGE_MAX_MS);
    ctx.beginPath();
    ctx.arc(x, y, SOCCER_PLAYER_RADIUS + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(15,23,42,0.85)";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(p.name, x, y - SOCCER_PLAYER_RADIUS - 8);

  if (p.cardStatus !== "none") {
    const card = getSprite(`/soccer/items/card_${p.cardStatus}.png`);
    const cx = x + SOCCER_PLAYER_RADIUS - 2;
    const cy = y - SOCCER_PLAYER_RADIUS - 18;
    if (card) ctx.drawImage(card, cx, cy, card.width, card.height);
    else {
      ctx.fillStyle = p.cardStatus === "red" ? "#dc2626" : "#facc15";
      ctx.fillRect(cx, cy, 6, 9);
    }
  }
}

/** The "nền đất bị xới lên" mark itself — a scuffed streak of bare dirt at
 * the tackle point, along the tackler's lunge direction, fading out over
 * the full TACKLE_FX_DURATION_MS. Drawn before players so it reads as
 * ground, not an overlay. */
function drawTackleScorch(ctx: CanvasRenderingContext2D, fx: TackleFx, progress: number) {
  const fade = 1 - progress;
  const baseLen = fx.hit ? 22 : 12;
  const baseWidth = fx.hit ? 11 : 7;
  ctx.save();
  ctx.translate(fx.x, fx.y);
  ctx.rotate(fx.angle);
  ctx.globalAlpha = fade * (fx.hit ? 0.55 : 0.35);
  ctx.fillStyle = "#5b3d22";
  ctx.beginPath();
  ctx.ellipse(baseLen * 0.25, 0, baseLen * 0.6, baseWidth * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7a5533";
  ctx.beginPath();
  ctx.ellipse(baseLen * 0.15, 0, baseLen * 0.4, baseWidth * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Flying dirt clods + (for a real hit) a quick white impact flash — the
 * "hiệu ứng mạnh hơn" part, drawn after everything else so airborne debris
 * reads on top of players/ball rather than underneath them. */
function drawTackleParticles(ctx: CanvasRenderingContext2D, fx: TackleFx, progress: number) {
  if (fx.hit && progress < 0.35) {
    const flashT = progress / 0.35;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, SOCCER_PLAYER_RADIUS * (0.6 + flashT * 1.4), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${(1 - flashT) * 0.8})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  const fade = Math.max(0, 1 - progress * 1.3);
  if (fade <= 0) return;
  for (const p of fx.particles) {
    const ease = 1 - Math.pow(1 - Math.min(1, progress * 1.6), 2); // fast out, settling — not a linear drift
    const worldAngle = fx.angle + p.angle;
    const px = fx.x + Math.cos(worldAngle) * p.dist * ease;
    const py = fx.y + Math.sin(worldAngle) * p.dist * ease;
    ctx.beginPath();
    ctx.arc(px, py, p.size * fade, 0, Math.PI * 2);
    ctx.fillStyle = "#6b4a2c";
    ctx.globalAlpha = fade;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.ellipse(x, y + SOCCER_BALL_RADIUS * 0.7, SOCCER_BALL_RADIUS * 0.8, SOCCER_BALL_RADIUS * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fill();

  const sprite = getSprite("/soccer/items/ball.png");
  const size = SOCCER_BALL_RADIUS * 2;
  if (sprite) {
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    return;
  }
  // Fallback while the sprite is still loading — same collision-radius circle.
  ctx.beginPath();
  ctx.arc(x, y, SOCCER_BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#1e293b";
  ctx.stroke();
}
