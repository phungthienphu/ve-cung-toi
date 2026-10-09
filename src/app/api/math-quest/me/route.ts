import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { MqLessonProgress, MqLessonReview, MqStudent } from "@/lib/models/MathQuest";
import { NOT_CONFIGURED, isConfigured, readSession } from "@/lib/mathQuest/session";
import { findLesson } from "@shared/mathQuestLessons";

// Who is looking at the notebook, and what they may see.
// GET → { role: "student", student, progress, approved } | { role: "tutor", approved } | { role: null }
// POST { action: "open" | "practice", lessonId, correct?, total? } — a student's activity on a lesson.

export async function GET() {
  if (!isConfigured()) return NextResponse.json({ role: null, error: NOT_CONFIGURED });
  const studentId = await readSession("student");
  const tutor = (await readSession("tutor")) === "tutor";
  if (!studentId && !tutor) return NextResponse.json({ role: null });

  await dbConnect();
  const approved = (await MqLessonReview.find({ status: "approved" }).lean()).map((review) => review.lessonId);

  if (studentId) {
    const student = await MqStudent.findById(studentId).lean().catch(() => null);
    if (student) {
      const progress = await MqLessonProgress.find({ studentId }).lean();
      return NextResponse.json({
        role: "student",
        student: { id: String(student._id), name: student.name, grade: student.grade },
        approved,
        progress: progress.map((entry) => ({
          lessonId: entry.lessonId,
          taughtAt: entry.taughtAt,
          lastOpenedAt: entry.lastOpenedAt,
          practiceCorrect: entry.practiceCorrect,
          practiceTotal: entry.practiceTotal,
        })),
      });
    }
  }
  // A tutor previews every lesson, approved or not.
  if (tutor) return NextResponse.json({ role: "tutor", approved });
  return NextResponse.json({ role: null });
}

export async function POST(req: Request) {
  const studentId = await readSession("student");
  if (!studentId) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; lessonId?: string; correct?: number; total?: number };
  const lesson = findLesson(String(body.lessonId ?? ""));
  if (!lesson) return NextResponse.json({ error: "Không tìm thấy bài." }, { status: 404 });

  await dbConnect();
  // Only lessons the tutor has taught this student (and approved) count.
  const [progress, approved] = await Promise.all([
    MqLessonProgress.findOne({ studentId, lessonId: lesson.id }),
    MqLessonReview.exists({ lessonId: lesson.id, status: "approved" }),
  ]);
  if (!progress?.taughtAt || !approved) return NextResponse.json({ error: "Bài này chưa mở." }, { status: 403 });

  if (body.action === "open") {
    progress.lastOpenedAt = new Date();
  } else if (body.action === "practice") {
    const total = Math.max(0, Math.min(20, Math.round(Number(body.total) || 0)));
    const correct = Math.max(0, Math.min(total, Math.round(Number(body.correct) || 0)));
    progress.practiceCorrect += correct;
    progress.practiceTotal += total;
    progress.lastPracticedAt = new Date();
  } else return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  await progress.save();
  return NextResponse.json({ ok: true });
}
