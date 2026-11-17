import { randomBytes, timingSafeEqual } from 'node:crypto';
import { argon2idAsync } from '@noble/hashes/argon2.js';
const options = { m: 19456, t: 2, p: 1, dkLen: 32 };
let dummy: Promise<string> | undefined;
export function validPassword(value: unknown): value is string { return typeof value === 'string' && value.length >= 12 && value.length <= 128; }
export async function hashPassword(value: string) {
  const salt = randomBytes(16);
  const hash = await argon2idAsync(value, salt, options);
  return `$argon2id$v=19$m=${options.m},t=${options.t},p=${options.p}$${salt.toString('base64').replace(/=+$/, '')}$${Buffer.from(hash).toString('base64').replace(/=+$/, '')}`;
}
export async function checkPassword(encoded: string | null | undefined, value: string) {
  const target = encoded || await (dummy ??= hashPassword('dummy-check-not-a-user-password'));
  try {
    const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(target);
    if (!match) return false;
    const [, memory, iterations, parallelism, salt, digest] = match;
    const m = Number(memory), t = Number(iterations), p = Number(parallelism);
    const expected = Buffer.from(digest, 'base64');
    if (m < 8 || m > 65536 || t < 1 || t > 6 || p < 1 || p > 4 || expected.length < 16 || expected.length > 64) return false;
    const actual = await argon2idAsync(value, Buffer.from(salt, 'base64'), { m, t, p, dkLen: expected.length });
    return timingSafeEqual(expected, actual) && !!encoded;
  } catch { return false; }
}
export function normalizeEmail(value: unknown) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }
export function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function normalizeUsername(value: unknown) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }
export function validUsername(value: string) { return /^[a-z0-9_]{3,24}$/.test(value); }
