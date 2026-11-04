import { createHash } from 'node:crypto';
import { AuthRateLimit } from '@/server/models/AccountSecurity';
export function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
/** Fixed window, atomic across instances; TTL is cleanup, never the expiry check. */
export async function takeLimit(scope: string, subject: string, maximum: number, windowMs: number) {
  const window = Math.floor(Date.now() / windowMs);
  const key = digest(`${scope}:${subject}:${window}`);
  let row;
  try { row = await AuthRateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 1) * windowMs) } }, { upsert: true, new: true }); }
  catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    row = await AuthRateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
  }
  return !!row && row.count <= maximum;
}
/** Only Vercel's overwritten header is trusted. Custom proxies must set AUTH_TRUST_PROXY=true. */
export function requestIp(headers: Headers) {
  if (process.env.VERCEL) return headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (process.env.AUTH_TRUST_PROXY === 'true') return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return 'local';
}
