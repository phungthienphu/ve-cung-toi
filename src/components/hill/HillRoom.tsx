'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getOrCreatePlayerId, getStoredName, setStoredName } from '@/lib/player';
import { getAudioContext, isMuted, setMuted } from "@/lib/sound";
import { useHillRoom } from '@/lib/useHillRoom';
import { HILL_MAPS, HILL_VEHICLES, type HillInput, type HillVehicleId } from '@shared/hillTypes';
import type { HillRaceConfig } from '@shared/hillRaceTypes';
import HillRaceCanvas from './HillRaceCanvas';
const button = 'rounded-xl bg-amber-300 px-5 py-3 font-bold text-emerald-950 disabled:opacity-40';
export default function HillRoom({ room }: { room: string }) {
  const [identity, setIdentity] = useState({ id: '', name: '' }); const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false); const [muted, updateMuted] = useState(false);
  useEffect(() => updateMuted(isMuted()), []);
  useEffect(() => { setIdentity({ id: getOrCreatePlayerId(), name: getStoredName() }); }, []);
  const { state, frame, connected, error, send } = useHillRoom(room, identity.id, identity.name);
  const input = useRef<HillInput>({ gas: false, brake: false }); const seq = useRef(0);
  const neutral = () => { if (!Object.values(input.current).some(Boolean)) return; input.current = { gas: false, brake: false, jump: false, dash: false }; send({ type: 'input', input: input.current, seq: ++seq.current }); };
  const press = (key: keyof HillInput, held: boolean) => {
    if (!!input.current[key] === held) return;
    input.current = { ...input.current, [key]: held }; send({ type: 'input', input: input.current, seq: ++seq.current });
  };
  useEffect(() => {
    const clear = () => { if (!Object.values(input.current).some(Boolean)) return; input.current = { gas: false, brake: false }; send({ type: 'input', input: input.current, seq: ++seq.current }); };
    const key = (event: KeyboardEvent, held: boolean) => {
      if (state?.phase !== 'race' || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      const bindings: Record<string, keyof HillInput> = { KeyA: 'brake', ArrowLeft: 'brake', KeyD: 'gas', ArrowRight: 'gas', KeyW: 'jump', ArrowUp: 'jump', Space: 'dash' };
      const action = bindings[event.code];
      if (!action) return; event.preventDefault();
      if (!!input.current[action] === held) return;
      input.current = { ...input.current, [action]: held }; send({ type: 'input', input: input.current, seq: ++seq.current });
    };
    const down = (e: KeyboardEvent) => key(e, true), up = (e: KeyboardEvent) => key(e, false);
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', visibility);
    return () => { clear(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', visibility); };
  }, [send, state?.phase]);
  useEffect(() => { if (!connected) input.current = { gas: false, brake: false }; }, [connected]);
  if (!identity.name) return <main className="flex min-h-dvh items-center justify-center bg-emerald-950 p-6 text-white"><form className="w-full max-w-sm space-y-4" onSubmit={e => { e.preventDefault(); if (draft.trim()) { setStoredName(draft.trim()); setIdentity({ ...identity, name: draft.trim() }); } }}><h1 className="text-2xl font-bold">Vào phòng {room}</h1><input autoFocus aria-label="Tên của bạn" placeholder="Tên của bạn" maxLength={24} value={draft} onChange={e => setDraft(e.target.value)} className="w-full rounded-xl bg-white/10 p-3" /><button className={button}>Vào sảnh đua</button></form></main>;
  const me = state?.players.find(p => p.id === identity.id), host = state?.host === identity.id;
  const podium = state?.seriesOver ? [...state.players].sort((a, b) => b.points - a.points || state.order.indexOf(a.id) - state.order.indexOf(b.id)).map(p => p.id) : state?.order ?? [];
  const car = frame?.cars.find(c => c.id === identity.id);
  const configure = (patch: Partial<HillRaceConfig>) => { if (state) send({ type: 'config', config: { ...state.config, ...patch } }); };
  const selectClass = 'mt-1 w-full rounded-xl border border-white/20 bg-emerald-900 p-3 text-white disabled:opacity-60';
  if (state?.phase === 'race' && frame) return <main className="fixed inset-0 overflow-hidden bg-emerald-950 text-white">
    <HillRaceCanvas frame={frame} id={identity.id} players={state.players} finishDistance={state.config.mode === "race" ? state.config.length : undefined} input={input} seq={seq} />
    <div className="absolute left-3 right-3 top-3 flex flex-wrap justify-between gap-2 text-sm font-bold"><span className="rounded-xl bg-emerald-950/85 px-3 py-2">Ván {state.round}/{state.config.rounds} · {Math.floor(car?.state.distance ?? 0)} / {state.config.mode === 'race' ? `${state.config.length}m` : '∞'}</span><span className="rounded-xl bg-emerald-950/85 px-3 py-2">⛽ {Math.ceil(car?.state.fuel ?? 0)} · ⚡ {Math.floor(car?.state.energy ?? 0)} {frame.remaining !== null ? `· Còn ${Math.ceil(frame.remaining)}s` : ''}</span></div>
    {!connected && <p role="status" className="absolute left-1/2 top-20 -translate-x-1/2 rounded-xl bg-red-900 p-3">Mất kết nối, đang nối lại…</p>}
    {car?.squash && <p role="status" className="absolute left-1/2 top-24 -translate-x-1/2 rounded-xl bg-red-950/85 px-4 py-2 text-center text-sm">💥 Bị bẹp! W để nhảy, Space để húc lại nếu đủ ⚡</p>}
    {car?.respawning && <p className="absolute left-1/2 top-1/3 -translate-x-1/2 rounded-xl bg-emerald-950/85 p-4">↺ Đang hồi sinh tại checkpoint…</p>}
    {car?.done && <p className="absolute left-1/2 top-1/3 -translate-x-1/2 rounded-xl bg-emerald-950/85 p-4">Đã hoàn thành lượt · Đang chờ các xe khác</p>}
    <div className="absolute right-3 top-16 flex gap-2 text-xs"><button className="rounded-lg bg-emerald-950/80 p-2" onClick={() => { setMuted(!muted); updateMuted(!muted); }}>{muted ? "🔇" : "🔊"}</button><Link className="rounded-lg bg-emerald-950/80 p-2" href="/con-duong-hoang-kim/friends">Rời phòng</Link></div>
    {car?.stuck && <button className={`${button} absolute bottom-28 left-1/2 -translate-x-1/2`} onClick={() => send({ type: 'respawn' })}>↺ Hồi sinh</button>}
    <div className="absolute bottom-4 left-3 right-3 flex items-end justify-between gap-2 select-none">
      <div className="flex gap-2">{(['brake', 'gas'] as const).map((key, i) => <button key={key} disabled={!connected || car?.done} aria-label={i ? 'Ga' : 'Phanh'} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); press(key, true); }} onPointerUp={() => press(key, false)} onPointerCancel={neutral} className="h-20 w-20 touch-none rounded-2xl border-2 border-white/40 bg-emerald-950/80 text-lg font-bold">{i ? 'GA →' : '← PHANH'}</button>)}</div>
      <div className="flex gap-2">{(['jump', 'dash'] as const).map((key, i) => <button key={key} disabled={!connected || car?.done} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); press(key, true); }} onPointerUp={() => press(key, false)} onPointerCancel={neutral} className="h-20 w-20 touch-none rounded-2xl border-2 border-amber-200/60 bg-amber-300/90 text-sm font-bold text-emerald-950">{i ? 'LAO TỚI' : 'NHẢY'}<small className="block">{i ? car?.state.dashCooldown ? `${car.state.dashCooldown.toFixed(1)}s · 25ϟ` : 'Space · 25ϟ' : 'W · 35ϟ'}</small></button>)}</div>
    </div>
  </main>;
  return <main className="min-h-dvh bg-emerald-950 px-4 py-8 text-emerald-50"><div className="mx-auto max-w-3xl">
    <Link href="/con-duong-hoang-kim/friends" className="text-sm text-emerald-200">← Danh sách phòng</Link>
    <header className="my-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-amber-200">CON ĐƯỜNG HOÀNG KIM</p><h1 className="text-3xl font-black">Phòng {room}</h1></div><button onClick={async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); }} className="rounded-xl border border-white/20 px-4 py-3">{copied ? 'Đã sao chép!' : 'Sao chép lời mời'}</button></header>
    <p role="status" className="mb-4 text-sm text-amber-200">{error || (!connected ? 'Đang kết nối phòng…' : !me ? 'Đang vào phòng…' : '')}</p>
    {state?.phase === 'results' ? <section className="rounded-3xl bg-white/5 p-6"><h2 className="mb-5 text-2xl font-bold">{state.seriesOver ? '🏆 Tổng kết chặng đua' : `🏁 Kết quả ván ${state.round}`}</h2><div className="mb-4 flex flex-wrap justify-center gap-3">{podium.slice(0, 3).map((id, i) => <div key={id} className="rounded-2xl bg-amber-300/10 p-5 text-center"><p className="text-3xl">{['🥇', '🥈', '🥉'][i]}</p><p className="mt-2 font-bold">{HILL_VEHICLES[frame?.cars.find(c => c.id === id)?.state.vehicle ?? state.players.find(p => p.id === id)?.vehicle ?? 'jeep'].icon} {state.players.find(p => p.id === id)?.name}</p></div>)}</div>
    <div className="overflow-x-auto"><table className="w-full min-w-[560px] whitespace-nowrap text-left text-sm"><thead><tr><th className="p-2">Tài xế</th><th>Điểm</th><th>Đường / Thời gian</th><th>Giẫm / Bị giẫm</th><th>Lật / Bay</th></tr></thead><tbody>{[...state.players].sort((a, b) => b.points - a.points).map(p => { const c = frame?.cars.find(c => c.id === p.id); return <tr key={p.id} className="border-t border-white/10"><td className="p-2">{p.name}</td><td>{p.points}</td><td>{Math.floor(c?.state.distance ?? 0)}m / {c?.finishTick ? `${(c.finishTick / 60).toFixed(1)}s` : '—'}</td><td>{c?.stomps} / {c?.squashed}</td><td>{c?.crashes} / {c?.air.toFixed(1)}s</td></tr>; })}</tbody></table></div><p className="mt-2 text-xs text-emerald-200 md:hidden">Vuốt ngang bảng để xem đủ thống kê.</p>
    {host && <div className="mt-6 flex gap-3">{!state.seriesOver && <button className={button} onClick={() => send({ type: 'next' })}>Ván tiếp</button>}<button className={button} onClick={() => send({ type: 'lobby' })}>Về sảnh</button></div>}</section> : state && <>
    <div className="grid gap-6 md:grid-cols-2"><section className="rounded-3xl bg-white/5 p-5"><h2 className="mb-4 text-lg font-bold">Tài xế · {state.players.filter(p => p.connected).length}/6</h2><ul className="space-y-3">{state.players.map(p => <li key={p.id} className="flex justify-between rounded-xl bg-white/5 p-3"><span>{HILL_VEHICLES[p.vehicle].icon} {p.name} {p.id === state.host ? '👑' : ''}</span><span className="text-sm text-amber-200">{!p.connected ? 'Rời mạng' : p.ready ? '✓ Sẵn sàng' : 'Chọn xe'}</span></li>)}</ul><label className="mt-5 block text-sm">Xe của bạn<select aria-label="Xe của bạn" className={selectClass} value={me?.vehicle ?? 'jeep'} onChange={e => send({ type: 'ready', vehicle: e.target.value as HillVehicleId, ready: false })}>{Object.entries(HILL_VEHICLES).map(([key, value]) => <option key={key} value={key}>{value.icon} {value.name}</option>)}</select></label><p className="mt-2 text-xs text-emerald-200">Đua cùng bạn được chọn đủ 4 xe.</p></section>
    <section className="grid gap-3 rounded-3xl bg-white/5 p-5"><h2 className="text-lg font-bold">Cấu hình đường đua</h2><label className="text-sm">Bản đồ<select aria-label="Bản đồ" disabled={!host} className={selectClass} value={state.config.map} onChange={e => configure({ map: e.target.value as HillRaceConfig['map'] })}><option value="random">🎲 Ngẫu nhiên</option>{Object.entries(HILL_MAPS).map(([key, v]) => <option key={key} value={key}>{v.icon} {v.name}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm">Thể thức<select aria-label="Thể thức" disabled={!host} className={selectClass} value={state.config.mode} onChange={e => configure({ mode: e.target.value as 'race' | 'distance' })}><option value="race">Đua về đích</option><option value="distance">Ai đi xa nhất</option></select></label><label className="text-sm">Độ dài<select aria-label="Độ dài" disabled={!host} className={selectClass} value={state.config.length} onChange={e => configure({ length: +e.target.value as 600 })}>{[600, 1200, 2000].map(n => <option key={n} value={n}>{n}m</option>)}</select></label></div>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm">Số ván<select aria-label="Số ván" disabled={!host} className={selectClass} value={state.config.rounds} onChange={e => configure({ rounds: +e.target.value as 1 })}>{[1, 3, 5].map(n => <option key={n} value={n}>{n} ván</option>)}</select></label><label className="text-sm">Xe<select aria-label="Loại xe chung" disabled={!host} className={selectClass} value={state.config.vehicle} onChange={e => configure({ vehicle: e.target.value as HillRaceConfig['vehicle'] })}><option value="choice">Tự chọn</option>{Object.entries(HILL_VEHICLES).map(([key, v]) => <option key={key} value={key}>{v.name}</option>)}</select></label></div>
    <label className="flex gap-2 text-sm"><input type="checkbox" disabled={!host} checked={state.config.collisions} onChange={e => configure({ collisions: e.target.checked })} /> Va chạm thật giữa các xe</label></section></div>
    <p className="my-5 text-sm leading-relaxed text-emerald-200">Xuất phát chồng tháp · 35ϟ mỗi xe · Dốc nhảy, khe trũng và bậc đá sau 40m. A/D lái, W nhảy/cứu lật, Space lao tới húc xe. Hồi sinh mỗi 150m.</p>
    <div className="flex flex-wrap gap-3"><button disabled={!me || !connected} className={button} onClick={() => { getAudioContext(); send({ type: 'ready', vehicle: me?.vehicle ?? 'jeep', ready: !me?.ready }); }}>{me?.ready ? 'Hủy sẵn sàng' : 'Sẵn sàng'}</button>{host && <button className={button} disabled={state.players.filter(p => p.connected).length < 2 || !state.players.filter(p => p.connected).every(p => p.ready)} onClick={() => send({ type: 'start' })}>Bắt đầu đua</button>}</div>
    </>}
  </div></main>;
}
