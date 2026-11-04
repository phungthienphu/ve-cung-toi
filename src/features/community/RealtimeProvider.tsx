'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import PartySocket from 'partysocket';
import { invalidateCommunity, resetCommunityCache } from './resource-cache';
type State = { revision: number; supportRevision: number; online: string[]; connected: boolean };
const Context = createContext<State>({ revision: 0, supportRevision: 0, online: [], connected: false });
export const useCommunityRealtime = () => useContext(Context);
/** One socket per signed-in tab, shared by chat, invites and the admin support inbox. */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession(); const playerId = session?.user?.playerId;
  const [state, setState] = useState<State>({ revision: 0, supportRevision: 0, online: [], connected: false });
  useEffect(() => {
    resetCommunityCache(playerId ?? '');
    if (!playerId) return;
    setState({ revision: 0, supportRevision: 0, online: [], connected: false });
    let stopped = false;
    const socket = new PartySocket({
      host: process.env.NEXT_PUBLIC_COMMUNITY_HOST || process.env.NEXT_PUBLIC_PARTYKIT_HOST || '127.0.0.1:1999', party: 'community', room: 'main', query: async () => {
        const response = await fetch('/api/community/realtime', { method: 'POST' });
        if (!response.ok) throw new Error('Realtime authentication unavailable');
        return { ticket: (await response.json()).ticket };
      }, minReconnectionDelay: 1000, maxReconnectionDelay: 15000
    });
    socket.addEventListener('message', event => {
      if (stopped || typeof event.data !== 'string') return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'revoked') { resetCommunityCache(''); socket.close(); setState(s => ({ ...s, connected: false, online: [] })); return; }
        if (data.type === 'reauthenticate') { socket.reconnect(); return; }
        if (data.type === 'presence' && Array.isArray(data.online)) setState(s => ({ ...s, online: data.online }));
        if (data.type === 'ready') { invalidateCommunity(); setState(s => ({ ...s, connected: true, revision: s.revision + 1, supportRevision: s.supportRevision + 1 })); }
        if (data.type === 'changed') { if (data.scope !== 'support') invalidateCommunity(data.change); setState(s => ({ ...s, ...(data.scope === 'support' ? { supportRevision: s.supportRevision + 1 } : { revision: s.revision + 1 }) })); }
      } catch {/* Ignore invalid envelopes. */ }
    });
    socket.addEventListener('close', event => {
      if (!stopped) setState(s => ({ ...s, connected: false, online: [] }));
      if (event.code === 4003) socket.close();
    });
    const focus = () => { if (document.hidden) return; invalidateCommunity(); if (socket.readyState === WebSocket.CLOSED) socket.reconnect(); };
    window.addEventListener('online', focus); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    return () => { stopped = true; window.removeEventListener('online', focus); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); socket.close(); };
  }, [playerId]);
  return <Context.Provider value={playerId ? state : { revision: 0, supportRevision: 0, online: [], connected: false }}>{children}</Context.Provider>;
}
