'use client';
import { useEffect, useSyncExternalStore, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { entryFor, refresh, empty } from './community-store';
export { invalidateCommunity, resetCommunityCache, patchCommunityResource } from './community-store';
export type { CommunityChange } from './community-store';
export function useCommunityResource<T>(path: string | null) {
  const { data: session } = useSession();
  const account = session?.user?.playerId ?? '';
  const entry = path && account ? entryFor(account, path) : null;
  const subscribe = useCallback((listener: () => void) => {
    if (!entry) return () => {};
    entry.listeners.add(listener); return () => { entry.listeners.delete(listener); };
  }, [entry]);
  const snapshot = useSyncExternalStore(subscribe, () => entry?.snapshot ?? empty, () => empty);
  useEffect(() => {
    if (entry && (!entry.loadedAt || Date.now() - entry.loadedAt > 15000)) void refresh(entry);
  }, [entry]);
  const reload = useCallback(async () => { if (entry) { entry.generation++; entry.loadedAt = 0; await refresh(entry); } }, [entry]);
  return { data: snapshot.data as T | undefined, loading: snapshot.loading, error: snapshot.error, reload };
}
