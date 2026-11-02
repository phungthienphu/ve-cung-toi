"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HillSim } from "@shared/hillSim";
import { HILL_DT, type HillInput, type HillSnapshot } from "@shared/hillTypes";
import { getOrCreatePlayerId } from "@/lib/player";
import { getAudioContext, isMuted, setMuted, playPop, playCorrect, playWhoosh, playClockTick } from "@/lib/sound";
import { drawHill, type HillCamera } from "./drawHill";

type Phase = "ready" | "countdown" | "running" | "paused" | "finished";
const SEED = 20261102;
const KEYS: Record<string, keyof HillInput> = { ArrowRight: "gas", KeyD: "gas", ArrowLeft: "brake", KeyA: "brake" };

export default function HillGame() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const sim = useRef<HillSim | null>(null);
  const camera = useRef<HillCamera>({ x: 5, y: 1.5, scale: 24 });
  const pressed = useRef(new Set<string>());
  const phaseRef = useRef<Phase>("ready");
  const [phase, setPhase] = useState<Phase>("ready");
  const [snapshot, setSnapshot] = useState<HillSnapshot | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [muted, updateMuted] = useState(false);
  const [gas, setGas] = useState(false);
  const [brake, setBrake] = useState(false);
  const [notice, setNotice] = useState("");
  const countdownTime = useRef(3);
  const audioNodes = useRef<{ oscillator: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null>(null);

  function changePhase(next: Phase) { phaseRef.current = next; setPhase(next); }
  function clearInput() { pressed.current.clear(); setGas(false); setBrake(false); }
  function start() {
    try { getOrCreatePlayerId(); } catch { /* Private browsing still allows a local run. */ }
    sim.current = new HillSim(SEED);
    camera.current = { x: 5, y: 1.5, scale: 24 };
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
    if (down) pressed.current.add(key); else pressed.current.delete(key);
    const active = Array.from(pressed.current).some(k => k.startsWith(`${control}:`) || KEYS[k] === control);
    if (control === "gas") setGas(active); else setBrake(active);
    if (down) navigator.vibrate?.(8);
  }

  useEffect(() => {
    sim.current = new HillSim(SEED);
    updateMuted(isMuted());
    let raf = 0, last = 0, accumulator = 0, hudTime = 0, warningSecond = -1, noticeUntil = 0;
    const keys = (event: KeyboardEvent) => {
      if (KEYS[event.code]) {
        event.preventDefault();
        if (event.type === "keydown" && phaseRef.current === "running") pressed.current.add(event.code);
        else pressed.current.delete(event.code);
        setGas(Array.from(pressed.current).some(k => KEYS[k] === "gas" || k.startsWith("gas:")));
        setBrake(Array.from(pressed.current).some(k => KEYS[k] === "brake" || k.startsWith("brake:")));
      }
      if ((event.code === "Escape" || event.code === "KeyP") && event.type === "keydown" && !event.repeat) {
        pressed.current.clear(); setGas(false); setBrake(false);
        if (phaseRef.current === "running") { phaseRef.current = "paused"; setPhase("paused"); }
        else if (phaseRef.current === "paused") { const next = countdownTime.current > 0 ? "countdown" : "running"; phaseRef.current = next; setPhase(next); }
      }
    };
    const blur = () => {
      pressed.current.clear(); setGas(false); setBrake(false);
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
        };
        while (accumulator >= HILL_DT) { simulation.step(input); accumulator -= HILL_DT; }
      } else accumulator = 0;
      const state = simulation.snapshot();
      for (const event of simulation.drainEvents()) {
        if (event === "coin") playPop();
        if (event === "fuel") { playCorrect(); setNotice("Đầy bình! ⛽"); noticeUntil = now + 1600; }
        if (event === "overturned") { setNotice("Lắc ga / phanh để cứu xe!"); noticeUntil = now + 3000; }
        if (event === "recovered") { playCorrect(); setNotice("Thoát hiểm!"); noticeUntil = now + 1600; }
        if (event === "finished") { playWhoosh(); phaseRef.current = "finished"; setPhase("finished"); pressed.current.clear(); setGas(false); setBrake(false); }
      }
      if (noticeUntil && now > noticeUntil) { setNotice(""); noticeUntil = 0; }
      if (state.fuel < 20 && state.fuel > 0 && phaseRef.current === "running" && Math.floor(now / 1000) !== warningSecond) { playClockTick(); warningSecond = Math.floor(now / 1000); }
      const nodes = audioNodes.current;
      if (nodes) {
        const audio = nodes.oscillator.context;
        nodes.oscillator.frequency.setTargetAtTime(35 + Math.min(120, state.speed * 4) + (pressed.current.size ? 25 : 0), audio.currentTime, 0.08);
        nodes.gain.gain.setTargetAtTime(phaseRef.current === "running" && state.fuel > 0 && !isMuted() ? 0.025 : 0, audio.currentTime, 0.03);
      }
      const el = canvas.current;
      if (el) {
        const rect = el.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
        const width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
        if (el.width !== width || el.height !== height) { el.width = width; el.height = height; }
        const ctx = el.getContext("2d");
        if (ctx) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawHill(ctx, rect.width, rect.height, SEED, state, camera.current, elapsed); }
      }
      if (now - hudTime > 80 || state.finished) { setSnapshot(state); hudTime = now; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener("keydown", keys); window.removeEventListener("keyup", keys);
      window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility);
      const nodes = audioNodes.current;
      if (nodes) { nodes.oscillator.stop(); nodes.oscillator.disconnect(); nodes.filter.disconnect(); nodes.gain.disconnect(); audioNodes.current = null; }
    };
  }, []);

  return <div ref={stage} className="relative h-[100dvh] min-h-[360px] overflow-hidden bg-emerald-950 text-white select-none" style={{ touchAction: "none" }}>
    <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label="Jeep chạy trên đồi chè, điều khiển bằng A/D hoặc mũi tên trái/phải" />
    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-5" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
      <div className="w-28 rounded-2xl bg-emerald-950/75 p-3 sm:w-44">
        <div className={`mb-1 text-xs font-bold ${snapshot && snapshot.fuel < 20 ? "animate-pulse text-red-300" : "text-amber-100"}`}>⛽ {Math.ceil(snapshot?.fuel ?? 100)}%</div>
        <div role="meter" aria-label="Xăng" aria-valuenow={Math.round(snapshot?.fuel ?? 100)} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-white/20"><div className={`h-full ${snapshot && snapshot.fuel < 20 ? "bg-red-400" : "bg-amber-300"}`} style={{ width: `${snapshot?.fuel ?? 100}%` }} /></div>
        <div className="mt-2 text-xs text-emerald-100">{Math.round((snapshot?.speed ?? 0) * 3.6)} km/h</div>
      </div>
      <div className="rounded-2xl bg-emerald-950/75 px-4 py-2 text-center"><strong className="text-2xl tabular-nums sm:text-4xl">{Math.floor(snapshot?.distance ?? 0)} <span className="text-sm">m</span></strong><div className="text-xs text-emerald-100">Đồi chè · Jeep</div></div>
      <div className="flex flex-wrap justify-end gap-2 max-w-40">
        <span className="rounded-xl bg-emerald-950/75 px-3 py-2 text-amber-200">● {snapshot?.coins ?? 0}</span>
        <button className="rounded-xl bg-emerald-950/75 p-2" aria-label="Tạm dừng hoặc tiếp tục" onClick={pause} disabled={phase !== "running" && phase !== "paused"}>⏸</button>
        <button className="rounded-xl bg-emerald-950/75 p-2" aria-label="Bật hoặc tắt âm thanh" onClick={() => { const next = !isMuted(); setMuted(next); updateMuted(next); }}>{muted ? "🔇" : "🔊"}</button>
        <button className="rounded-xl bg-emerald-950/75 p-2" aria-label="Toàn màn hình" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void stage.current?.requestFullscreen?.().catch(() => {}); }}>⛶</button>
      </div>
    </div>
    {notice && phase === "running" && <div role="status" className="absolute inset-x-0 top-28 text-center font-bold text-emerald-950">{notice}</div>}
    <div className="pointer-events-none absolute bottom-32 inset-x-0 text-center text-xs font-semibold text-emerald-950/80 sm:hidden">Xoay ngang để chơi đã hơn 🔄</div>
    <div className="absolute inset-x-0 bottom-0 flex justify-between px-5 pb-5 sm:px-10" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
      {(["brake", "gas"] as const).map(control => <button key={control} disabled={phase !== "running"} aria-label={control === "gas" ? "Ga" : "Phanh / lùi"} aria-pressed={control === "gas" ? gas : brake}
        onContextMenu={e => e.preventDefault()}
        onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); pointer(control, e.pointerId, true); }}
        onPointerUp={e => pointer(control, e.pointerId, false)} onPointerCancel={e => pointer(control, e.pointerId, false)} onLostPointerCapture={e => pointer(control, e.pointerId, false)}
        className={`h-24 w-28 rounded-3xl border-b-8 border-black/30 text-xl font-black shadow-lg transition-transform sm:h-28 sm:w-40 ${(control === "gas" ? gas : brake) ? "translate-y-2 border-b-0" : ""} ${control === "gas" ? "bg-amber-400 text-amber-950" : "bg-stone-100 text-stone-700"} disabled:opacity-50`}>
        {control === "gas" ? "GA →" : "← PHANH"}<span className="mt-1 block text-xs font-medium">{control === "gas" ? "D / →" : "A / ←"}</span>
      </button>)}
    </div>
    {phase !== "running" && <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/30 p-5">
      {phase === "countdown" ? <div className="text-8xl font-black text-amber-200 drop-shadow-lg" aria-live="polite">{countdown}</div> :
      <div className="max-h-full w-full max-w-md overflow-auto rounded-3xl border border-white/30 bg-emerald-950/95 p-6 text-center shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">Lái thử · Giai đoạn 1</p>
        <h1 className="my-3 text-3xl font-black">{phase === "finished" ? snapshot?.finished === "overturned" ? "Chổng vó!" : "Hết xăng!" : phase === "paused" ? "Nghỉ chân một chút" : "Con Đường Hoàng Kim"}</h1>
        {phase === "finished" ? <p className="mb-5 text-lg">{Math.floor(snapshot?.distance ?? 0)} m · {snapshot?.coins ?? 0} xu trong lượt</p> : <p className="mb-5 text-sm leading-relaxed text-emerald-100">Giữ ga để leo đồi, phanh để chúc đầu khi bay. Nóc chạm đất? Bạn có 3 giây lắc ga / phanh để dựng xe. Nhặt can đỏ để đổ đầy xăng.</p>}
        <button className="w-full rounded-2xl bg-amber-400 py-3 font-black text-emerald-950" onClick={phase === "paused" ? () => { clearInput(); changePhase(countdownTime.current > 0 ? "countdown" : "running"); } : start}>{phase === "paused" ? "Tiếp tục" : phase === "finished" ? "Chạy lại" : "Chạy thử →"}</button>
        <p className="mt-3 text-xs text-emerald-200">Một bản đồ · một xe · xu tính trong lượt</p>
        <Link className="mt-4 inline-block text-sm underline text-emerald-100" href="/">Về trang chủ</Link>
      </div>}
    </div>}
  </div>;
}
