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
  type SoccerFreeKickEvent,
  type SoccerGoalEvent,
  type SoccerKickEvent,
  type SoccerPlayer,
  type SoccerPublicState,
  type SoccerReferee,
  type SoccerTackleEvent,
} from "@shared/soccerTypes";
import { burstConfetti } from "@/lib/confetti";
import { getSprite } from "@/lib/imageCache";
import { playCardShown, playSoccerGoal, playSoccerKick, playSoccerTackle, playWhistle, speakCommentary } from "@/lib/sound";
import { useSoccerInput } from "./useSoccerInput";

interface Props {
  state: SoccerPublicState;
  selfId: string;
  send: (msg: SoccerClientMessage) => void;
}

// "Bình luận viên" — a random flavor headline picked per event, instead of
// the same fixed sentence every single goal/card. The factual detail
// (who/score) still shows underneath as the toast's subtext, so variety
// here is purely color commentary, never the only place the real info lives.
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
const GOAL_LINES = [
  "GOOOAL! Một pha dứt điểm không thể cản phá!",
  "Chấn động! Bóng đã nằm gọn trong lưới!",
  "Tuyệt vời! Một bàn thắng đẳng cấp!",
  "Không thể tin được — quá đẹp mắt!",
  "Thủ môn đứng hình, bóng đã đi vào lưới!",
] as const;
const OWN_GOAL_LINES = [
  "Ôi không, đá phản lưới nhà rồi!",
  "Tình huống đáng tiếc cho đội nhà!",
  "Một pha xử lý hớ hênh biến thành bàn thua!",
] as const;
const YELLOW_CARD_LINES = [
  "Trọng tài rút thẻ cảnh cáo!",
  "Một pha vào bóng hơi quá đà!",
  "Lời nhắc nhở từ vị vua áo đen!",
] as const;
const RED_CARD_LINES = [
  "Trọng tài không khoan nhượng — thẻ đỏ!",
  "Pha vào bóng quá thô bạo, phải rời sân!",
  "Đội hình còn lại phải chơi thiếu người!",
] as const;

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

const KICK_FX_DURATION_MS = 350;

interface KickParticle {
  angle: number;
  dist: number;
  size: number;
}
interface KickFx {
  id: string;
  x: number;
  y: number;
  angle: number;
  power: number;
  start: number;
  particles: KickParticle[];
}

