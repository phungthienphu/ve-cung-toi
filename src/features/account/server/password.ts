import { hash, verify } from '@node-rs/argon2';
const options = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
let dummy: Promise<string> | undefined;
export function validPassword(value: unknown): value is string { return typeof value === 'string' && value.length >= 12 && value.length <= 128; }
export function hashPassword(value: string) { return hash(value, options); }
export async function checkPassword(encoded: string | null | undefined, value: string) {
  const target = encoded || await (dummy ??= hashPassword('dummy-check-not-a-user-password'));
  try { return await verify(target, value) && !!encoded; } catch { return false; }
}
export function normalizeEmail(value: unknown) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }
export function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function normalizeUsername(value: unknown) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }
export function validUsername(value: string) { return /^[a-z0-9_]{3,24}$/.test(value); }
