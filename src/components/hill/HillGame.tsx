"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HillSim } from "@shared/hillSim";
import { HILL_DT, HILL_MAPS, HILL_VEHICLES, HILL_BASE_SEED, hillDay, hillDailySeed, type HillInput, type HillSnapshot, type HillMapId, type HillVehicleId, type HillWallet, type HillBoard, type HillFlag, type HillRunSubmission } from "@shared/hillTypes";
import { getOrCreatePlayerId, getStoredName, setStoredName } from "@/lib/player";
import { getAudioContext, isMuted, setMuted, playPop, playCorrect, playWhoosh, playClockTick, playHillJump, playHillDash, playHillLanding } from "@/lib/sound";
import { hillWalletView, readHillProgress, cacheHillRun, syncHillProgress, buyHillVehicle, loadHillBoard, hillRecordKey } from "@/lib/hillProgress";
import { drawFontClass } from "@/lib/drawFonts";
import HillBotRace, { DEFAULT_BOT_SETUP, type HillBotSetup } from "./HillBotRace";
import HillGarage, { type HillMode } from "./HillGarage";
import { HillPause, HillResults } from "./HillResults";
import { drawHill, hillProject, type HillCamera, type HillView } from "./drawHill";
import { HillFx } from "./hillFx";
import { formatNumber } from "./hillUiData";

/** "bots": a bot race (HillBotRace) has the screen; the solo canvas rests underneath. */
type Phase = "ready" | "countdown" | "running" | "paused" | "finished" | "bots";
const BOT_SETUP_KEY = "vct_hill_bots";
const SEED = HILL_BASE_SEED;
const KEYS: Record<string, keyof HillInput> = { ArrowRight: "gas", KeyD: "gas", ArrowLeft: "brake", KeyA: "brake", Space: "dash", ArrowUp: "jump", KeyW: "jump" };
const IDLE: HillInput = { gas: false, brake: false };
/** The garage close-up: the car big and clear of the menu panel (bottom on phones held upright, right otherwise). */
const garageView = (w: number, h: number): HillView => (h > w ? { zoom: 2.6, focusX: 0.5, focusY: 0.24 } : { zoom: 2.1, focusX: 0.27, focusY: 0.52 });
/** The start gate, just ahead of the car's front bumper (the bus is the longest, 2.65 m from centre). */
const SOLO_START = 8.2;

