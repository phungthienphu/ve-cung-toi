import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { isId, tutorGuard } from "@/lib/mathQuest/tutorApi";
import { FortuneReading } from "@/lib/models/FortuneReading";

export const dynamic = "force-dynamic";

// The fortune teller's history, for the admin only (same login as the Math
// Quest tutor; unlocked from /card-draw via ./session).
// GET ?q=<text>&before=<id> — newest first, PAGE at a time.
// DELETE ?id=<id> — remove one reading.

const PAGE = 30;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Midnight today, Vietnam time. */
function startOfToday() {
  const offset = 7 * 60 * 60 * 1000;
  const local = new Date(Date.now() + offset);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
}

export async function GET(req: Request) {
  const denied = await tutorGuard();
  if (denied) return denied;
  const params = new URL(req.url).searchParams;
  const query = params.get("q")?.trim().slice(0, 100) ?? "";
  const before = params.get("before");

  const filter: Record<string, unknown> = {};
  if (query) {
    const pattern = new RegExp(escapeRegex(query), "i");
    filter.$or = [{ name: pattern }, { question: pattern }, { text: pattern }];
  }
  const pageFilter = isId(before) ? { ...filter, _id: { $lt: new mongoose.Types.ObjectId(before) } } : filter;

  const [docs, total, today] = await Promise.all([
    FortuneReading.find(pageFilter)
      .sort({ _id: -1 })
      .limit(PAGE + 1)
      .lean(),
    FortuneReading.countDocuments(filter),
    FortuneReading.countDocuments({ createdAt: { $gte: startOfToday() } }),
  ]);
  const page = docs.slice(0, PAGE);
  return NextResponse.json({
    items: page.map((doc) => ({
      id: String(doc._id),
      createdAt: doc.createdAt,
      name: doc.name,
      question: doc.question,
      topic: doc.topic,
      cards: doc.cards,
      text: doc.text,
      source: doc.source,
      status: doc.status,
      reason: doc.reason,
      model: doc.model,
      visitor: doc.visitor.slice(0, 6),
    })),
    nextCursor: docs.length > PAGE ? String(page[page.length - 1]._id) : null,
    total,
    today,
  });
}

export async function DELETE(req: Request) {
  const denied = await tutorGuard();
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id");
  if (!isId(id)) return NextResponse.json({ error: "Thiếu id." }, { status: 400 });
  await FortuneReading.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}
