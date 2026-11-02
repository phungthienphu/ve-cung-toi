'use client';
import { useEffect, useRef } from 'react';
import type { HillRaceFrame, HillRacer } from '@shared/hillRaceTypes';
import type { HillInput, HillSnapshot } from '@shared/hillTypes';
import { HillSim } from '@shared/hillSim';
import { HILL_DT, HILL_VEHICLES } from '@shared/hillTypes';
import { drawHill, hillProject, type HillCamera } from './drawHill';
import { HillFx } from './hillFx';
import { drawVehicle } from './drawVehicle';
import { drawJeepWheel } from './drawJeep';
/** `pull`: a race simulated in this browser (bots) — draw its latest frame as is, no interpolation or prediction. */
export default function HillRaceCanvas({ frame, id, players, input, seq, finishDistance, pull }: { frame: HillRaceFrame; id: string; players: HillRacer[]; finishDistance?: number; input: React.RefObject<HillInput>; seq: React.RefObject<number>; pull?: () => HillRaceFrame | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(frame); const names = useRef(players);
  useEffect(() => { latest.current = frame; names.current = players; }, [frame, players]);
  useEffect(() => {
    const el = canvas.current!, ctx = el.getContext('2d')!;
    let raf = 0, last = performance.now(), accumulator = 0, seen: HillRaceFrame | null = null;
    let previous: HillRaceFrame | null = null, received = last;
    let predictor: HillSim | null = null, predictedSeed = -1;
    let lastOwn: HillSnapshot | null = null;
    const correction = { x: 0, y: 0, angle: 0 };
    const history: { seq: number; input: HillInput }[] = [];
    const camera: HillCamera = { x: 5, y: 3, scale: 20 };
    const fx = new HillFx();
    const mix = (a: HillSnapshot, b: HillSnapshot, t: number): HillSnapshot => {
      const pose = (x: typeof a.chassis, y: typeof a.chassis) => ({ x: x.x + (y.x - x.x) * t, y: x.y + (y.y - x.y) * t, angle: x.angle + Math.atan2(Math.sin(y.angle - x.angle), Math.cos(y.angle - x.angle)) * t });
      return { ...b, chassis: pose(a.chassis, b.chassis), wheels: b.wheels.map((w, i) => pose(a.wheels[i], w)) };
    };
    const draw = (now: number) => {
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      const local = !!pull;
      const f = pull?.() ?? latest.current, own = f.cars.find(c => c.id === id) ?? f.cars[0];
      if (!own) { raf = requestAnimationFrame(draw); return; }
      if (f !== seen && local) { previous = seen; seen = f; received = now; }
      else if (f !== seen) {
        previous = seen; seen = f; received = now;
        if (!predictor || predictedSeed !== f.seed || predictor.vehicle !== own.state.vehicle) { predictor = new HillSim(f.seed, { map: own.state.map, vehicle: own.state.vehicle, raceFuel: own.state.raceFuel }); predictedSeed = f.seed; history.length = 0; }
        predictor.restore(own.state);
        // The server acknowledges input changes. Replay only unacknowledged local steps.
        while (history.length && history[0].seq <= own.ack) history.shift();
        if (f.tick >= 180 && !own.respawning && !own.done && !own.squash) for (const h of history) predictor.step(h.input);
        else history.length = 0;
        if (lastOwn && f.tick >= 180 && !own.respawning && !own.done && predictor) {
          const next = predictor.snapshot().chassis;
          correction.x = lastOwn.chassis.x - next.x; correction.y = lastOwn.chassis.y - next.y;
          correction.angle = Math.atan2(Math.sin(lastOwn.chassis.angle - next.angle), Math.cos(lastOwn.chassis.angle - next.angle));
          if (Math.hypot(correction.x, correction.y) > 8) correction.x = correction.y = correction.angle = 0;
        } else correction.x = correction.y = correction.angle = 0;
        accumulator = 0;
      }
      const predicting = !local && f.tick >= 180 && !own.respawning && !own.done && !own.squash;
      accumulator += dt;
      while (accumulator >= HILL_DT) {
        if (predicting && predictor) { predictor.step(input.current); history.push({ seq: seq.current, input: { ...input.current } }); if (history.length > 30) history.shift(); }
        accumulator -= HILL_DT;
      }
      const interpolation = Math.min(1, (now - received) / 100);
      const rendered = local ? f.cars.map(c => ({ ...c })) : f.cars.map(c => {
        const before = previous?.cars.find(p => p.id === c.id);
        return { ...c, state: before && previous?.seed === f.seed ? mix(before.state, c.state, interpolation) : c.state };
      });
      const ownRender = rendered.find(c => c.id === own.id)!;
      if (predicting && predictor) ownRender.state = predictor.snapshot();
      if (predicting) {
        const decay = Math.exp(-dt * 30); correction.x *= decay; correction.y *= decay; correction.angle *= decay;
        const corrected = (p: HillSnapshot["chassis"]) => ({ x: p.x + correction.x, y: p.y + correction.y, angle: p.angle + correction.angle });
        ownRender.state = { ...ownRender.state, chassis: corrected(ownRender.state.chassis), wheels: ownRender.state.wheels.map(corrected) };
      }
      lastOwn = ownRender.state;
      const rect = el.getBoundingClientRect(), w = rect.width, h = rect.height, dpr = Math.min(2, devicePixelRatio || 1);
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
      fx.observe(rendered.map(c => ({ id: c.id, state: c.state, ghost: c.ghost, squash: c.squash, respawning: c.respawning })), f.seed, own.state.map, f.tick >= 0 ? dt : 0, own.id);
      fx.update(dt);
      const shake = fx.offset();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(shake.x, shake.y);
      // drawHill draws the local vehicle. Other vehicles share its camera transform.
      // Gates: in front of the starting tower (front column at 11 m with 4+ cars, else 5 m), and at the finish (distance is counted from x = 5).
      drawHill(ctx, w, h, f.seed, ownRender.state, camera, dt, [], ownRender.respawning ? .2 : ownRender.ghost ? .5 : 1, ownRender.squash ? .55 : 1,
        { start: (f.cars.length > 3 ? 11 : 5) + 3.2, finish: finishDistance !== undefined ? finishDistance + 5 : undefined });
      const view = hillProject(camera, w, h), { sx, sy } = view;
      for (const car of rendered) {
        const s = car.state, vehicle = HILL_VEHICLES[s.vehicle];
        ctx.save(); ctx.globalAlpha = car.respawning ? .2 : car.ghost ? .5 : 1;
        if (car.id !== own.id) {
          ctx.save(); ctx.translate(sx(s.chassis.x), sy(s.chassis.y)); ctx.rotate(-s.chassis.angle); ctx.scale(camera.scale, -camera.scale * (car.squash ? .55 : 1)); drawVehicle(ctx, s); ctx.restore();
          for (const wheel of s.wheels) { ctx.save(); ctx.translate(sx(wheel.x), sy(wheel.y)); ctx.rotate(-wheel.angle); ctx.scale(camera.scale, -camera.scale); drawJeepWheel(ctx, vehicle.wheelRadius); ctx.restore(); }
        }
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = f.tick < 0 ? 'left' : 'center'; ctx.fillStyle = car.id === id ? '#fff8a8' : '#fff'; ctx.strokeStyle = '#173c40'; ctx.lineWidth = 4;
        const label = `${car.squash ? '💥 ' : ''}${names.current.find(p => p.id === car.id)?.name ?? ''}${car.respawning ? ' ↺' : ''}`;
        const labelX = sx(s.chassis.x) + (f.tick < 0 ? vehicle.halfWidth * camera.scale + 8 : 0);
        const labelY = sy(s.chassis.y) - (f.tick < 0 ? 8 : 43);
        ctx.strokeText(label, labelX, labelY); ctx.fillText(label, labelX, labelY); ctx.restore();
      }
      fx.draw(ctx, view);
      if (f.tick < 0) { ctx.font = 'bold 80px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(String(Math.ceil(-f.tick / 60)), w / 2, h * .4); }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, [id, input, seq, finishDistance, pull]);
  return <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label="Đường đua nhiều người" />;
}
