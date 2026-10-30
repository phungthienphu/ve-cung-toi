import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Math Quest sessions: a signed cookie per role. Students log in with the
// name + PIN the tutor gave them; the tutor with MATH_QUEST_TUTOR_PASSWORD.
// The signing key is derived from that password, so changing it logs
// everyone out — acceptable for one tutor's class, and it means a single
// env var to set up.

const TUTOR_PASSWORD = process.env.MATH_QUEST_TUTOR_PASSWORD ?? "";
const COOKIE = { student: "mq_student", tutor: "mq_tutor" } as const;
const MAX_AGE_DAYS = { student: 180, tutor: 30 } as const;

export type SessionRole = keyof typeof COOKIE;

export function isConfigured() {
  return TUTOR_PASSWORD.length > 0;
}

export const NOT_CONFIGURED = "Chưa cấu hình MATH_QUEST_TUTOR_PASSWORD trên server.";

const key = () => createHash("sha256").update(`mq-session|${TUTOR_PASSWORD}`).digest();
const mac = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url");

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function startSession(role: SessionRole, subject: string) {
  const maxAge = MAX_AGE_DAYS[role] * 24 * 60 * 60;
  const payload = `${role}|${subject}|${Date.now() + maxAge * 1000}`;
  const store = await cookies();
  store.set(COOKIE[role], `${Buffer.from(payload).toString("base64url")}.${mac(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

/** The session's subject (student id, or "tutor"), or null if missing, forged or expired. */
export async function readSession(role: SessionRole): Promise<string | null> {
  if (!isConfigured()) return null;
  const token = (await cookies()).get(COOKIE[role])?.value;
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const payload = Buffer.from(body, "base64url").toString();
  if (!safeEqual(signature, mac(payload))) return null;
  const [kind, subject, expiresAt] = payload.split("|");
  if (kind !== role || !subject || Number(expiresAt) < Date.now()) return null;
  return subject;
}

export async function endSessions() {
  const store = await cookies();
  store.delete(COOKIE.student);
  store.delete(COOKIE.tutor);
}

export function checkTutorPassword(input: string) {
  if (!isConfigured()) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest("hex");
  return safeEqual(digest(input), digest(TUTOR_PASSWORD));
}

// The exercise maker's answers need the tutor's password typed on the page,
// even on a device already logged in (a projector, a kid's phone). The page
// keeps this key in memory only, so a reload locks the answers again.
const ANSWER_KEY_MINUTES = 30;

export function issueAnswerKey() {
  const expiresAt = Date.now() + ANSWER_KEY_MINUTES * 60_000;
  return `${expiresAt}.${mac(`answers|${expiresAt}`)}`;
}

export function checkAnswerKey(key: unknown) {
  if (!isConfigured() || typeof key !== "string") return false;
  const [expiresAt, signature] = key.split(".");
  if (!expiresAt || !signature || Number(expiresAt) < Date.now()) return false;
  return safeEqual(signature, mac(`answers|${expiresAt}`));
}

export function hashPin(pin: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(pin, salt, 32).toString("hex") };
}

export function checkPin(pin: string, salt: string, hash: string) {
  return safeEqual(hashPin(pin, salt).hash, hash);
}

/** "Minh Đức " → "minh duc": names are matched without accents or case. */
export function nameKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export const PIN_PATTERN = /^\d{4,6}$/;
