'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { drawFontClass } from '@/lib/drawFonts';
import { getOrCreatePlayerId, getStoredName, setStoredName } from '@/lib/player';
import { getAudioContext, isMuted, setMuted } from "@/lib/sound";
import { useHillRoom } from '@/lib/useHillRoom';
import type { HillInput, HillVehicleId } from '@shared/hillTypes';
import type { HillRaceConfig } from '@shared/hillRaceTypes';
import HillRaceCanvas from './HillRaceCanvas';
import { HillLobby, HillRaceResults } from './HillLobby';
import { HillRaceHud } from './HillRaceHud';
import { GameButton } from './HillUi';


export default function HillRoom({ room }: { room: string }) {
  const [identity, setIdentity] = useState({ id: '', name: '' }); const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false); const [muted, updateMuted] = useState(false);
  useEffect(() => updateMuted(isMuted()), []);
  useEffect(() => { setIdentity({ id: getOrCreatePlayerId(), name: getStoredName() }); }, []);
  const { state, frame, connected, error, send } = useHillRoom(room, identity.id, identity.name);
  const input = useRef<HillInput>({ gas: false, brake: false }); const seq = useRef(0);
  const [held, setHeld] = useState<HillInput>({ gas: false, brake: false });
  const press = (key: keyof HillInput, down: boolean) => {
    if (!!input.current[key] === down) return;
    input.current = { ...input.current, [key]: down }; setHeld(input.current); send({ type: 'input', input: input.current, seq: ++seq.current });
  };
  useEffect(() => {
    const clear = () => { if (!Object.values(input.current).some(Boolean)) return; input.current = { gas: false, brake: false }; setHeld(input.current); send({ type: 'input', input: input.current, seq: ++seq.current }); };
    const key = (event: KeyboardEvent, down: boolean) => {
      if (state?.phase !== 'race' || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      const bindings: Record<string, keyof HillInput> = { KeyA: 'brake', ArrowLeft: 'brake', KeyD: 'gas', ArrowRight: 'gas', KeyW: 'jump', ArrowUp: 'jump', Space: 'dash' };
      const action = bindings[event.code];
      if (!action) return; event.preventDefault();
      if (!!input.current[action] === down) return;
      input.current = { ...input.current, [action]: down }; setHeld(input.current); send({ type: 'input', input: input.current, seq: ++seq.current });
    };
    const down = (e: KeyboardEvent) => key(e, true), up = (e: KeyboardEvent) => key(e, false);
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', visibility);
    return () => { clear(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', visibility); };
  }, [send, state?.phase]);
  useEffect(() => { if (!connected) { input.current = { gas: false, brake: false }; setHeld(input.current); } }, [connected]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      // Cancelling the share sheet rejects: nothing else to do then.
      try { await navigator.share({ title: 'Con Đường Hoàng Kim', text: `Vào đua với mình! Phòng ${room}`, url }); } catch { /* cancelled */ }
      return;
    }
    await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  if (!identity.name) return <main className={`${drawFontClass} flex min-h-dvh items-center justify-center bg-emerald-950 p-5 text-white`}>
    <form className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center" onSubmit={e => { e.preventDefault(); if (draft.trim()) { setStoredName(draft.trim()); setIdentity({ ...identity, name: draft.trim() }); } }}>
      <p className="text-5xl">🏁</p>
      <h1 className="mt-2 font-draw-display text-3xl font-extrabold">Vào phòng <span className="font-mono tracking-[0.15em] text-amber-300">{room}</span></h1>
      <p className="mt-1 text-sm text-emerald-100/70">Đặt tên để bạn bè nhận ra bạn trên đường đua.</p>
      <input autoFocus aria-label="Tên của bạn" placeholder="Tên tài xế" maxLength={24} value={draft} onChange={e => setDraft(e.target.value)} className="mt-4 w-full rounded-xl border-2 border-white/15 bg-black/20 px-3 py-3 text-center text-lg font-semibold outline-none focus:border-amber-300" />
      <GameButton disabled={!draft.trim()} className="mt-4 w-full py-3 text-xl">Vào sảnh đua ›</GameButton>
    </form>
  </main>;

  const me = state?.players.find(p => p.id === identity.id), host = state?.host === identity.id;
  const podium = state?.seriesOver ? [...state.players].sort((a, b) => b.points - a.points || state.order.indexOf(a.id) - state.order.indexOf(b.id)).map(p => p.id) : state?.order ?? [];
  const configure = (patch: Partial<HillRaceConfig>) => { if (state) send({ type: 'config', config: { ...state.config, ...patch } }); };
  const toggleMute = () => { setMuted(!muted); updateMuted(!muted); };

  if (state?.phase === 'race' && frame) {
    const finish = state.config.mode === 'race' ? state.config.length : null;
    return <main className={`${drawFontClass} fixed inset-0 overflow-hidden bg-emerald-950 text-white select-none`}>
      <HillRaceCanvas frame={frame} id={identity.id} players={state.players} finishDistance={finish ?? undefined} input={input} seq={seq} />
      <HillRaceHud frame={frame} myId={identity.id} names={id => state.players.find(p => p.id === id)?.name ?? ''} finish={finish}
        label={`Ván ${state.round}/${state.config.rounds}`} connected={connected} held={held} onPress={press} onRespawn={() => send({ type: 'respawn' })}
        leave={<Link className="rounded-lg bg-emerald-950/80 px-2.5 py-2 font-bold" href="/con-duong-hoang-kim/friends">Rời phòng</Link>} muted={muted} onMute={toggleMute} />
    </main>;
  }

  const connectedPlayers = state?.players.filter(p => p.connected) ?? [];
  const readyCount = connectedPlayers.filter(p => p.ready).length;
  const canStart = connectedPlayers.length >= 2 && readyCount === connectedPlayers.length;
  const readyText = host
    ? canStart ? 'Mọi người đã sẵn sàng!' : connectedPlayers.length < 2 ? 'Cần ít nhất 2 người · bấm 📤 Mời bạn' : `Chờ ${connectedPlayers.length - readyCount} người sẵn sàng`
    : `${readyCount}/${connectedPlayers.length} đã sẵn sàng · chờ chủ phòng 👑 bắt đầu`;

  return <main className={`${drawFontClass} min-h-dvh bg-emerald-950 text-emerald-50`}>
    <div className="mx-auto max-w-5xl px-4 pb-36" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
      <div className="flex items-center gap-2">
        <Link href="/con-duong-hoang-kim/friends" className="rounded-full bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20">‹ Phòng khác</Link>
        <span className="ml-auto" />
        <button onClick={toggleMute} aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">{muted ? '🔇' : '🔊'}</button>
      </div>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-draw-display text-sm font-extrabold uppercase tracking-[0.25em] text-amber-300">Con Đường Hoàng Kim</p>
          <h1 className="font-draw-display text-3xl font-extrabold">Phòng <span className="font-mono tracking-[0.15em] text-amber-300">{room}</span></h1>
        </div>
        <GameButton tone="cyan" onClick={share} className="px-4 py-2.5 text-base">{copied ? '✓ Đã chép link' : '📤 Mời bạn'}</GameButton>
      </header>
      {(error || !connected || !me) && <p role="status" className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-amber-200">{error || (!connected ? 'Đang kết nối phòng…' : 'Đang vào phòng…')}</p>}
      <div className="mt-5">
        {state?.phase === 'results'
          ? <HillRaceResults state={state} order={podium} cars={frame?.cars ?? []} />
          : state && <HillLobby state={state} myId={identity.id} onVehicle={(vehicle: HillVehicleId) => send({ type: 'ready', vehicle, ready: false })} onConfig={configure} onInvite={share} />}
      </div>
    </div>
    {state && <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-emerald-950/95 backdrop-blur" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 pt-3">
        {state.phase === 'results'
          ? host
            ? <>
              <p className="min-w-0 flex-1 text-xs text-emerald-100/70">{state.seriesOver ? 'Hết chặng! Về sảnh để đua tiếp.' : `Xong ván ${state.round}/${state.config.rounds}`}</p>
              {!state.seriesOver && <GameButton className="px-5 py-3 text-lg" onClick={() => send({ type: 'next' })}>Ván tiếp ▶</GameButton>}
              <GameButton tone="glass" className="px-4 py-3 text-base" onClick={() => send({ type: 'lobby' })}>Về sảnh</GameButton>
            </>
            : <p className="flex-1 py-3 text-center text-sm text-emerald-100/70">Chờ chủ phòng 👑 bắt đầu ván tiếp…</p>
          : <>
            <p className="min-w-0 flex-1 text-xs leading-snug text-emerald-100/70">{readyText}</p>
            <GameButton tone={me?.ready ? 'glass' : 'gold'} disabled={!me || !connected} className="px-5 py-3 text-lg" onClick={() => { getAudioContext(); send({ type: 'ready', vehicle: me?.vehicle ?? 'jeep', ready: !me?.ready }); }}>{me?.ready ? 'Huỷ sẵn sàng' : '✓ Sẵn sàng'}</GameButton>
            {host && <GameButton tone="cyan" disabled={!canStart} className="px-5 py-3 text-lg" onClick={() => send({ type: 'start' })}>🏁 Bắt đầu</GameButton>}
          </>}
      </div>
    </div>}
  </main>;
}
