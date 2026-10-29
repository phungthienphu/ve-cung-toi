import { NextResponse } from "next/server";
import { takeLoginAttempt, visitorId } from "@/lib/fortuneAi";
import { NOT_CONFIGURED, checkTutorPassword, endSessions, isConfigured, startSession } from "@/lib/mathQuest/session";
import { dbConnect } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// POST { password } — unlock the fortune history. Same password and session
// as the Math Quest tutor (MATH_QUEST_TUTOR_PASSWORD): one admin.
// DELETE — lock it again.
export async function POST(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  try {
    await dbConnect();
    // The page is public, so guessing is capped per visitor.
    if (!(await takeLoginAttempt(visitorId(req)))) {
      return NextResponse.json({ error: "Nhập sai nhiều lần quá, đợi một lúc rồi thử lại." }, { status: 429 });
    }
  } catch (error) {
    console.error("[fortune] history login check failed", error);
    return NextResponse.json({ error: "Không kết nối được cơ sở dữ liệu." }, { status: 503 });
  }
  if (!checkTutorPassword(String(body.password ?? ""))) return NextResponse.json({ error: "Sai mật khẩu." }, { status: 401 });
  await startSession("tutor", "tutor");
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await endSessions();
  return NextResponse.json({ ok: true });
}
