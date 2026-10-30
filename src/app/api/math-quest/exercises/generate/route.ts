import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { MqExerciseKinds, MqExerciseSet, type ExerciseDoc } from "@/lib/models/Exercise";
import { AiFailure, aiConfigured, exerciseModel, isChange, reviseExercise, writeExercises, type Draft, type ExerciseRequest } from "@/lib/mathQuest/exerciseAi";
import { exerciseGuard, exerciseView, ownerFilter, refundAiTurn, setView, takeAiTurn } from "@/lib/mathQuest/exerciseServer";
import { findCurriculumLesson } from "@/lib/mathQuest/curriculum";
import { isId } from "@/lib/mathQuest/tutorApi";
import { COUNTS, LEVEL_CHOICES, MIX_KIND, NOTE_MAX, type GenerateEvent, type LevelChoice } from "@/lib/mathQuest/exerciseTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST { action: "generate", lessonId, kindId, style, contexts, level, count, note }
//    | { action: "revise", exerciseId, change }
// The AI writes; the reply streams back as NDJSON lines (GenerateEvent):
// progress while it writes, a stage while the machine checks (and repairs),
// then the new set or exercise — never its answers, which need the tutor's
// password (../route.ts "answers"). Every choice must come from the pickers:
// contexts from the lesson's list, never free text; only the note is typed.

export async function POST(req: Request) {
  const { viewer, denied } = await exerciseGuard();
  if (denied) return denied;
  if (!aiConfigured()) return NextResponse.json({ error: "Server chưa cấu hình AI (AI_ROUTER_API_KEY, AI_ROUTER_BASE_URL)." }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

  let job: (signal: AbortSignal, send: (event: GenerateEvent) => void, quota: { left: number; limit: number }) => Promise<void>;

  if (body.action === "generate") {
    const found = findCurriculumLesson(body.lessonId);
    if (!found) return fail("Không có bài này.");
    const kindsDoc = await MqExerciseKinds.findOne({ lessonId: found.lesson.id }).lean();
    if (!kindsDoc) return fail("Bài này chưa có danh sách dạng bài.");
    const visible = kindsDoc.kinds.filter((kind) => !kindsDoc.hidden.includes(kind.id));
    const mix = body.kindId === MIX_KIND;
    const kinds = mix ? visible : visible.filter((kind) => kind.id === body.kindId);
    if (kinds.length === 0) return fail("Danh sách dạng bài vừa được làm mới — chọn lại dạng nhé.");
    const style = body.style === "real" ? "real" : "basic";
    if (style === "real" && !kinds.some((kind) => kind.real)) return fail("Dạng này không có bài toán thực tế.");
    const allowed = new Set(kinds.flatMap((kind) => kind.contexts));
    const contexts = style === "real" && Array.isArray(body.contexts) ? [...new Set(body.contexts.filter((item): item is string => typeof item === "string" && allowed.has(item)))].slice(0, 12) : [];
    const level = LEVEL_CHOICES.find((choice) => choice.id === body.level)?.id as LevelChoice | undefined;
    if (!level) return fail("Chọn mức độ.");
    const count = Number(body.count);
    if (!COUNTS.includes(count as (typeof COUNTS)[number])) return fail("Chọn số câu.");
    const note = String(body.note ?? "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);
    const request: ExerciseRequest = { lesson: found.lesson, chapter: found.chapter, kinds, mix, style, contexts, level, count, note };

    job = async (signal, send, quota) => {
      send({ type: "progress", done: 0, total: count });
      const result = await writeExercises(request, signal, (done) => send({ type: "progress", done, total: count }), (stage) => send({ type: "stage", stage }));
      const set = await MqExerciseSet.create({
        owner: viewer.id,
        ownerName: viewer.name,
        lessonId: found.lesson.id,
        kindLabel: mix ? "Trộn các dạng" : kinds[0].label,
        style,
        contexts,
        level,
        note,
        noteIgnored: Boolean(note) && result.noteIgnored,
        model: exerciseModel(),
        exercises: result.exercises,
      });
      send({ type: "set", set: setView(set.toObject()), quota });
    };
  } else if (body.action === "revise") {
    if (!isId(body.exerciseId) || !isChange(body.change)) return fail("Yêu cầu không hợp lệ.");
    const exerciseId = body.exerciseId;
    const change = body.change;
    const set = await MqExerciseSet.findOne({ "exercises._id": exerciseId, ...ownerFilter(viewer) }).lean();
    const index = set ? set.exercises.findIndex((exercise) => String(exercise._id) === exerciseId) : -1;
    const found = set && findCurriculumLesson(set.lessonId);
    if (!set || index < 0 || !found) return fail("Không tìm thấy câu này.", 404);
    const current = set.exercises[index];
    const draft: Draft = { title: current.title, level: current.level, statement: current.statement, answer: current.answer, solution: current.solution, check: current.check };

    job = async (signal, send, quota) => {
      send({ type: "progress", done: 0, total: 1 });
      const revised = await reviseExercise(draft, change, { ...found, kindLabel: set.kindLabel, style: set.style }, signal, (stage) => send({ type: "stage", stage }));
      // A new id, so nobody keeps the old exercise's answer on screen.
      const replacement = { ...revised, _id: new Types.ObjectId(), saved: false } satisfies ExerciseDoc;
      const updated = await MqExerciseSet.findOneAndUpdate({ _id: set._id, "exercises._id": exerciseId }, { $set: { "exercises.$": replacement } }, { new: true }).lean();
      if (!updated) throw new AiFailure("Bộ đề này vừa bị xoá.");
      send({ type: "exercise", setId: String(set._id), index, exercise: exerciseView(replacement), quota });
    };
  } else {
    return fail("Yêu cầu không hợp lệ.");
  }

  const turn = await takeAiTurn(viewer);
  if (!turn.ok) return fail(turn.error, 429);

  const abort = new AbortController();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: GenerateEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The reader left.
        }
      };
      try {
        await job(abort.signal, send, turn.quota);
      } catch (error) {
        if (!abort.signal.aborted) {
          console.error("[exercises] generate failed", error);
          await refundAiTurn(viewer);
          send({ type: "error", error: error instanceof AiFailure ? error.message : "AI đang bận hoặc gặp lỗi — thử lại sau ít phút nhé." });
        }
      }
      try {
        controller.close();
      } catch {
        // Already cancelled.
      }
    },
    cancel() {
      // The page was closed or "Huỷ" pressed: stop paying for the rest.
      abort.abort();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
