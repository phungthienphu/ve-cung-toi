'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HillBotDriver, HILL_BOT_NAMES, type HillBotLevel } from '@shared/hill/bot';
import { HillRaceSim } from '@shared/hill/raceSim';
import { HILL_DT, HILL_VEHICLES, type HillInput, type HillMapId, type HillVehicleId } from '@shared/hill/types';
import type { HillRaceConfig, HillRaceFrame, HillRacer, HillRaceState } from '@shared/hill/raceTypes';
import { isMuted, playCorrect, playHillDash, playHillJump, playHillLanding, playMatchLose, playMatchWin, setMuted } from '@/lib/sound';
import HillRaceCanvas from './HillRaceCanvas';
import { HillRaceHud } from './HillRaceHud';
import { HillRaceResults } from './HillLobby';
import { HillPause } from './HillResults';
import { GameButton } from './HillUi';

// A race against computer drivers, simulated entirely in this browser with
// the same HillRaceSim as the online rooms: no server, no network, nothing
// counted against the Cloudflare quota — and it can pause.

export interface HillBotSetup {
  bots: number;
  level: HillBotLevel;
  mode: 'race' | 'distance';
  length: 600 | 1200 | 2000;
  collisions: boolean;
  randomMap: boolean;
}
export const DEFAULT_BOT_SETUP: HillBotSetup = { bots: 3, level: 'normal', mode: 'race', length: 1200, collisions: true, randomMap: false };
export const BOT_LEVELS: { value: HillBotLevel; label: string }[] = [
  { value: 'easy', label: '😊 Dễ' },
  { value: 'normal', label: '😐 Vừa' },
  { value: 'hard', label: '😈 Khó' },
];

const ME = 'me';
const VEHICLES = Object.keys(HILL_VEHICLES) as HillVehicleId[];
const POINTS = [10, 7, 5, 3, 2, 1];
const KEYS: Record<string, keyof HillInput> = { KeyA: 'brake', ArrowLeft: 'brake', KeyD: 'gas', ArrowRight: 'gas', KeyW: 'jump', ArrowUp: 'jump', Space: 'dash' };

