'use client';

import type { HillInput } from '@shared/hillTypes';
import type { HillRaceFrame } from '@shared/hillRaceTypes';
import { HillMiniMap } from './HillMiniMap';
import { GameButton } from './HillUi';
import { formatNumber } from './hillUiData';

// Everything drawn over a race, online or against bots: rank, the strip of
// cars along the course, fuel and energy, status toasts, and the same pedal
// layout as solo (brake left, gas right, dash and jump above them).

const PEDAL = 'h-24 w-28 touch-none rounded-3xl border-b-8 border-black/30 text-xl font-black shadow-lg transition-transform sm:h-28 sm:w-40 disabled:opacity-50';
const ACTION = 'absolute bottom-36 touch-none rounded-full border-2 px-5 py-3 font-bold shadow-lg disabled:opacity-40';

export function HillRaceHud({
  frame,
  myId,
  names,
  finish,
  label,
  connected = true,
  held,
  onPress,
  onRespawn,
  leave,
  muted,
  onMute,
}: {
  frame: HillRaceFrame;
  myId: string;
  names: (id: string) => string;
  /** Finish line (m), or null for "ai đi xa nhất". */
  finish: number | null;
  label: string;
  connected?: boolean;
  held: HillInput;
  onPress: (key: keyof HillInput, down: boolean) => void;
  onRespawn: () => void;
  leave: React.ReactNode;
  muted: boolean;
  onMute: () => void;
}) {
  const car = frame.cars.find((item) => item.id === myId);
  const ranked = [...frame.cars].sort((a, b) => (a.finishTick ?? Infinity) - (b.finishTick ?? Infinity) || b.state.distance - a.state.distance);
  const rank = ranked.findIndex((item) => item.id === myId) + 1;
  const locked = !connected || !!car?.done;
  const overturned = car?.state.overturnRemaining != null;
  /** Racing to a finish on an empty tank: the car limps on (HillSim) until the next can. */
  const limping = finish !== null && !!car && !car.done && car.state.fuel <= 0;
  // "Ai đi xa nhất" has no finish: the map reaches a bit past the leader and grows in 100 m steps.
  const furthest = Math.max(0, ...frame.cars.map((item) => item.state.distance));
  const course = finish ?? Math.max(300, Math.ceil((furthest + 150) / 100) * 100);
  const hold = (key: keyof HillInput) => ({
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      navigator.vibrate?.(8);
      onPress(key, true);
    },
    onPointerUp: () => onPress(key, false),
    onPointerCancel: () => onPress(key, false),
    onLostPointerCapture: () => onPress(key, false),
  });

  return (
    <>
      <div className="absolute inset-x-0 top-0 flex items-start gap-2 p-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="shrink-0 rounded-2xl bg-emerald-950/80 px-3 py-1.5 text-center backdrop-blur">
          <p className="font-draw-display text-3xl font-extrabold leading-none">
            {rank || '–'}
            <span className="text-base text-emerald-100/60">/{frame.cars.length}</span>
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/60">Hạng</p>
        </div>
        <div className="min-w-0 flex-1 rounded-2xl bg-emerald-950/80 px-3 py-2 backdrop-blur">
          <div className="flex justify-between gap-2 text-xs font-bold">
            <span className="truncate text-emerald-100/70">
              {label}
              {frame.remaining !== null ? ` · còn ${Math.ceil(frame.remaining)}s` : ''}
            </span>
            <span className="shrink-0 tabular-nums">
              {finish ? `còn ${formatNumber(Math.max(0, finish - (car?.state.distance ?? 0)))} m` : `${formatNumber(car?.state.distance ?? 0)} m`}
            </span>
          </div>
          <HillMiniMap
            seed={frame.seed}
            map={(car ?? frame.cars[0]).state.map}
            length={course}
            cars={frame.cars.filter((item) => !item.respawning).map((item) => ({ id: item.id, distance: item.state.distance }))}
            myId={myId}
            names={names}
          />
        </div>
        <div className="w-24 shrink-0 space-y-1.5 rounded-2xl bg-emerald-950/80 p-2 text-[11px] font-bold backdrop-blur sm:w-32">
          {limping ? (
            <p className="animate-pulse text-center text-red-300">⛽ Cầm cự</p>
          ) : (
            <Meter label="⛽" value={car?.state.fuel ?? 0} color={(car?.state.fuel ?? 100) < 20 ? 'bg-red-400' : 'bg-amber-300'} />
          )}
          <Meter label="⚡" value={car?.state.energy ?? 0} color="bg-cyan-300" />
        </div>
      </div>
      <div className="absolute right-3 flex gap-2 text-xs" style={{ top: 'calc(max(12px, env(safe-area-inset-top)) + 4.25rem)' }}>
        <button className="rounded-lg bg-emerald-950/80 px-2.5 py-2" onClick={onMute} aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}>
          {muted ? '🔇' : '🔊'}
        </button>
        {leave}
      </div>

      {!connected && <Toast tone="red">Mất kết nối, đang nối lại…</Toast>}
      {car?.squash && <Toast tone="red">🥞 Bị giẫm bẹp! Nhảy (W) hoặc lao tới (Space) để gỡ lại</Toast>}
      {car?.respawning && <Toast>↺ Đang hồi sinh tại checkpoint…</Toast>}
      {limping && !car?.squash && <Toast tone="red">⛽ Hết xăng! Đang chạy cầm cự — nhặt can xăng phía trước</Toast>}
      {car?.done && <Toast>{car.finishTick !== null ? '🏁 Về đích! Đang chờ các xe khác…' : '⛽ Hết xăng! Đang chờ các xe khác…'}</Toast>}
      {car?.stuck && !car.done && (
        <GameButton className="absolute bottom-[15.5rem] left-1/2 -translate-x-1/2 px-5 py-2.5 text-lg" onClick={onRespawn}>
          ↺ Hồi sinh
        </GameButton>
      )}

      <button disabled={locked} aria-label="Lao tới" {...hold('dash')} className={`${ACTION} left-6 border-amber-100/50 bg-orange-800/90 sm:left-12`}>
        💨 Lao tới
        <span className="block text-[10px] font-normal">{car?.state.dashCooldown ? `${car.state.dashCooldown.toFixed(1)}s` : '25⚡ · Space'}</span>
      </button>
      <button disabled={locked} aria-label={overturned ? 'Bật lật' : 'Nhảy'} {...hold('jump')} className={`${ACTION} right-6 border-cyan-100/50 bg-cyan-800/90 sm:right-12`}>
        {overturned ? '↻ Bật lật' : '↑ Nhảy'}
        <span className="block text-[10px] font-normal">35⚡ · ↑ / W</span>
      </button>
      <div className="absolute inset-x-0 bottom-0 flex justify-between px-5 sm:px-10" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <button disabled={locked} aria-label="Phanh / lùi" aria-pressed={!!held.brake} {...hold('brake')} className={`${PEDAL} bg-stone-100 text-stone-700 ${held.brake ? 'translate-y-2 border-b-0' : ''}`}>
          ← PHANH<span className="mt-1 block text-xs font-medium">A / ←</span>
        </button>
        <button disabled={locked} aria-label="Ga" aria-pressed={!!held.gas} {...hold('gas')} className={`${PEDAL} bg-amber-400 text-amber-950 ${held.gas ? 'translate-y-2 border-b-0' : ''}`}>
          GA →<span className="mt-1 block text-xs font-medium">D / →</span>
        </button>
      </div>
    </>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span>{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
    </div>
  );
}

function Toast({ tone, children }: { tone?: 'red'; children: React.ReactNode }) {
  return (
    <p role="status" className={`absolute left-1/2 top-[6.5rem] w-max max-w-[90vw] -translate-x-1/2 rounded-2xl px-4 py-2 text-center text-sm font-bold shadow-lg ${tone === 'red' ? 'bg-red-900/90' : 'bg-emerald-950/90'}`}>
      {children}
    </p>
  );
}