function spawnKickFx(e: SoccerKickEvent): KickFx {
  // Harder kicks fling more grass, further — a tap barely disturbs the
  // ground, a full-power strike visibly rips it up.
  const count = 3 + Math.round(e.power * 4);
  const particles: KickParticle[] = Array.from({ length: count }, () => ({
    // Narrow forward cone — grass flicked up by the boot, not scattered
    // sideways like the tackle's wider dirt spray.
    angle: (Math.random() - 0.5) * ((Math.PI * 50) / 180),
    dist: (9 + Math.random() * 12) * (0.6 + e.power * 0.7),
    size: 1.3 + Math.random() * 1.5,
  }));
  return { id: e.id, x: e.x, y: e.y, angle: e.angle, power: e.power, start: performance.now(), particles };
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
    for (const e of state.tackleEvents) playSoccerTackle(e.hit);
  }, [state.tackleEvents]);
  const kickFxRef = useRef<KickFx[]>([]);
  useEffect(() => {
    if (state.kickEvents.length === 0) return;
    kickFxRef.current.push(...state.kickEvents.map(spawnKickFx));
    for (const e of state.kickEvents) playSoccerKick(e.power);
  }, [state.kickEvents]);

  // Transient event toasts (goals, cards, free kicks) — detected the same
  // way tank's useTankEffects.ts spots one-shot events: whenever a fresh
  // `state` prop carries a non-empty events array, it's brand new this
  // broadcast (the server clears them right after sending, see
  // soccer-server.ts's tick()). Goals and cards get the big bounce-in
  // banner (image + a randomized "commentator" headline, see pick() below,
  // with the factual score/name as a smaller subtext line); free
  // kicks/whistles stay a small text pill — they're common enough during a
  // match that a big banner every time would be more noise than signal.
  interface Toast {
    id: string;
    text: string;
    subtext?: string;
    expiresAt: number;
    image?: string;
  }
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const events: Omit<Toast, "expiresAt">[] = [
      ...state.goalEvents.map((g: SoccerGoalEvent) => ({
        id: g.id,
        // The excited "GOOOALL!!" graphic for a real goal; the plainer
        // "GOAL" one for an own goal — still a banner-worthy moment, just
        // not one to celebrate the same way.
        image: g.ownGoal ? "/soccer/effect/goal_1.gif" : "/soccer/effect/goal.gif",
        text: pick(g.ownGoal ? OWN_GOAL_LINES : GOAL_LINES),
        subtext: g.ownGoal
          ? `${g.scorerName} đá phản lưới nhà! ${g.scoreA} - ${g.scoreB}`
          : g.scorerName
            ? `${g.scorerName} ghi bàn cho đội ${g.scoringTeam === "A" ? "Xanh" : "Đỏ"}! ${g.scoreA} - ${g.scoreB}`
            : `Đội ${g.scoringTeam === "A" ? "Xanh" : "Đỏ"} ghi bàn! ${g.scoreA} - ${g.scoreB}`,
      })),
      ...state.cardEvents.map((c: SoccerCardEvent) => ({
        id: c.id,
        image: c.card === "red" ? "/soccer/effect/red-card.webp" : "/soccer/effect/yellow-card.webp",
        text: pick(c.card === "red" ? RED_CARD_LINES : YELLOW_CARD_LINES),
        subtext: c.foulOnReferee
          ? `${c.playerName} phạm lỗi với trọng tài!`
          : `${c.playerName} nhận thẻ ${c.card === "red" ? "đỏ — bị đuổi khỏi sân!" : "vàng"}`,
      })),
      ...state.freeKickEvents.map((f: SoccerFreeKickEvent) => ({
        id: f.id,
        text: f.advantage
          ? `⚡ Lợi thế cho đội ${f.team === "A" ? "Xanh" : "Đỏ"} — chơi tiếp!`
          : `📯 Đá phạt cho đội ${f.team === "A" ? "Xanh" : "Đỏ"}!`,
      })),
    ];
    if (events.length === 0) return;
    const now = Date.now();
    setToasts((prev) => [...prev, ...events.map((e) => ({ ...e, expiresAt: now + 3500 }))]);
    if (state.goalEvents.length > 0) {
      playSoccerGoal();
      burstConfetti();
    }
    for (const c of state.cardEvents) if (c.card !== "none") playCardShown(c.card);
    // The commentator reads the same headline + factual line the banner
    // shows — `events` is built in goals-then-cards-then-free-kicks order
    // above, so slicing by each array's own length picks out exactly the
    // banner-worthy ones (free kicks stay a silent text pill).
    const spoken = events.slice(0, state.goalEvents.length + state.cardEvents.length);
    for (const e of spoken) speakCommentary(e.subtext ? `${e.text}. ${e.subtext}` : e.text);
  }, [state.goalEvents, state.cardEvents, state.freeKickEvents]);
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((prev) => prev.filter((x) => x.expiresAt > Date.now())), 500);
    return () => clearTimeout(t);
  }, [toasts]);

  // A short "whistle" toast the instant a freeze (kickoff after a goal, or
  // a free-kick setup) lifts and play actually resumes — covers "khi có
  // thông báo thổi còi đá thì bắt đầu tiếp tục" without the server needing
  // to predict exactly when its own freeze timer will elapse client-side.
  const wasFrozenRef = useRef(false);
  useEffect(() => {
    const isFrozen = state.kickoffUntil !== null && state.kickoffUntil > state.serverNow;
    if (wasFrozenRef.current && !isFrozen && state.status === "playing") {
      setToasts((prev) => [...prev, { id: `whistle-${Date.now()}`, text: "🔔 Bắt đầu!", expiresAt: Date.now() + 1200 }]);
      playWhistle();
    }
    wasFrozenRef.current = isFrozen;
  }, [state.kickoffUntil, state.serverNow, state.status]);

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
      const refereePos = (() => {
        const prev = prevS?.referee;
        if (!prev) return { x: s.referee.x, y: s.referee.y };
        if (Math.hypot(s.referee.x - prev.x, s.referee.y - prev.y) > SOCCER_PLAYER_RADIUS * 4) return { x: s.referee.x, y: s.referee.y };
        return { x: prev.x + (s.referee.x - prev.x) * tickT, y: prev.y + (s.referee.y - prev.y) * tickT };
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
      drawReferee(ctx, s.referee, refereePos.x, refereePos.y, now);

      drawBall(ctx, ballPos.x, ballPos.y);

      for (const fx of tackleFxRef.current) drawTackleParticles(ctx, fx, (now - fx.start) / TACKLE_FX_DURATION_MS);

      kickFxRef.current = kickFxRef.current.filter((fx) => now - fx.start < KICK_FX_DURATION_MS);
      for (const fx of kickFxRef.current) drawKickFx(ctx, fx, (now - fx.start) / KICK_FX_DURATION_MS);

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [selfId]);

  const self = state.players.find((p) => p.id === selfId);

  // `md:hidden` alone gates on viewport *width*, so a phone rotated to
  // landscape (often ≥768px wide) silently lost every touch control even
  // though it's still a touch device with no keyboard — that was the "quay
  // ngang thì mất joystick" bug. Detecting real pointer capability instead
  // means controls survive rotation; orientation only changes *how* they're
  // laid out (see touchPortrait below), never *whether* they show at all.
  const [touchUI, setTouchUI] = useState({ show: false, portrait: true });
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const portraitQuery = window.matchMedia("(orientation: portrait)");
    const update = () => setTouchUI({ show: coarse.matches, portrait: portraitQuery.matches });
    update();
    coarse.addEventListener("change", update);
    portraitQuery.addEventListener("change", update);
    return () => {
      coarse.removeEventListener("change", update);
      portraitQuery.removeEventListener("change", update);
    };
  }, []);

  // Long-press on a touch button otherwise triggers the browser's text
  // selection / copy callout (and the context menu) — select-none stops the
  // highlight, the callout property stops iOS's popup, and swallowing
  // contextmenu stops Android's long-press menu.
  const noSelect = "select-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent]";
  const blockMenu = (e: React.SyntheticEvent) => e.preventDefault();

  const joystick = (
    <div
      ref={input.joyBaseRef}
      onContextMenu={blockMenu}
      onPointerDown={input.handleJoyPointerDown}
      onPointerMove={input.handleJoyPointerMove}
      onPointerUp={input.resetJoystick}
      onPointerCancel={input.resetJoystick}
      className={`relative h-20 w-20 shrink-0 touch-none ${noSelect} rounded-full border border-white/40 bg-black/25`}
    >
      <div ref={input.joyKnobRef} className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow" />
    </div>
  );
  const sprintButton = (
    <button
      type="button"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        input.setBoost(true);
      }}
      onPointerUp={() => input.setBoost(false)}
      onPointerCancel={() => input.setBoost(false)}
      className={`flex h-12 w-12 shrink-0 touch-none items-center justify-center rounded-full border border-white/40 bg-sky-500/80 text-[10px] font-bold leading-tight text-white shadow-lg ${noSelect}`}
      onContextMenu={blockMenu}
    >
      ⚡ NHANH
    </button>
  );
  const tackleButton = (
    <button
      type="button"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        input.tackle();
      }}
      className={`flex h-12 w-12 shrink-0 touch-none items-center justify-center rounded-full border border-white/40 bg-amber-400/80 text-xs font-bold text-white shadow-lg ${noSelect}`}
      onContextMenu={blockMenu}
    >
      TẮC
    </button>
  );
  const shootButton = (
    <button
      type="button"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        input.startKick();
      }}
      onPointerUp={input.releaseKick}
      onPointerCancel={input.releaseKick}
      className={`flex h-16 w-16 shrink-0 touch-none items-center justify-center rounded-full border border-white/40 bg-red-500/80 text-xs font-bold text-white shadow-lg ${noSelect}`}
      onContextMenu={blockMenu}
    >
      SÚT
    </button>
  );

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
          onContextMenu={blockMenu}
          className="block w-full touch-none select-none rounded-xl border border-slate-200 bg-green-600 shadow-xl"
          style={{ aspectRatio: `${SOCCER_FIELD_W} / ${SOCCER_FIELD_H}` }}
        />

        {toasts.length > 0 && (
          <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-1.5">
            {toasts.map((t) =>
              t.image ? (
                <div key={t.id} className="animate-bounce-in flex flex-col items-center gap-1 rounded-2xl bg-white px-5 py-3 shadow-2xl ring-2 ring-black/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.image} alt="" className="h-20 w-20 object-contain" />
                  <span className="max-w-[240px] text-center text-sm font-bold text-ink">{t.text}</span>
                  {t.subtext && <span className="max-w-[240px] text-center text-xs text-ink/60">{t.subtext}</span>}
                </div>
              ) : (
                <div key={t.id} className="animate-bounce-in rounded-lg bg-black/75 px-3 py-1.5 text-sm font-semibold text-white shadow-lg">
                  {t.text}
                </div>
              )
            )}
          </div>
        )}

        {/* Landscape: phones are wide but short here, so there's no room to
            spare for a dedicated control bar below the canvas — controls stay
            overlaid at the corners like before, just now gated on real touch
            capability instead of viewport width (see touchUI above), so they
            no longer vanish on rotation. */}
        {touchUI.show && !touchUI.portrait && (
          <>
            <div className="absolute bottom-3 left-3">{joystick}</div>
            <div className="absolute bottom-3 right-3 flex items-end gap-2">
              {sprintButton}
              {tackleButton}
              {shootButton}
            </div>
          </>
        )}
      </div>

      {/* Portrait: the field is already squeezed into a short letterboxed
          strip by its wide aspect ratio, so overlaying a 96px joystick and
          two buttons directly on it (the old layout) covered a big chunk of
          the only visible play area — exactly what was reported as
          unplayable. A reserved row below the canvas costs some vertical
          space but keeps the whole field visible and unobstructed. */}
      {touchUI.show && touchUI.portrait && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-800/90 px-3 py-2.5 shadow-xl">
          {joystick}
          <div className="flex items-end gap-2">
            {sprintButton}
            {tackleButton}
            {shootButton}
          </div>
        </div>
      )}

      <p className="text-center text-[11px] text-ink/40">
        {touchUI.show
          ? "Joystick: di chuyển · Chạm giữ SÚT để sạc lực rồi thả ra chuyền/sút · TẮC: tắc bóng · NHANH: chạy nước rút"
          : "Di chuyển: WASD/mũi tên · Chuột: ngắm hướng, giữ chuột trái để sạc lực rồi thả ra chuyền/sút · Space: tắc bóng · Shift: chạy nước rút"}
      </p>
      {self && (
        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 shadow-xl">
          <span className="shrink-0 text-xs font-medium text-slate-500">{touchUI.show ? "⚡ Nước rút" : "⚡ Nước rút (Shift)"}</span>
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

// Limb stance while running — see drawPlayer's doc for the coordinate
// convention. leg.png (and hand.png, pixel-identical — Kenney's Sports Pack
// reuses one limb shape for both) is drawn shoe/tip-first along its own
// local +x, so at rest it always points the same way regardless of which
// side it's playing. drawLimb below reuses the same sprite for both the
// forward and trailing copy each stride by mirroring it horizontally
// (ctx.scale(-1, 1)) for whichever half is currently trailing, so the
// tip visibly flips to point backward-and-out instead of forever pointing
// the same direction it does at rest — no separate mirrored asset needed.
const LEG_SIDE_OFFSET = 3;
const LEG_BASE_X = -1;
const LEG_STRIDE_AMPLITUDE = 3.5;
const LEG_FLARE_RAD = (16 * Math.PI) / 180;
// Arms sit toward the front half (positive base X, same side the body
// faces) and swing wider than the legs — visibly "vung tay ra phía trước".
const ARM_SIDE_OFFSET = 8;
const ARM_BASE_X = 3;
const ARM_STRIDE_AMPLITUDE = 5;
const ARM_FLARE_RAD = (30 * Math.PI) / 180;

/** One limb (a leg or an arm) at one instant of the running cycle. `phase`
 * is the shared running clock; `phaseOffset` staggers left vs right (and,
 * for arms, staggers against the same-side leg for a contralateral gait).
 * `sideSign` is -1/+1 for which side of centerline this copy sits on. */
function drawLimb(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLImageElement | undefined,
  moving: boolean,
  phase: number,
  phaseOffset: number,
  sideSign: 1 | -1,
  baseX: number,
  sideOffset: number,
  strideAmp: number,
  flareRad: number
) {
  if (!sprite) return;
  // `phase` free-runs off wall-clock time regardless of `moving`, so a
  // standing player needs a fixed pose rather than still evaluating
  // sin(phase) — otherwise the mirror flip below would toggle on and off
  // while stationary, a flicker with no motion to justify it.
  const swing = moving ? Math.sin(phase + phaseOffset) : 1; // -1 (fully trailing) .. +1 (fully forward)
  ctx.save();
  ctx.translate(baseX + swing * strideAmp, sideOffset * sideSign);
  ctx.rotate(swing * flareRad * sideSign);
  if (swing < 0) ctx.scale(-1, 1); // trailing half of the cycle — flip so the tip points backward, not still forward
  ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: SoccerPlayer, x: number, y: number, isSelf: boolean, now: number) {
  const color = SOCCER_TEAM_COLOR[p.team];
  const body = getSprite(`/soccer/${color}/body.png`);
  const leg = getSprite(`/soccer/${color}/leg.png`);
  const hand = getSprite(`/soccer/${color}/hand.png`);

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
  // Local +x after the rotate above points along the facing direction,
  // local +y is perpendicular to it. Legs draw before the body (mostly
  // tucked under the torso, peeking out at each stride extreme); arms draw
  // after (visibly swinging beside it) — see drawLimb's doc for how a
  // single limb sprite serves as both the forward and trailing copy.
  const phase = now / 90;
  drawLimb(ctx, leg, p.moving, phase, 0, -1, LEG_BASE_X, LEG_SIDE_OFFSET, LEG_STRIDE_AMPLITUDE, LEG_FLARE_RAD);
  drawLimb(ctx, leg, p.moving, phase, Math.PI, 1, LEG_BASE_X, LEG_SIDE_OFFSET, LEG_STRIDE_AMPLITUDE, LEG_FLARE_RAD);
  // Contralateral gait — each arm shares its phase with the opposite leg.
  // Drawn before the body too (same as the legs above), so the body sits on
  // top and only the swinging tips peek out from behind/beside it, instead
  // of the hands visibly lying over the torso.
  drawLimb(ctx, hand, p.moving, phase, Math.PI, -1, ARM_BASE_X, ARM_SIDE_OFFSET, ARM_STRIDE_AMPLITUDE, ARM_FLARE_RAD);
  drawLimb(ctx, hand, p.moving, phase, 0, 1, ARM_BASE_X, ARM_SIDE_OFFSET, ARM_STRIDE_AMPLITUDE, ARM_FLARE_RAD);
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

/** The referee — same body+limb composition as drawPlayer, minus everything
 * that's per-match-player-only (no card badge, no kick-charge ring, no name
 * label, no self-ring). public/soccer/referee/ only ships body.png and
 * hand.png (no dedicated leg.png), so the same hand sprite stands in for
 * both the arm slots and the leg slots — visually it's still "two arms, two
 * legs", just built from one limb asset instead of two. */
function drawReferee(ctx: CanvasRenderingContext2D, referee: SoccerReferee, x: number, y: number, now: number) {
  const body = getSprite("/soccer/referee/body.png");
  const limb = getSprite("/soccer/referee/hand.png");

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y + SOCCER_PLAYER_RADIUS * 0.6, SOCCER_PLAYER_RADIUS * 0.8, SOCCER_PLAYER_RADIUS * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fill();

  ctx.translate(x, y);
  ctx.rotate(referee.angle);
  const phase = now / 90;
  drawLimb(ctx, limb, referee.moving, phase, 0, -1, LEG_BASE_X, LEG_SIDE_OFFSET, LEG_STRIDE_AMPLITUDE, LEG_FLARE_RAD);
  drawLimb(ctx, limb, referee.moving, phase, Math.PI, 1, LEG_BASE_X, LEG_SIDE_OFFSET, LEG_STRIDE_AMPLITUDE, LEG_FLARE_RAD);
  drawLimb(ctx, limb, referee.moving, phase, Math.PI, -1, ARM_BASE_X, ARM_SIDE_OFFSET, ARM_STRIDE_AMPLITUDE, ARM_FLARE_RAD);
  drawLimb(ctx, limb, referee.moving, phase, 0, 1, ARM_BASE_X, ARM_SIDE_OFFSET, ARM_STRIDE_AMPLITUDE, ARM_FLARE_RAD);
  if (body) ctx.drawImage(body, -body.width / 2, -body.height / 2, body.width, body.height);
  ctx.restore();
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

/** The "hiệu ứng phát ra từ cầu thủ" on every kick — a quick white contact
 * flash plus a few blades of grass flicked forward, distinct from the
 * tackle's brown dirt spray (grass-green here, and a much shorter-lived,
 * tighter cone since a kick is a clean strike, not a slide through mud). */
function drawKickFx(ctx: CanvasRenderingContext2D, fx: KickFx, progress: number) {
  const flashT = Math.min(1, progress / 0.45);
  if (flashT < 1) {
    const fx0 = fx.x + Math.cos(fx.angle) * 6;
    const fy0 = fx.y + Math.sin(fx.angle) * 6;
    ctx.beginPath();
    ctx.arc(fx0, fy0, SOCCER_PLAYER_RADIUS * (0.3 + flashT * 1.1) * (0.6 + fx.power * 0.5), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${(1 - flashT) * 0.85})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const fade = Math.max(0, 1 - progress);
  if (fade <= 0) return;
  const ease = 1 - Math.pow(1 - progress, 2);
  for (const p of fx.particles) {
    const worldAngle = fx.angle + p.angle;
    const px = fx.x + Math.cos(worldAngle) * p.dist * ease;
    const py = fx.y + Math.sin(worldAngle) * p.dist * ease;
    ctx.beginPath();
    ctx.arc(px, py, p.size * fade, 0, Math.PI * 2);
    ctx.fillStyle = "#8fce5a";
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