export default function HillBotRace({ setup, map, vehicle, name, onExit }: { setup: HillBotSetup; map: HillMapId; vehicle: HillVehicleId; name: string; onExit: () => void }) {
  const [run, setRun] = useState(0);
  const [hud, setHud] = useState<HillRaceFrame | null>(null);
  const [result, setResult] = useState<{ frame: HillRaceFrame; order: string[] } | null>(null);
  const [held, setHeld] = useState<HillInput>({ gas: false, brake: false });
  const [paused, setPaused] = useState(false);
  const [muted, updateMuted] = useState(false);
  const input = useRef<HillInput>({ gas: false, brake: false });
  const seq = useRef(0);
  const frameRef = useRef<HillRaceFrame | null>(null);
  const raceRef = useRef<HillRaceSim | null>(null);
  const pausedRef = useRef(false);
  useEffect(() => updateMuted(isMuted()), []);

  const config = useMemo<HillRaceConfig>(
    () => ({ map: setup.randomMap ? 'random' : map, length: setup.length, mode: setup.mode, collisions: setup.collisions, rounds: 1, vehicle: 'choice' }),
    [setup, map],
  );
  // New opponents (and their cars) every race.
  const players = useMemo<HillRacer[]>(() => {
    const offset = Math.floor(Math.random() * VEHICLES.length);
    const names = [...HILL_BOT_NAMES].sort(() => Math.random() - 0.5);
    return [
      { id: ME, name: name.trim() || 'Bạn', vehicle, ready: true, connected: true, points: 0 },
      ...Array.from({ length: setup.bots }, (_, i) => ({ id: `bot${i}`, name: `${names[i]} 🤖`, vehicle: VEHICLES[(offset + i) % VEHICLES.length], ready: true, connected: true, points: 0 })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, setup.bots, vehicle, name]);

  const setPause = useCallback((value: boolean) => {
    pausedRef.current = value;
    setPaused(value);
  }, []);

  const press = useCallback((key: keyof HillInput, down: boolean) => {
    if (!!input.current[key] === down) return;
    input.current = { ...input.current, [key]: down };
    setHeld(input.current);
    raceRef.current?.input(ME, input.current, ++seq.current);
  }, []);

  useEffect(() => {
    const seed = (Date.now() + run * 7919) >>> 0;
    const race = new HillRaceSim(seed, config, players);
    const drivers = players.filter((player) => player.id !== ME).map((player, i) => new HillBotDriver(player.id, setup.level, seed + i * 104729));
    raceRef.current = race;
    frameRef.current = race.snapshot();
    setHud(frameRef.current);
    setResult(null);
    input.current = { gas: false, brake: false };
    setHeld(input.current);
    seq.current = 0;

    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let hudAt = 0;
    let previous: HillRaceFrame | null = null;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (pausedRef.current) accumulator = 0;
      else {
        accumulator += dt;
        while (accumulator >= HILL_DT && !race.ended) {
          for (const driver of drivers) driver.drive(race);
          race.step();
          accumulator -= HILL_DT;
        }
      }
      const frame = race.snapshot();
      frameRef.current = frame;
      const a = previous?.cars.find((car) => car.id === ME);
      const b = frame.cars.find((car) => car.id === ME);
      if (a && b && frame.tick >= 0) {
        if (b.state.dashCooldown > a.state.dashCooldown + 0.5) playHillDash();
        if (b.state.jumpCooldown > a.state.jumpCooldown + 0.2) playHillJump();
        if (b.squashed > a.squashed || b.crashes > a.crashes) playHillLanding();
        if (b.done && !a.done) playCorrect();
      }
      previous = frame;
      if (now - hudAt > 90) {
        setHud(frame);
        hudAt = now;
      }
      if (race.ended) {
        const order = race.order();
        setHud(frame);
        setResult({ frame, order });
        (order[0] === ME ? playMatchWin : playMatchLose)();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [run, config, players, setup.level]);

  useEffect(() => {
    const key = (event: KeyboardEvent, down: boolean) => {
      if (event.code === 'Escape' && down && !event.repeat) {
        setPause(!pausedRef.current);
        return;
      }
      const action = KEYS[event.code];
      if (!action || pausedRef.current) return;
      event.preventDefault();
      press(action, down);
    };
    const down = (event: KeyboardEvent) => key(event, true);
    const up = (event: KeyboardEvent) => key(event, false);
    const away = () => {
      for (const action of ['gas', 'brake', 'jump', 'dash'] as const) press(action, false);
      if (!raceRef.current?.ended) setPause(true);
    };
    const visibility = () => document.hidden && away();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', away);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', away);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [press, setPause]);

  const pull = useCallback(() => frameRef.current, []);
  const again = () => {
    setPause(false);
    setRun((value) => value + 1);
  };
  const nameOf = (id: string) => players.find((player) => player.id === id)?.name ?? '';
  const finish = setup.mode === 'race' ? setup.length : null;
  const place = result ? result.order.indexOf(ME) + 1 : 0;
  const resultState: HillRaceState | null = result && {
    host: ME,
    players: players.map((player) => ({ ...player, points: POINTS[result.order.indexOf(player.id)] ?? 0 })),
    config,
    phase: 'results',
    round: 1,
    frame: result.frame,
    order: result.order,
    seriesOver: false,
  };

  return (
    <div className="fixed inset-0 z-30 touch-none select-none overflow-hidden bg-emerald-950 text-white">
      {hud && (
        <>
          <HillRaceCanvas key={run} frame={hud} id={ME} players={players} finishDistance={finish ?? undefined} input={input} seq={seq} pull={pull} audioActive={!paused && !result} />
          {!result && (
            <HillRaceHud
              frame={hud}
              myId={ME}
              names={nameOf}
              finish={finish}
              label={`🤖 ${setup.bots} bot · ${BOT_LEVELS.find((level) => level.value === setup.level)?.label ?? ''}`}
              held={held}
              onPress={press}
              onRespawn={() => raceRef.current?.requestRespawn(ME)}
              leave={
                <button className="rounded-lg bg-emerald-950/80 px-2.5 py-2 font-bold" onClick={() => setPause(true)}>
                  ⏸ Dừng
                </button>
              }
              muted={muted}
              onMute={() => {
                setMuted(!muted);
                updateMuted(!muted);
              }}
            />
          )}
        </>
      )}

      {paused && !result && (
        <div className="absolute inset-0 flex overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]">
          <div className="m-auto flex w-full justify-center">
            <HillPause onResume={() => setPause(false)} onRetry={again} onGarage={onExit} />
          </div>
        </div>
      )}

      {result && resultState && (
        <div className="absolute inset-0 flex touch-pan-y overflow-y-auto bg-black/55 p-4 backdrop-blur-[2px]">
          <div className="hk-race-end m-auto w-full max-w-2xl rounded-[28px] border border-white/15 bg-emerald-950/95 p-5 shadow-2xl">
            <HillRaceResults
              state={resultState}
              order={result.order}
              cars={result.frame.cars}
              title={place === 1 ? '🏆 Bạn về nhất!' : `Bạn về thứ ${place}/${players.length}`}
            />
            <div className="mt-5 flex gap-2">
              <GameButton onClick={again} className="flex-1 py-3 text-xl" autoFocus>
                ↻ Đua lại
              </GameButton>
              <GameButton tone="glass" onClick={onExit} className="px-4 py-3 text-base">
                🚙 Đổi xe / đường
              </GameButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