export default function HillGame() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const sim = useRef<HillSim | null>(null);
  const camera = useRef<HillCamera>({ x: 5, y: 1.5, scale: 24 });
  const pressed = useRef(new Set<string>());
  const pendingActions = useRef(new Set<"jump" | "dash">());
  const phaseRef = useRef<Phase>("ready");
  const [phase, setPhase] = useState<Phase>("ready");
  const [snapshot, setSnapshot] = useState<HillSnapshot | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [muted, updateMuted] = useState(false);
  const [gas, setGas] = useState(false);
  const [brake, setBrake] = useState(false);
  const [map, setMap] = useState<HillMapId>("tea");
  const [vehicle, setVehicle] = useState<HillVehicleId>("jeep");
  const [mode, setMode] = useState<HillMode>("record");
  const daily = mode === "daily";
  const [botSetup, setBotSetup] = useState<HillBotSetup>(DEFAULT_BOT_SETUP);
  const [day, setDay] = useState("");
  const [name, setName] = useState("");
  const [wallet, setWallet] = useState<HillWallet>({ coins: 0, unlocked: ["jeep"] });
  const [board, setBoard] = useState<HillBoard | null>(null);
  const [best, setBest] = useState(0);
  const [newRecord, setNewRecord] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const playerId = useRef("");
  const run = useRef<{ id: string; day: string | null; name: string } | null>(null);
  const flags = useRef<HillFlag[]>([]);
  const bestBefore = useRef(0);
  const [notice, setNotice] = useState("");
  const countdownTime = useRef(3);
  /** Garage steps simulated so far: the parked car drops onto the road and settles, then the physics rests. */
  const previewTicks = useRef(0);
  const fx = useRef<HillFx | null>(null);
  const [bests, setBests] = useState<Partial<Record<HillMapId, number>>>({});
  const audioNodes = useRef<{ oscillator: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null>(null);

  function changePhase(next: Phase) { phaseRef.current = next; setPhase(next); }
  function clearInput() { pressed.current.clear(); pendingActions.current.clear(); setGas(false); setBrake(false); }
  const refreshProgress = useCallback(async () => {
    if (!playerId.current) { setSaveStatus("Trình duyệt chưa cho lưu dữ liệu trên máy."); return; }
    setBusy(true);
    try {
      const progress = await syncHillProgress(playerId.current); setWallet(hillWalletView(progress));
      setSaveStatus(progress.rejected?.length ? `Đã đồng bộ. Có ${progress.rejected.length} lượt chỉ lưu trên máy: ${progress.rejected.at(-1)?.reason}.` : "Đã đồng bộ xu và lượt chạy.");
    } catch (error) { setWallet(hillWalletView(readHillProgress(playerId.current))); setSaveStatus(`${error instanceof Error ? error.message : "Chưa đồng bộ được"}. Lượt chưa gửi được giữ trên máy.`); }
    finally { setBusy(false); }
  }, []);
  async function buy(id: HillVehicleId) {
    setBusy(true);
    try { await syncHillProgress(playerId.current); const progress = await buyHillVehicle(playerId.current, id); setWallet(hillWalletView(progress)); setVehicle(id); setSaveStatus(`Đã mở ${HILL_VEHICLES[id].name}!`); }
    catch (error) { setSaveStatus(error instanceof Error ? error.message : "Chưa mở được xe"); }
    finally { setBusy(false); }
  }
  function start() {
    if (!wallet.unlocked.includes(vehicle)) return;
    const today = hillDay(); setDay(today);
    const runDay = daily ? today : null;
    run.current = { id: crypto.randomUUID(), day: runDay, name: name.trim() || "Tay lái" };
    try { setStoredName(run.current.name); } catch { /* A run does not require persistent storage. */ }
    const currentBoard = !daily || day === today ? board : null;
    const localBest = readHillProgress(playerId.current).bests[hillRecordKey(map, runDay)] ?? 0;
    bestBefore.current = Math.max(localBest, currentBoard?.personal?.distance ?? 0); setBest(bestBefore.current); setNewRecord(false);
    flags.current = [
      ...(bestBefore.current > 0 ? [{ distance: bestBefore.current, name: "Kỷ lục của bạn", kind: "personal" as const }] : []),
      ...(currentBoard?.leaders[0] && currentBoard.leaders[0].playerId !== playerId.current ? [{ distance: currentBoard.leaders[0].distance, name: currentBoard.leaders[0].name, kind: "leader" as const }] : []),
      ...(currentBoard?.nearby ?? []).filter(e => e.playerId !== currentBoard?.leaders[0]?.playerId).slice(0, 3).map(e => ({ distance: e.distance, name: e.name, kind: "nearby" as const })),
    ];
    sim.current = new HillSim(runDay ? hillDailySeed(runDay) : SEED, { map, vehicle });
    fx.current?.reset();
    // From the garage the camera is already on the start line: keep it, so the run opens by zooming out.
    if (phaseRef.current !== "ready") camera.current = { x: 5, y: 1.5, scale: 24 };
    clearInput(); countdownTime.current = 3; setCountdown(3); setNotice("");
    setSnapshot(sim.current.snapshot()); changePhase("countdown");
    const audio = getAudioContext();
    if (audio && !audioNodes.current) {
      const oscillator = audio.createOscillator(); oscillator.type = "sawtooth";
      const filter = audio.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 350;
      const gain = audio.createGain(); gain.gain.value = 0;
      oscillator.connect(filter); filter.connect(gain); gain.connect(audio.destination); oscillator.start();
      audioNodes.current = { oscillator, gain, filter };
    }
    playClockTick();
  }
  function pause() {
    clearInput();
    if (phaseRef.current === "running") changePhase("paused");
    else if (phaseRef.current === "paused") changePhase(countdownTime.current > 0 ? "countdown" : "running");
  }
  function pointer(control: keyof HillInput, id: number, down: boolean) {
    const key = `${control}:${id}`;
    if (down) { pressed.current.add(key); if (control === "jump" || control === "dash") pendingActions.current.add(control); } else pressed.current.delete(key);
    const active = Array.from(pressed.current).some(k => k.startsWith(`${control}:`) || KEYS[k] === control);
    if (control === "gas") setGas(active); else if (control === "brake") setBrake(active);
    if (down) navigator.vibrate?.(8);
  }

  useEffect(() => {
    try { setBotSetup({ ...DEFAULT_BOT_SETUP, ...JSON.parse(localStorage.getItem(BOT_SETUP_KEY) ?? "{}") }); } catch { /* Defaults are fine. */ }
  }, []);
  const changeBotSetup = (patch: Partial<HillBotSetup>) => setBotSetup(old => {
    const next = { ...old, ...patch };
    try { localStorage.setItem(BOT_SETUP_KEY, JSON.stringify(next)); } catch { /* Not remembered, still works. */ }
    return next;
  });

  useEffect(() => {
    try {
      playerId.current = getOrCreatePlayerId(); setName(getStoredName());
      setWallet(hillWalletView(readHillProgress(playerId.current)));
    } catch { /* Storage-disabled browsers can still drive. */ }
    setDay(hillDay());
    void refreshProgress();
  }, [refreshProgress]);

  useEffect(() => {
    if (phase !== "ready") return;
    const today = hillDay(); setDay(today);
    sim.current = new HillSim(daily ? hillDailySeed(today) : SEED, { map, vehicle });
    previewTicks.current = 0;
    fx.current?.reset();
    camera.current = { ...camera.current, x: 5, y: 1.5 }; flags.current = [];
    const progress = readHillProgress(playerId.current);
    setBests(Object.fromEntries((Object.keys(HILL_MAPS) as HillMapId[]).map(id => [id, progress.bests[hillRecordKey(id, daily ? today : null)] ?? 0])));
    const id = playerId.current;
    setBest(readHillProgress(id).bests[hillRecordKey(map, daily ? today : null)] ?? 0);
    let cancelled = false; setBoard(null);
    void loadHillBoard(map, daily ? today : null, id).then(result => { if (!cancelled) { setBoard(result); setBest(old => Math.max(old, result.personal?.distance ?? 0)); } }).catch(() => {});
    return () => { cancelled = true; };
  }, [map, vehicle, daily, phase]);

  useEffect(() => {
    sim.current ??= new HillSim(SEED);
    fx.current ??= new HillFx();
    const effects = fx.current;
    updateMuted(isMuted());
    let raf = 0, last = 0, accumulator = 0, hudTime = 0, warningSecond = -1, noticeUntil = 0;
    const keys = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input, textarea, select")) return;
      if (KEYS[event.code]) {
        event.preventDefault();
        if (event.type === "keydown" && phaseRef.current === "running") {
          pressed.current.add(event.code);
          const action = KEYS[event.code];
          if (!event.repeat && (action === "jump" || action === "dash")) pendingActions.current.add(action);
        }
        else pressed.current.delete(event.code);
        setGas(Array.from(pressed.current).some(k => KEYS[k] === "gas" || k.startsWith("gas:")));
        setBrake(Array.from(pressed.current).some(k => KEYS[k] === "brake" || k.startsWith("brake:")));
      }
      if ((event.code === "Escape" || event.code === "KeyP") && event.type === "keydown" && !event.repeat) {
        pressed.current.clear(); pendingActions.current.clear(); setGas(false); setBrake(false);
        if (phaseRef.current === "running") { phaseRef.current = "paused"; setPhase("paused"); }
        else if (phaseRef.current === "paused") { const next = countdownTime.current > 0 ? "countdown" : "running"; phaseRef.current = next; setPhase(next); }
      }
    };
    const blur = () => {
      pressed.current.clear(); pendingActions.current.clear(); setGas(false); setBrake(false);
      if (phaseRef.current === "running" || phaseRef.current === "countdown") { phaseRef.current = "paused"; setPhase("paused"); }
      if (audioNodes.current) audioNodes.current.gain.gain.value = 0;
      accumulator = 0; last = 0;
    };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener("keydown", keys); window.addEventListener("keyup", keys);
    window.addEventListener("blur", blur); document.addEventListener("visibilitychange", visibility);
    const frame = (now: number) => {
      const elapsed = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      if (phaseRef.current === "bots") { raf = requestAnimationFrame(frame); return; }
      const simulation = sim.current!;
      if (phaseRef.current === "countdown") {
        countdownTime.current -= elapsed;
        const next = Math.max(1, Math.ceil(countdownTime.current));
        setCountdown(old => old === next ? old : next);
        if (Math.ceil(countdownTime.current + elapsed) !== next) playClockTick();
        if (countdownTime.current <= 0) { phaseRef.current = "running"; setPhase("running"); }
      }
      if (phaseRef.current === "running") {
        accumulator += elapsed;
        const input: HillInput = {
          gas: Array.from(pressed.current).some(k => KEYS[k] === "gas" || k.startsWith("gas:")),
          brake: Array.from(pressed.current).some(k => KEYS[k] === "brake" || k.startsWith("brake:")),
          dash: pendingActions.current.has("dash") || Array.from(pressed.current).some(k => KEYS[k] === "dash" || k.startsWith("dash:")),
          jump: pendingActions.current.has("jump") || Array.from(pressed.current).some(k => KEYS[k] === "jump" || k.startsWith("jump:")),
        };
        while (accumulator >= HILL_DT) { simulation.step(input); pendingActions.current.clear(); accumulator -= HILL_DT; }
      } else accumulator = 0;
      if (phaseRef.current === "ready" && previewTicks.current < 150) { simulation.step(IDLE); previewTicks.current++; }
      const state = simulation.snapshot();
      const drained = simulation.drainEvents();
      if (phaseRef.current === "ready" && drained.includes("landing")) playHillLanding();
      for (const event of phaseRef.current === "ready" ? [] : drained) {
        if (event === "coin") playPop();
        if (event === "fuel") { playCorrect(); setNotice("Đầy bình! ⛽"); noticeUntil = now + 1600; }
        if (event === "overturned") { setNotice("Lắc ga / phanh hoặc bật lật để cứu xe!"); noticeUntil = now + 3000; }
        if (event === "recovered") { playCorrect(); setNotice("Thoát hiểm!"); noticeUntil = now + 1600; }
        if (event === "energy") { playPop(); setNotice("+40 ⚡"); noticeUntil = now + 1200; }
        if (event === "jump") playHillJump();
        if (event === "dash") { playHillDash(); setNotice("💨 Lao tới!"); noticeUntil = now + 700; }
        const skills: Record<string, string> = { airtime: "✈️ Bay đẹp!", flip: "🔄 Lộn vòng! +25⚡", backflip: "🤸 Lộn ngược! +25⚡", landing: "🎯 Tiếp đất êm!" };
        if (event === "landing") playHillLanding();
        if (skills[event]) { playCorrect(); setNotice(skills[event]); noticeUntil = now + 1600; }
        if (event === "finished") {
          setSnapshot(state); playWhoosh(); phaseRef.current = "finished"; setPhase("finished"); pressed.current.clear(); pendingActions.current.clear(); setGas(false); setBrake(false);
          setNewRecord(Math.floor(state.distance) > bestBefore.current); setBoard(null);
          const session = run.current;
          if (session && playerId.current) {
            const submission: HillRunSubmission = { runId: session.id, playerId: playerId.current, name: session.name, map: state.map, vehicle: state.vehicle,
              seed: simulation.seed, day: session.day, distance: Math.floor(state.distance), coins: state.coins, duration: state.tick * HILL_DT };
            try { cacheHillRun(submission); setWallet(hillWalletView(readHillProgress(playerId.current))); setSaveStatus("Đã lưu trên máy, đang đồng bộ…"); }
            catch { setSaveStatus("Trình duyệt chưa cho lưu dữ liệu trên máy."); }
            void refreshProgress().then(() => loadHillBoard(state.map, session.day, playerId.current).then(result => { if (run.current?.id === session.id && phaseRef.current === "finished") setBoard(result); }).catch(() => {}));
          }
        }
      }
      if (noticeUntil && now > noticeUntil) { setNotice(""); noticeUntil = 0; }
      if (state.fuel < 20 && state.fuel > 0 && phaseRef.current === "running" && Math.floor(now / 1000) !== warningSecond) { playClockTick(); warningSecond = Math.floor(now / 1000); }
      const nodes = audioNodes.current;
      if (nodes) {
        const audio = nodes.oscillator.context;
        const pitch = state.vehicle === "beetle" ? 1.5 : state.vehicle === "monster" ? 0.65 : state.vehicle === "bus" ? 0.8 : 1;
        nodes.oscillator.frequency.setTargetAtTime((35 + Math.min(120, state.speed * 4) + (pressed.current.size ? 25 : 0)) * pitch, audio.currentTime, 0.08);
        nodes.gain.gain.setTargetAtTime(phaseRef.current === "running" && state.fuel > 0 && !isMuted() ? 0.025 : 0, audio.currentTime, 0.03);
      }
      const el = canvas.current;
      if (el) {
        const rect = el.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
        const width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
        if (el.width !== width || el.height !== height) { el.width = width; el.height = height; }
        const ctx = el.getContext("2d");
        // Effects run while the world moves (garage drop included) and freeze with it.
        const live = phaseRef.current === "running" || phaseRef.current === "countdown" || phaseRef.current === "ready";
        effects.observe([{ id: "me", state }], simulation.seed, state.map, live ? elapsed : 0, "me");
        effects.update(live ? elapsed : 0);
        if (ctx) {
          const shake = effects.offset();
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(shake.x, shake.y);
          drawHill(ctx, rect.width, rect.height, simulation.seed, state, camera.current, elapsed, flags.current, 1, 1, phaseRef.current === "ready" ? garageView(rect.width, rect.height) : { start: SOLO_START });
          effects.draw(ctx, hillProject(camera.current, rect.width, rect.height));
        }
      }
      // The HUD only shows while driving; results keep the final snapshot set above.
      if (phaseRef.current !== "ready" && phaseRef.current !== "finished" && now - hudTime > 80) { setSnapshot(state); hudTime = now; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener("keydown", keys); window.removeEventListener("keyup", keys);
      window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility);
      const nodes = audioNodes.current;
      if (nodes) { nodes.oscillator.stop(); nodes.oscillator.disconnect(); nodes.filter.disconnect(); nodes.gain.disconnect(); audioNodes.current = null; }
    };
  }, [refreshProgress]);

  const playing = phase === "countdown" || phase === "running" || phase === "paused";
  const toGarage = () => { clearInput(); changePhase("ready"); };
  const toggleMute = () => { const next = !isMuted(); setMuted(next); updateMuted(next); };
  return <div ref={stage} className={`${drawFontClass} relative h-[100dvh] min-h-[320px] overflow-hidden bg-emerald-950 text-white select-none`} style={{ touchAction: phase === "ready" || phase === "finished" ? "pan-y" : "none" }}>
    <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label="Đường đua địa hình, A/D lái xe, W để nhảy, Space để lao tới" />
    {playing && <>
    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-5" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
      <div className="w-28 rounded-2xl bg-emerald-950/75 p-3 sm:w-44">
        <div className={`mb-1 text-xs font-bold ${snapshot && snapshot.fuel < 20 ? "animate-pulse text-red-300" : "text-amber-100"}`}>⛽ {Math.ceil(snapshot?.fuel ?? 100)}%</div>
        <div role="meter" aria-label="Xăng" aria-valuenow={Math.round(snapshot?.fuel ?? 100)} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-white/20"><div className={`h-full ${snapshot && snapshot.fuel < 20 ? "bg-red-400" : "bg-amber-300"}`} style={{ width: `${snapshot?.fuel ?? 100}%` }} /></div>
        <div className="mb-1 mt-2 text-xs font-bold text-cyan-200">⚡ {Math.floor(snapshot?.energy ?? 100)}</div>
        <div role="meter" aria-label="Năng lượng" aria-valuenow={Math.floor(snapshot?.energy ?? 100)} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-cyan-300" style={{ width: `${snapshot?.energy ?? 100}%` }} /></div>
        <div className="mt-2 text-xs text-emerald-100">{Math.round((snapshot?.speed ?? 0) * 3.6)} km/h</div>
      </div>
      <div className="rounded-2xl bg-emerald-950/75 px-4 py-2 text-center"><strong className="text-2xl tabular-nums sm:text-4xl">{Math.floor(snapshot?.distance ?? 0)} <span className="text-sm">m</span></strong><div className="text-xs text-emerald-100">{HILL_MAPS[snapshot?.map ?? map].name} · {HILL_VEHICLES[snapshot?.vehicle ?? vehicle].name}</div><RecordProgress distance={snapshot?.distance ?? 0} best={best} /></div>
      <div className="flex flex-wrap justify-end gap-2 max-w-40">
        <span className="rounded-xl bg-emerald-950/75 px-3 py-2 text-amber-200">● {snapshot?.coins ?? 0}</span>
        <button className="rounded-xl bg-emerald-950/75 p-2" aria-label="Tạm dừng hoặc tiếp tục" onClick={pause} disabled={phase !== "running" && phase !== "paused"}>⏸</button>
        <button className="rounded-xl bg-emerald-950/75 p-2" aria-label="Bật hoặc tắt âm thanh" onClick={() => { const next = !isMuted(); setMuted(next); updateMuted(next); }}>{muted ? "🔇" : "🔊"}</button>
        <button className="rounded-xl bg-emerald-950/75 p-2" aria-label="Toàn màn hình" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void stage.current?.requestFullscreen?.().catch(() => {}); }}>⛶</button>
      </div>
    </div>
    {notice && phase === "running" && <div role="status" className="absolute inset-x-0 top-28 text-center font-bold text-emerald-950">{notice}</div>}
    <div className="pointer-events-none absolute bottom-32 inset-x-0 text-center text-xs font-semibold text-emerald-950/80 sm:hidden">Xoay ngang để chơi đã hơn 🔄</div>
    <button disabled={phase !== "running" || !snapshot?.dashReady} aria-label="Lao tới"
      onContextMenu={e => e.preventDefault()} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); pointer("dash", e.pointerId, true); }}
      onPointerUp={e => pointer("dash", e.pointerId, false)} onPointerCancel={e => pointer("dash", e.pointerId, false)} onLostPointerCapture={e => pointer("dash", e.pointerId, false)}
      className="absolute bottom-36 left-6 rounded-full border-2 border-amber-100/50 bg-orange-800/90 px-5 py-3 font-bold shadow-lg disabled:opacity-40 sm:left-12">💨 Lao tới<span className="block text-[10px] font-normal">{snapshot?.dashCooldown ? `${snapshot.dashCooldown.toFixed(1)}s` : "25⚡ · Space"}</span></button>
    <button disabled={phase !== "running" || !snapshot?.jumpReady} aria-label={snapshot?.overturnRemaining !== null && snapshot?.overturnRemaining !== undefined ? "Bật lật" : "Nhảy"}
      onContextMenu={e => e.preventDefault()} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); pointer("jump", e.pointerId, true); }}
      onPointerUp={e => pointer("jump", e.pointerId, false)} onPointerCancel={e => pointer("jump", e.pointerId, false)} onLostPointerCapture={e => pointer("jump", e.pointerId, false)}
      className="absolute bottom-36 right-6 rounded-full border-2 border-cyan-100/50 bg-cyan-800/90 px-5 py-3 font-bold shadow-lg disabled:opacity-40 sm:right-12">{snapshot?.overturnRemaining != null ? "↻ Bật lật" : "↑ Nhảy"}<span className="block text-[10px] font-normal">35⚡ · ↑ / W</span></button>
    <div className="absolute inset-x-0 bottom-0 flex justify-between px-5 pb-5 sm:px-10" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
      {(["brake", "gas"] as const).map(control => <button key={control} disabled={phase !== "running"} aria-label={control === "gas" ? "Ga" : "Phanh / lùi"} aria-pressed={control === "gas" ? gas : brake}
        onContextMenu={e => e.preventDefault()}
        onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); pointer(control, e.pointerId, true); }}
        onPointerUp={e => pointer(control, e.pointerId, false)} onPointerCancel={e => pointer(control, e.pointerId, false)} onLostPointerCapture={e => pointer(control, e.pointerId, false)}
        className={`h-24 w-28 rounded-3xl border-b-8 border-black/30 text-xl font-black shadow-lg transition-transform sm:h-28 sm:w-40 ${(control === "gas" ? gas : brake) ? "translate-y-2 border-b-0" : ""} ${control === "gas" ? "bg-amber-400 text-amber-950" : "bg-stone-100 text-stone-700"} disabled:opacity-50`}>
        {control === "gas" ? "GA →" : "← PHANH"}<span className="mt-1 block text-xs font-medium">{control === "gas" ? "D / →" : "A / ←"}</span>
      </button>)}
    </div>
    </>}
    {phase === "ready" && <HillGarage mode={mode} map={map} vehicle={vehicle} botSetup={botSetup} wallet={wallet} board={board} best={best} bests={bests} name={name} busy={busy} saveStatus={saveStatus} muted={muted}
      onName={setName} onMap={setMap} onVehicle={setVehicle} onMode={setMode} onBotSetup={changeBotSetup} onBuy={buy} onStart={start}
      onStartBots={() => { getAudioContext(); try { setStoredName(name.trim()); } catch { /* optional */ } clearInput(); changePhase("bots"); }}
      onSync={() => void refreshProgress()} onMute={toggleMute} />}
    {phase === "bots" && <HillBotRace setup={botSetup} map={map} vehicle={vehicle} name={name} onExit={toGarage} />}
    {phase === "countdown" && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-live="polite">
      <p className="font-draw-display text-lg font-extrabold uppercase tracking-[0.3em] text-white drop-shadow">Chuẩn bị</p>
      <p key={countdown} className="font-draw-display text-[9rem] font-extrabold leading-none text-amber-300 drop-shadow-[0_6px_0_rgba(120,53,15,0.85)] motion-safe:animate-[hill-pop_0.45s_ease-out]">{countdown}</p>
    </div>}
    {(phase === "paused" || phase === "finished") && <div className="absolute inset-0 flex overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px]" style={{ paddingTop: "max(16px, env(safe-area-inset-top))", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
      <div className="m-auto flex w-full justify-center">
        {phase === "paused"
          ? <HillPause onResume={() => { clearInput(); changePhase(countdownTime.current > 0 ? "countdown" : "running"); }} onRetry={start} onGarage={toGarage} />
          : snapshot && <HillResults snapshot={snapshot} best={best} newRecord={newRecord} board={board} wallet={wallet} saveStatus={saveStatus} onRetry={start} onGarage={toGarage} />}
      </div>
    </div>}
  </div>;
}

/** Solo HUD: a bar filling up towards your record flag, and a cheer once past it. */
function RecordProgress({ distance, best }: { distance: number; best: number }) {
  if (!best) return <div className="mt-1 text-[11px] font-bold text-amber-200">Chạy đi, cắm cờ đầu tiên! 🚩</div>;
  const past = distance > best;
  return <div className="mx-auto mt-1.5 w-36 sm:w-48">
    <div className="relative h-1.5 rounded-full bg-white/15">
      <div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.min(100, (distance / best) * 100)}%` }} />
      <span className="absolute -right-1.5 -top-3 text-xs">🚩</span>
    </div>
    <div className={`mt-1 text-[11px] font-bold ${past ? "animate-pulse text-amber-300" : "text-amber-200"}`}>
      {past ? `Kỷ lục mới! +${formatNumber(distance - best)} m` : `còn ${formatNumber(best - distance)} m tới 🚩 ${formatNumber(best)} m`}
    </div>
  </div>;
}
