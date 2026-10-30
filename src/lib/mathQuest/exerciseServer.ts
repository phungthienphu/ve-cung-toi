import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { FortuneUsage } from "@/lib/models/FortuneUsage";
import { MqStudent } from "@/lib/models/MathQuest";
import type { ExerciseDoc, ExerciseSetDoc } from "@/lib/models/Exercise";
import { NOT_CONFIGURED, isConfigured, readSession } from "@/lib/mathQuest/session";
import type { ExerciseAnswer, ExerciseSetView, ExerciseView, Quota, Viewer } from "@/lib/mathQuest/exerciseTypes";

// Server helpers for the exercise maker's two API routes: who's asking,
// their daily AI allowance, and the shapes sent to the browser.

/** Logged-in tutor or student, or an error response. A device logged in as the tutor counts as the tutor. */
export async function exerciseGuard(): Promise<{ viewer: Viewer; denied?: undefined } | { denied: NextResponse; viewer?: undefined }> {
  if (!isConfigured()) return { denied: NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 }) };
  if (!process.env.MONGODB_URI) return { denied: NextResponse.json({ error: "Chưa cấu hình cơ sở dữ liệu." }, { status: 503 }) };
  await dbConnect();
  if ((await readSession("tutor")) === "tutor") return { viewer: { role: "tutor", id: "tutor", name: "Gia sư" } };
  const studentId = await readSession("student");
  const student = studentId ? await MqStudent.findById(studentId).lean().catch(() => null) : null;
  if (student) return { viewer: { role: "student", id: String(student._id), name: student.name, grade: student.grade } };
  return { denied: NextResponse.json({ error: "Cần đăng nhập để dùng Xưởng đề." }, { status: 401 }) };
}

// AI calls a day: generating, revising and listing a lesson's problem types
// all count. Counters share the fortune teller's TTL collection.
const DAILY = { tutor: 40, student: 15 } as const;
const SITE_DAILY = 150;
const PASSWORD_TRIES_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

const vietnamNow = () => new Date(Date.now() + 7 * HOUR_MS).toISOString();
const dayKey = () => vietnamNow().slice(0, 10);
const hourKey = () => vietnamNow().slice(0, 13);
const limitOf = (viewer: Viewer) => DAILY[viewer.role];

async function bump(key: string, by = 1, retry = true): Promise<number> {
  try {
    const doc = await FortuneUsage.findOneAndUpdate(
      { key },
      { $inc: { count: by }, $setOnInsert: { expiresAt: new Date(Date.now() + 48 * HOUR_MS) } },
      { upsert: true, new: true },
    );
    return doc.count;
  } catch (error) {
    // Two first requests in the same window can race on the upsert; the loser retries as an update.
    if (retry && (error as { code?: number }).code === 11000) return bump(key, by, false);
    throw error;
  }
}

export async function readQuota(viewer: Viewer): Promise<Quota> {
  const used = (await FortuneUsage.findOne({ key: `exercise:${viewer.id}:${dayKey()}` }).lean())?.count ?? 0;
  return { left: Math.max(0, limitOf(viewer) - used), limit: limitOf(viewer) };
}

/** Spends one AI call from the viewer's and the site's daily allowance. */
export async function takeAiTurn(viewer: Viewer): Promise<{ ok: true; quota: Quota } | { ok: false; error: string }> {
  const day = dayKey();
  const used = await bump(`exercise:${viewer.id}:${day}`);
  if (used > limitOf(viewer)) return { ok: false, error: `Hôm nay đã dùng hết ${limitOf(viewer)} lượt AI. Mai quay lại nhé!` };
  if ((await bump(`exercise:site:${day}`)) > SITE_DAILY) {
    await bump(`exercise:${viewer.id}:${day}`, -1);
    return { ok: false, error: "Hôm nay cả lớp đã dùng hết lượt AI. Mai quay lại nhé!" };
  }
  return { ok: true, quota: { left: limitOf(viewer) - used, limit: limitOf(viewer) } };
}

/** Gives back a turn the AI failed to deliver on. Never throws. */
export async function refundAiTurn(viewer: Viewer) {
  const day = dayKey();
  try {
    await Promise.all([bump(`exercise:${viewer.id}:${day}`, -1), bump(`exercise:site:${day}`, -1)]);
  } catch (error) {
    console.error("[exercises] refund failed", error);
  }
}

/** Counts a try at the tutor password; false once there were too many this hour. */
export async function takePasswordTry(viewer: Viewer) {
  return (await bump(`exercise-pw:${viewer.id}:${hourKey()}`)) <= PASSWORD_TRIES_PER_HOUR;
}

export const exerciseView = (exercise: ExerciseDoc): ExerciseView => ({
  id: String(exercise._id),
  title: exercise.title,
  level: exercise.level,
  statement: exercise.statement,
  verified: exercise.verified,
  saved: exercise.saved,
});

export const answerView = (exercise: ExerciseDoc): ExerciseAnswer => ({
  id: String(exercise._id),
  answer: exercise.answer,
  solution: exercise.solution,
  issue: exercise.issue,
});

export const setView = (set: ExerciseSetDoc & { _id: unknown }): ExerciseSetView => ({
  id: String(set._id),
  ownerName: set.ownerName,
  lessonId: set.lessonId,
  kindLabel: set.kindLabel,
  style: set.style,
  contexts: set.contexts,
  level: set.level,
  note: set.note,
  noteIgnored: set.noteIgnored,
  createdAt: new Date(set.createdAt).toISOString(),
  exercises: set.exercises.map(exerciseView),
});

/** Whose sets a viewer may see and change: a student their own, the tutor everyone's. */
export const ownerFilter = (viewer: Viewer) => (viewer.role === "tutor" ? {} : { owner: viewer.id });
