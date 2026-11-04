
type Snapshot = { data?: unknown; error?: string; loading: boolean };
type Entry = { snapshot: Snapshot; listeners: Set<() => void>; promise?: Promise<void>; generation: number; loadedAt: number; account: string; path: string };
const entries = new Map<string, Entry>();
export const empty: Snapshot = { loading: false };
let currentAccount = '';
function emit(entry: Entry) { entry.listeners.forEach(listener => listener()); }
export function resetCommunityCache(account: string) {
  if (currentAccount === account) return;
  currentAccount = account;
  for (const [key, entry] of entries) { if (entry.account === account) continue; entry.generation++; entry.snapshot = empty; emit(entry); entry.listeners.clear(); entries.delete(key); }
}
export function entryFor(account: string, path: string): Entry {
  const key = `${account}:${path}`;
  let entry = entries.get(key);
  if (!entry && entries.size >= 100) { for (const [key, cached] of entries) { if (!cached.listeners.size && !cached.promise) { entries.delete(key); break; } } }
  if (!entry) { entry = { account, path, snapshot: empty, listeners: new Set(), generation: 0, loadedAt: 0 }; entries.set(key, entry); }
  return entry;
}
export async function refresh(entry: Entry) {
  if (entry.promise) return entry.promise;
  const generation = entry.generation;
  entry.snapshot = { ...entry.snapshot, loading: true }; emit(entry);
  entry.promise = (async () => {
    try {
      const response = await fetch(entry.path, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        if (generation === entry.generation && [401,403].includes(response.status)) entry.snapshot = empty;
        throw new Error(data.error || 'Chưa tải được dữ liệu.');
      }
      if (generation !== entry.generation) return;
      // Keep already loaded messages when a newest-page refresh arrives, so
      // pagination cannot develop a gap while new messages shift the first page.
      if (entry.path.startsWith('/api/community/messages?') && entry.snapshot.data && Array.isArray(data.messages)) {
        const previous = entry.snapshot.data as {messages?: {_id:string;createdAt:string}[]};
        const merged = new Map((previous.messages ?? []).map(message => [message._id, message]));
        for (const message of data.messages) merged.set(message._id, message);
        data.messages = [...merged.values()].sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a._id.localeCompare(b._id));
      }
      entry.loadedAt = Date.now(); entry.snapshot = { data, loading: false };
    } catch (error) { if (generation === entry.generation) entry.snapshot = { ...entry.snapshot, loading: false, error: (error as Error).message }; }
    finally {
      entry.promise = undefined;
      if (generation !== entry.generation && entry.listeners.size) void refresh(entry);
      else emit(entry);
    }
  })();
  return entry.promise;
}
export type CommunityChange = { kind: 'message' | 'read' | 'friends' | 'invite'; actor: string; peer: string };
export function invalidateCommunity(change?: CommunityChange) {
  for (const entry of entries.values()) {
    if (entry.account !== currentAccount) continue;
    const url = new URL(entry.path, 'http://local');
    const other = change?.actor === entry.account ? change.peer : change?.actor;
    const relevant = !change || (change.kind === 'friends' && !url.pathname.endsWith('/messages')) ||
      (change.kind === 'friends' && url.pathname.endsWith('/messages') && url.searchParams.get('peer') === other) ||
      url.pathname.endsWith('/notifications') ||
      (url.pathname.endsWith('/conversations') && ['message', 'read'].includes(change.kind)) ||
      (url.pathname.endsWith('/messages') && change.kind === 'message' && url.searchParams.get('peer') === other);
    if (!relevant) continue;
    entry.generation++; entry.loadedAt = 0;
    // Permission changes must also remove already cached private messages.
    if (change?.kind === 'friends' && url.pathname.endsWith('/messages')) entry.snapshot = empty;
    if (entry.listeners.size) void refresh(entry);
  }
}
export function patchCommunityResource<T>(account: string, path: string, update: (previous: T | undefined) => T | undefined) {
  const entry = entryFor(account, path);
  entry.generation++;
  entry.snapshot = { data: update(entry.snapshot.data as T | undefined), loading: false };
  emit(entry);
}
