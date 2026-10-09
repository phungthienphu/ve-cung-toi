import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { MqStudent } from "@/lib/models/MathQuest";
import { NOT_CONFIGURED, checkPin, checkTutorPassword, endSessions, isConfigured, nameKey, startSession } from "@/lib/mathQuest/session";

const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 10 * 60 * 1000;

// POST { role: "tutor", password } | { role: "student", name, pin } — log in.
// DELETE — log out (both roles).
export async function POST(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { role?: string; password?: string; name?: string; pin?: string };

  if (body.role === "tutor") {
    if (!checkTutorPassword(String(body.password ?? ""))) return NextResponse.json({ error: "Sai mật khẩu." }, { status: 401 });
    await startSession("tutor", "tutor");
    return NextResponse.json({ ok: true });
  }

  const name = String(body.name ?? "");
  const pin = String(body.pin ?? "");
  if (!name.trim() || !pin) return NextResponse.json({ error: "Nhập tên và mã PIN." }, { status: 400 });

  await dbConnect();
  const student = await MqStudent.findOne({ nameKey: nameKey(name) });
  const wrong = NextResponse.json({ error: "Tên hoặc mã PIN chưa đúng." }, { status: 401 });
  if (!student) return wrong;
  // A 4-digit PIN is easy to guess by brute force, so a few misses lock the
  // account for a while.
  if (student.lockedUntil && student.lockedUntil.getTime() > Date.now()) {
    return NextResponse.json({ error: "Nhập sai nhiều lần — thử lại sau ít phút nhé." }, { status: 429 });
  }
  if (!checkPin(pin, student.pinSalt, student.pinHash)) {
    student.failedLogins = (student.failedLogins ?? 0) + 1;
    if (student.failedLogins >= MAX_FAILED_LOGINS) {
      student.failedLogins = 0;
      student.lockedUntil = new Date(Date.now() + LOCK_MS);
    }
    await student.save();
    return wrong;
  }
  student.failedLogins = 0;
  student.lockedUntil = null;
  await student.save();
  await startSession("student", String(student._id));
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await endSessions();
  return NextResponse.json({ ok: true });
}
