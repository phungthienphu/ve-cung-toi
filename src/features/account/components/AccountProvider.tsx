'use client';

import './account.css';
import { createContext, useContext, useEffect, useState } from 'react';
import { SessionProvider, useSession, signIn, signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import { getOrCreateGuestId, setAccountPlayerId } from '@/lib/player';
import { flushGuestProgress, IDLE_GUEST_KEY, transferGuestProgress } from '../client/guest-progress';

interface AccountContextValue { enabled: boolean; login: () => Promise<void>; logout: () => Promise<void>; busy: boolean; error: string }
const AccountContext = createContext<AccountContextValue>({ enabled:false, login:async () => {}, logout:async () => {}, busy:false, error:'' });
export const useAccount = () => useContext(AccountContext);

export function AccountProvider({ children, session, enabled }: { children: React.ReactNode; session: Session | null; enabled: boolean }) {
  return <SessionProvider session={session} refetchOnWindowFocus={enabled}><IdentityBoundary enabled={enabled}>{children}</IdentityBoundary></SessionProvider>;
}
function IdentityBoundary({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const { data: session, status } = useSession();
  const playerId = session?.user?.playerId ?? null;
  const [readyFor, setReadyFor] = useState<string | null | undefined>(() => {
    // Guest HTML stays server-rendered. Set the client identity before child
    // mount effects run; never mutate a shared module identity on the server.
    if (typeof window !== 'undefined') setAccountPlayerId(playerId, session?.user?.name ?? "");
    return playerId ? undefined : null;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (status === 'loading') return;
    let cancelled = false;
    const initialize = async () => {
      setAccountPlayerId(playerId, session?.user?.name ?? "");
      if (!playerId) { try { localStorage.removeItem(IDLE_GUEST_KEY); } catch { /* Storage is optional for guests. */ } }
      if (playerId) {
        try {
          const guestId = getOrCreateGuestId();
          if (localStorage.getItem(IDLE_GUEST_KEY) === guestId) {
            if (!cancelled) { setError(''); setReadyFor(playerId); }
            return;
          }
          await transferGuestProgress(guestId, playerId);
          if (!cancelled) setError('');
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Chưa gộp được tiến độ khách.');
        }
      }
      if (!cancelled) setReadyFor(playerId);
    };
    void initialize();
    return () => { cancelled = true; };
  }, [playerId, session?.user?.name, status, retry]);

  async function login() {
    setBusy(true); setError('');
    try {
      // Do not navigate away until pending runs have reached the server.
      await flushGuestProgress(getOrCreateGuestId());
      await signIn('google', { redirectTo: window.location.pathname + window.location.search });
    } catch { setError('Chưa đồng bộ được tiến độ khách. Thử đăng nhập lại khi có mạng nhé.'); setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try { await signOut({ redirectTo:'/' }); }
    catch { setError('Chưa đăng xuất được. Hãy thử lại.'); setBusy(false); }
  }
  const ready = status !== 'loading' && readyFor === playerId;
  return <AccountContext.Provider value={{ enabled, login, logout, busy, error }}>
    {session?.user && error && <div className="account-sync-notice" role="alert"><span>{error}</span><button onClick={() => setRetry(n => n+1)}>Thử lại</button></div>}
    {ready ? <div key={playerId ?? 'guest'} className="contents">{children}</div> : <div className="flex min-h-app items-center justify-center bg-amber-50 text-sm text-amber-950" role="status">Đang tải tiến độ…</div>}
  </AccountContext.Provider>;
}
