import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { MqLessonProgress, MqLessonReview, MqStudent } from "@/lib/models/MathQuest";
import { NOT_CONFIGURED, PIN_PATTERN, hashPin, isConfigured, nameKey, readSession } from "@/lib/mathQuest/session";
import { findLesson } from "@shared/mathQuestLessons";

// The tutor's dashboard API. GET: everything the dashboard shows.
// POST { action, ... }: manage students, mark lessons taught, review drafts.

async function guard() {
  if (!isConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  if ((await readSession("tutor")) !== "tutor") return NextResponse.json({ error: "Cần đăng nhập gia sư." }, { status: 401 });
  await dbConnect();
  return null;
}

const isId = (value: unknown): value is string => typeof value === "string" && mongoose.isValidObjectId(value);

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const [students, progress, reviews] = await Promise.all([
    MqStudent.find().sort({ createdAt: 1 }).lean(),
    MqLessonProgress.find().lean(),
    MqLessonReview.find().lean(),
  ]);
  return NextResponse.json({
    students: students.map((student) => ({ id: String(student._id), name: student.name, grade: student.grade })),
    progress: progress.map((entry) => ({
      studentId: String(entry.studentId),
      lessonId: entry.lessonId,
      taughtAt: entry.taughtAt,
      lastOpenedAt: entry.lastOpenedAt,
      practiceCorrect: entry.practiceCorrect,
      practiceTotal: entry.practiceTotal,
    })),
    reviews: reviews.map((review) => ({ lessonId: review.lessonId, status: review.status, note: review.note, updatedAt: review.updatedAt })),
  });
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fail = (error: string) => NextResponse.json({ error }, { status: 400 });

  switch (body.action) {
    case "create_student": {
      const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
      const grade = Number(body.grade);
      const pin = String(body.pin ?? "");
      if (!name) return fail("Nhập tên học sinh.");
      if (grade !== 8 && grade !== 9) return fail("Chọn lớp 8 hoặc 9.");
      if (!PIN_PATTERN.test(pin)) return fail("Mã PIN gồm 4–6 chữ số.");
      if (await MqStudent.exists({ nameKey: nameKey(name) })) return fail("Đã có học sinh trùng tên (không tính dấu). Thêm họ hoặc biệt danh cho khác nhé.");
      const { salt, hash } = hashPin(pin);
      await MqStudent.create({ name, nameKey: nameKey(name), grade, pinSalt: salt, pinHash: hash });
      return NextResponse.json({ ok: true });
    }

    case "update_student": {
      if (!isId(body.studentId)) return fail("Không tìm thấy học sinh.");
      const update: Record<string, unknown> = {};
      if (body.grade !== undefined) {
        const grade = Number(body.grade);
        if (grade !== 8 && grade !== 9) return fail("Chọn lớp 8 hoặc 9.");
        update.grade = grade;
      }
      if (body.pin !== undefined) {
        const pin = String(body.pin);
        if (!PIN_PATTERN.test(pin)) return fail("Mã PIN gồm 4–6 chữ số.");
        const { salt, hash } = hashPin(pin);
        Object.assign(update, { pinSalt: salt, pinHash: hash, failedLogins: 0, lockedUntil: null });
      }
      await MqStudent.updateOne({ _id: body.studentId }, { $set: update });
      return NextResponse.json({ ok: true });
    }

    case "delete_student": {
      if (!isId(body.studentId)) return fail("Không tìm thấy học sinh.");
      await Promise.all([MqStudent.deleteOne({ _id: body.studentId }), MqLessonProgress.deleteMany({ studentId: body.studentId })]);
      return NextResponse.json({ ok: true });
    }

    case "set_taught": {
      if (!isId(body.studentId) || !findLesson(String(body.lessonId))) return fail("Không tìm thấy bài hoặc học sinh.");
      await MqLessonProgress.updateOne(
        { studentId: body.studentId, lessonId: body.lessonId },
        { $set: { taughtAt: body.taught ? new Date() : null } },
        { upsert: true }
      );
      return NextResponse.json({ ok: true });
    }

    case "review": {
      const lessonId = String(body.lessonId ?? "");
      if (!findLesson(lessonId)) return fail("Không tìm thấy bài.");
      // "draft" clears the review: the lesson goes back to awaiting approval.
      if (body.status === "draft") await MqLessonReview.deleteOne({ lessonId });
      else if (body.status === "approved" || body.status === "changes") {
        await MqLessonReview.updateOne(
          { lessonId },
          { $set: { status: body.status, note: String(body.note ?? "").slice(0, 1000) } },
          { upsert: true }
        );
      } else return fail("Trạng thái không hợp lệ.");
      return NextResponse.json({ ok: true });
    }

    default:
      return fail("Thao tác không hợp lệ.");
  }
}
