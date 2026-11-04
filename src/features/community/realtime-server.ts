import { signEnvelope, type RealtimePublish } from '@shared/community/auth';
const secret = () => process.env.COMMUNITY_REALTIME_SECRET || process.env.GAME_HISTORY_SECRET || '';
export function realtimeSecret() { const value = secret(); if (!value) throw new Error('Realtime chưa được cấu hình.'); return value; }
export async function publishCommunity(targets: string[], scope: RealtimePublish['scope'] = 'community', admins = false, change?: RealtimePublish['change']) {
  const host = process.env.NEXT_PUBLIC_COMMUNITY_HOST || process.env.NEXT_PUBLIC_PARTYKIT_HOST || '127.0.0.1:1999';
  const protocol = /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https';
  try {
    const token = await signEnvelope(realtimeSecret(), 'community-publish', { targets: [...new Set(targets)], scope, admins, change, expires: Date.now() + 30000 });
    const result = await fetch(`${protocol}://${host}/parties/community/main`, { method: 'POST', headers: { 'x-community-event': token }, signal: AbortSignal.timeout(4000) });
    if (!result.ok) throw new Error('publish');
    return true;
  } catch { return false; }
}
