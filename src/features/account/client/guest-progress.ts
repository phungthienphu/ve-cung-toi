import { HillRequestError, syncHillProgress, transferHillCache } from '@/features/hill/client/progress';
import { getOrCreateGuestId, renewGuestId } from '@/lib/player';

export const IDLE_GUEST_KEY = 'vct_idle_guest_after_merge';
const transferring = new Map<string, Promise<void>>();

export async function flushGuestProgress(guestId: string) {
  try { await syncHillProgress(guestId); }
  catch (error) {
    // The previous merge may have committed before the browser lost its
    // response. Let Google login/merge check ownership instead of trapping
    // the browser behind a permanently retired guest wallet.
    if (!(error instanceof HillRequestError && error.status === 409)) throw error;
  }
}

/** Deduplicate initialization in Strict Mode and repeated merge clicks. */
export function transferGuestProgress(guestId: string, accountId: string): Promise<void> {
  const key = `${accountId}:${guestId}`;
  const existing = transferring.get(key);
  if (existing) return existing;
  const task = performTransfer(guestId, accountId).finally(() => transferring.delete(key));
  transferring.set(key, task);
  return task;
}
async function performTransfer(guestId: string, accountId: string) {
  await flushGuestProgress(guestId);
  const response = await fetch('/api/account/merge', {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ guestId }), signal:AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Chưa gộp được tiến độ khách.');
  transferHillCache(guestId, accountId);
  await syncHillProgress(accountId);
  // Retain the source ID until both cache writes and server sync succeed.
  // If interrupted, retry uses the original source and server run-ID guards.
  if (getOrCreateGuestId() === guestId) localStorage.setItem(IDLE_GUEST_KEY, renewGuestId());
}
