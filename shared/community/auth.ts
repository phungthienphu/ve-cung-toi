/** Domain-separated, short-lived HMAC envelopes shared by Next and Workers. */
export async function signEnvelope(secret: string, purpose: string, value: unknown) {
  const payload = btoa(Array.from(new TextEncoder().encode(JSON.stringify(value)), b => String.fromCharCode(b)).join('')).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${purpose}:${payload}`)));
  return `${payload}.${Array.from(signature, b => b.toString(16).padStart(2,'0')).join('')}`;
}
export async function verifyEnvelope<T extends { expires: number }>(secret: string, purpose: string, token: string): Promise<T | null> {
  try {
    if (!secret || token.length > 100000) return null;
    const [payload, signature, extra] = token.split('.');
    if (extra || !payload || !/^[a-f0-9]{64}$/.test(signature)) return null;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const bytes = new Uint8Array(signature.match(/../g)!.map(s => parseInt(s,16)));
    if (!await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(`${purpose}:${payload}`))) return null;
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0)))) as T;
    return Number.isFinite(data.expires) && data.expires > Date.now() ? data : null;
  } catch { return null; }
}
export type RealtimeTicket = { playerId: string; friends: string[]; admin: boolean; expires: number };
export type RealtimePublish = { targets: string[]; admins?: boolean; scope: 'community' | 'support' | 'revoke' | 'friends'; change?: { kind: 'message' | 'read' | 'friends' | 'invite'; actor: string; peer: string }; expires: number };
