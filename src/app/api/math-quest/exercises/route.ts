import { NextResponse } from "next/server";
import { MqExerciseKinds, MqExerciseSet } from "@/lib/models/Exercise";
import { AiFailure, aiConfigured, suggestKinds } from "@/lib/mathQuest/exerciseAi";
import { answerView, exerciseGuard, exerciseView, ownerFilter, readQuota, refundAiTurn, setView, takeAiTurn, takePasswordTry } from "@/lib/mathQuest/exerciseServer";
import { findCurriculumLesson } from "@/lib/mathQuest/curriculum";
import { checkAnswerKey, checkTutorPassword, issueAnswerKey } from "@/lib/mathQuest/session";
import { isId } from "@/lib/mathQuest/tutorApi";
import type { ExerciseKindsDoc } from "@/lib/models/Exercise";
import type { LibraryItem } from "@/lib/mathQuest/exerciseTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The exercise maker (docs/xuong-de-ai-spec.md), everything but the AI
// writing itself (that streams from ./generate).
// GET: who's asking, their AI allowance, recent sets, the tutor's library.
// POST { action, ... }: a lesson's problem types (asking the AI the first
// time), unlocking answers with the tutor password, the library.

const RECENT_SETS = 20;

export async function GET() {
  const { viewer, denied } = await exerciseGuard();
  if (denied) return denied;
  const [quota, sets, saved] = await Promise.all([
    readQuota(viewer),
    MqExerciseSet.find(ownerFilter(viewer)).sort({ createdAt: -1 }).limit(RECENT_SETS).lean(),
    viewer.role === "tutor" ? MqExerciseSet.find({ "exercises.saved": true }).sort({ createdAt: -1 }).limit(200).lean() : Promise.resolve([]),
  ]);
  const library: LibraryItem[] = saved.flatMap((set) =>
    set.exercises.filter((exercise) => exercise.saved).map((exercise) => ({ ...exerciseView(exercise), lessonId: set.lessonId, setId: String(set._id) })),
  );
  return NextResponse.json({ viewer, ai: aiConfigured(), quota, sets: sets.map(setView), library });
}

const visibleKinds = (doc: ExerciseKindsDoc) => doc.kinds.filter((kind) => !doc.hidden.includes(kind.id));

export async function POST(req: Request) {
  const { viewer, denied } = await exerciseGuard();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
  const tutorOnly = () => fail("Chỉ gia sư mới làm được việc này.", 403);
  const locked = () => NextResponse.json({ error: "Cần nhập mật khẩu gia sư để xem đáp án.", locked: true }, { status: 401 });

  switch (body.action) {
    case "kinds": {
      const found = findCurriculumLesson(body.lessonId);
      if (!found) return fail("Không có bài này.");
      const refresh = body.refresh === true;
      if (refresh && viewer.role !== "tutor") return tutorOnly();
      let doc = await MqExerciseKinds.findOne({ lessonId: found.lesson.id }).lean();
      if (!doc || refresh || doc.kinds.length === 0) {
        if (!aiConfigured()) return fail("Server chưa cấu hình AI.", 503);
        const turn = await takeAiTurn(viewer);
        if (!turn.ok) return fail(turn.error, 429);
        try {
          const kinds = await suggestKinds(found.lesson, found.chapter, AbortSignal.timeout(55_000));
          doc = await MqExerciseKinds.findOneAndUpdate({ lessonId: found.lesson.id }, { $set: { kinds, hidden: [] } }, { upsert: true, new: true }).lean();
        } catch (error) {
          console.error("[exercises] kinds failed", error);
          await refundAiTurn(viewer);
          return fail(error instanceof AiFailure ? error.message : "AI đang bận — thử lại sau ít phút nhé.", 502);
        }
      }
      return NextResponse.json({ kinds: visibleKinds(doc!), hidden: doc!.hidden.length, quota: await readQuota(viewer) });
    }

    case "hide_kind":
    case "unhide_kinds": {
      if (viewer.role !== "tutor") return tutorOnly();
      const found = findCurriculumLesson(body.lessonId);
      if (!found) return fail("Không có bài này.");
      const update = body.action === "hide_kind" ? { $addToSet: { hidden: String(body.kindId ?? "") } } : { $set: { hidden: [] } };
      const doc = await MqExerciseKinds.findOneAndUpdate({ lessonId: found.lesson.id }, update, { new: true }).lean();
      if (!doc) return fail("Bài này chưa có danh sách dạng.");
      return NextResponse.json({ kinds: visibleKinds(doc), hidden: doc.hidden.length });
    }

    case "unlock": {
      if (!(await takePasswordTry(viewer))) return fail("Nhập sai quá nhiều lần — thử lại sau 1 giờ.", 429);
      if (!checkTutorPassword(String(body.password ?? ""))) return fail("Sai mật khẩu gia sư.", 401);
      return NextResponse.json({ key: issueAnswerKey() });
    }

    case "answers": {
      if (!checkAnswerKey(body.key)) return locked();
      const ids = (Array.isArray(body.ids) ? body.ids : []).filter(isId).slice(0, 300);
      if (ids.length === 0) return NextResponse.json({ answers: [] });
      const wanted = new Set(ids);
      const sets = await MqExerciseSet.find({ "exercises._id": { $in: ids }, ...ownerFilter(viewer) }).lean();
      const answers = sets.flatMap((set) => set.exercises.filter((exercise) => wanted.has(String(exercise._id))).map(answerView));
      return NextResponse.json({ answers });
    }

    case "edit": {
      if (viewer.role !== "tutor") return tutorOnly();
      if (!checkAnswerKey(body.key)) return locked();
      if (!isId(body.exerciseId)) return fail("Thiếu câu cần sửa.");
      const statement = String(body.statement ?? "").trim().slice(0, 4000);
      if (!statement) return fail("Đề bài không được để trống.");
      const solution = (Array.isArray(body.solution) ? body.solution : []).map((step) => String(step).trim().slice(0, 1000)).filter(Boolean).slice(0, 30);
      const set = await MqExerciseSet.findOneAndUpdate(
        { "exercises._id": body.exerciseId },
        {
          $set: {
            "exercises.$.statement": statement,
            "exercises.$.answer": String(body.answer ?? "").trim().slice(0, 1000),
            "exercises.$.solution": solution,
            // The tutor's word now, not the machine check's.
            "exercises.$.verified": "manual",
            "exercises.$.issue": "",
          },
        },
        { new: true },
      ).lean();
      const exercise = set?.exercises.find((item) => String(item._id) === body.exerciseId);
      if (!exercise) return fail("Không tìm thấy câu này.", 404);
      return NextResponse.json({ exercise: exerciseView(exercise), answer: answerView(exercise) });
    }

    case "save": {
      if (viewer.role !== "tutor") return tutorOnly();
      if (!isId(body.exerciseId)) return fail("Thiếu câu cần lưu.");
      await MqExerciseSet.updateOne({ "exercises._id": body.exerciseId }, { $set: { "exercises.$.saved": body.saved === true } });
      return NextResponse.json({ ok: true });
    }

    case "delete_set": {
      if (!isId(body.setId)) return fail("Thiếu bộ đề cần xoá.");
      await MqExerciseSet.deleteOne({ _id: body.setId, ...ownerFilter(viewer) });
      return NextResponse.json({ ok: true });
    }
  }
  return fail("Yêu cầu không hợp lệ.");
}
