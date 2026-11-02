'use client';
import { unpackHillFrame } from "@shared/hillRaceWire";
import { useCallback, useEffect, useRef, useState } from 'react';
import { playHillDash, playHillJump, playHillLanding, playCorrect } from "./sound";
import PartySocket from 'partysocket';
import type { HillRaceFrame, HillRaceMessage, HillRaceState } from '@shared/hillRaceTypes';
export function useHillRoom(room: string, id: string, name: string) {
  const socket = useRef<PartySocket | null>(null);
  const [state, setState] = useState<HillRaceState | null>(null);
  const [frame, setFrame] = useState<HillRaceFrame | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id || !name) return;
    let previous: HillRaceFrame | null = null;
    const update = (next: HillRaceFrame | null) => {
      const a = previous?.cars.find(c => c.id === id), b = next?.cars.find(c => c.id === id);
      if (a && b && previous?.seed === next?.seed && (next?.tick ?? -1) >= 0) {
        if (b.state.dashCooldown > a.state.dashCooldown + .5) playHillDash();
        if (b.state.jumpCooldown > a.state.jumpCooldown + .2) playHillJump();
        if (b.squashed > a.squashed || b.crashes > a.crashes) playHillLanding();
        if (b.done && !a.done) playCorrect();
      }
      previous = next; setFrame(next);
    };
    const ws = new PartySocket({ host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || '127.0.0.1:1999', party: 'hill', room, id }); socket.current = ws;
    ws.addEventListener('open', () => { setConnected(true); setError(''); ws.send(JSON.stringify({ type: 'join', name })); });
    ws.addEventListener('close', () => setConnected(false));
    ws.addEventListener('message', event => {
      const m = JSON.parse(event.data);
      if (m.type === 'state') { const f = m.state.frame ? unpackHillFrame(m.state.frame) : null; setState({ ...m.state, frame: f }); update(f); }
      if (m.type === 'frame') update(unpackHillFrame(m.frame));
      if (m.type === 'error') setError(m.message);
    });
    return () => { ws.close(); socket.current = null; };
  }, [room, id, name]);
  const send = useCallback((message: HillRaceMessage) => { if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message)); }, []);
  return { state, frame, connected, error, send };
}
