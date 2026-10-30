"use client";

import { useEffect, useMemo, useState } from "react";
import { CURRICULUM, findCurriculumLesson, type CurriculumGrade } from "@/lib/mathQuest/curriculum";
import { COUNTS, LEVEL_CHOICES, MIX_KIND, NOTE_MAX, type ExerciseKind, type ExerciseStyle, type LevelChoice, type Quota, type Viewer } from "@/lib/mathQuest/exerciseTypes";
import { postExercises } from "./api";

// The exercise maker's pickers, top to bottom: grade → chapter → lesson →
// problem type (listed by the AI, cached) → basic / real-world → contexts
// → level → how many. Everything is picked, nothing typed, except an
// optional short note.

export interface BuilderRequest {
  lessonId: string;
  kindId: string;
  style: ExerciseStyle;
  contexts: string[];
  level: LevelChoice;
  count: number;
  note: string;
}

interface KindList {
  kinds: ExerciseKind[];
  hidden: number;
}

const STORAGE_KEY = "vct_xuong_de";

interface Remembered {
  grade: CurriculumGrade;
  lessonId: string;
  style: ExerciseStyle;
  level: LevelChoice;
  count: number;
}

function remembered(): Partial<Remembered> {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Remembered>;
  } catch {
    return {};
  }
}

const firstLesson = (grade: CurriculumGrade) => CURRICULUM.find((chapter) => chapter.grade === grade)!.lessons[0].id;

export function Builder({
  viewer,
  ai,
  quota,
  busy,
  onGenerate,
  onQuota,
}: {
  viewer: Viewer;
  ai: boolean;
  quota: Quota;
  busy: boolean;
  onGenerate: (request: BuilderRequest) => void;
  onQuota: (quota: Quota) => void;
}) {
  const [grade, setGrade] = useState<CurriculumGrade>(viewer.role === "student" ? viewer.grade : 9);
  const [lessonId, setLessonId] = useState(() => firstLesson(viewer.role === "student" ? viewer.grade : 9));
  const [kindId, setKindId] = useState<string | null>(null);
  const [style, setStyle] = useState<ExerciseStyle>("basic");
  const [contexts, setContexts] = useState<string[]>([]);
  const [level, setLevel] = useState<LevelChoice>("mixed");
  const [count, setCount] = useState(5);
  const [note, setNote] = useState("");
  const [lists, setLists] = useState<Record<string, KindList>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [kindsError, setKindsError] = useState("");
  const [editing, setEditing] = useState(false);

  // Last choices come back on the next visit (per device).
  useEffect(() => {
    const saved = remembered();
    const lesson = saved.lessonId ? findCurriculumLesson(saved.lessonId) : null;
    if (lesson) {
      setGrade(lesson.lesson.grade);
      setLessonId(lesson.lesson.id);
    }
    if (saved.style === "basic" || saved.style === "real") setStyle(saved.style);
    if (LEVEL_CHOICES.some((choice) => choice.id === saved.level)) setLevel(saved.level!);
    if (COUNTS.includes(saved.count as (typeof COUNTS)[number])) setCount(saved.count!);
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ grade, lessonId, style, level, count } satisfies Remembered));
    } catch {
      // No storage: choices just aren't remembered.
    }
  }, [grade, lessonId, style, level, count]);

  const loadKinds = async (lesson: string, refresh: boolean) => {
    setLoading(lesson);
    setKindsError("");
    const result = await postExercises<KindList & { quota?: Quota }>({ action: "kinds", lessonId: lesson, refresh });
    setLoading((current) => (current === lesson ? null : current));
    if (!result.ok) return setKindsError(result.error);
    setLists((current) => ({ ...current, [lesson]: { kinds: result.data.kinds, hidden: result.data.hidden } }));
    if (result.data.quota) onQuota(result.data.quota);
  };
  useEffect(() => {
    if (ai && !lists[lessonId]) loadKinds(lessonId, false);
    // Only when the lesson changes; a failed load is retried with the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, ai]);

  const chapters = CURRICULUM.filter((chapter) => chapter.grade === grade);
  const found = findCurriculumLesson(lessonId);
  const list = lists[lessonId];
  const mix = kindId === MIX_KIND;
  const kinds = useMemo(() => list?.kinds ?? [], [list]);
  const picked = useMemo(() => (mix ? kinds : kinds.filter((kind) => kind.id === kindId)), [kinds, kindId, mix]);
  const canReal = picked.some((kind) => kind.real);
  const contextChoices = useMemo(() => [...new Set(picked.filter((kind) => kind.real).flatMap((kind) => kind.contexts))].slice(0, 20), [picked]);
  const effectiveStyle: ExerciseStyle = canReal ? style : "basic";

  // A choice that no longer exists falls back.
  useEffect(() => {
    if (kindId && kindId !== MIX_KIND && list && !list.kinds.some((kind) => kind.id === kindId)) setKindId(null);
  }, [list, kindId]);
  useEffect(() => {
    setContexts((current) => (current.every((context) => contextChoices.includes(context)) ? current : current.filter((context) => contextChoices.includes(context))));
  }, [contextChoices]);

  const pickGrade = (next: CurriculumGrade) => {
    setGrade(next);
    setLessonId(firstLesson(next));
    setKindId(null);
  };
  const pickChapter = (number: number) => {
    setLessonId(chapters.find((chapter) => chapter.number === number)!.lessons[0].id);
    setKindId(null);
  };
  const pickLesson = (id: string) => {
    setLessonId(id);
    setKindId(null);
  };

  const hideKind = async (id: string) => {
    const result = await postExercises<KindList>({ action: "hide_kind", lessonId, kindId: id });
    if (result.ok) setLists((current) => ({ ...current, [lessonId]: result.data }));
    if (kindId === id) setKindId(null);
  };
  const unhideKinds = async () => {
    const result = await postExercises<KindList>({ action: "unhide_kinds", lessonId });
    if (result.ok) setLists((current) => ({ ...current, [lessonId]: result.data }));
  };

  const ready = ai && Boolean(kindId) && kinds.length > 0 && !busy && quota.left > 0;
  const tutor = viewer.role === "tutor";

  return (
    <section className="mt-6 rounded-3xl border border-cream-200 bg-white p-4 shadow-sm sm:p-6">
      {!ai && (
        <p className="mb-4 rounded-xl bg-gold-100 px-3 py-2 text-sm font-semibold text-gold-600">
          Server chưa cấu hình AI nên chưa soạn được đề. {tutor ? "Thêm AI_ROUTER_API_KEY và AI_ROUTER_BASE_URL vào biến môi trường." : "Nhắn thầy/cô nhé."}
        </p>
      )}

      <Step n={1} title="Lớp">
        <div className="flex gap-2">
          {([8, 9] as const).map((item) => (
            <Chip key={item} active={grade === item} onClick={() => pickGrade(item)} big>
              Lớp {item}
            </Chip>
          ))}
        </div>
      </Step>

      <Step n={2} title="Chương & bài">
        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={found?.chapter.number ?? 1} onChange={(value) => pickChapter(Number(value))} label="Chương">
            {chapters.map((chapter) => (
              <option key={chapter.number} value={chapter.number}>
                Chương {chapter.roman}. {chapter.title}
              </option>
            ))}
          </Select>
          <Select value={lessonId} onChange={pickLesson} label="Bài">
            {(found?.chapter.lessons ?? []).map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                Bài {lesson.number}. {lesson.title}
              </option>
            ))}
          </Select>
        </div>
      </Step>

      <Step
        n={3}
        title="Dạng bài"
        aside={
          tutor && list ? (
            <span className="flex gap-1">
              <button onClick={() => setEditing((value) => !value)} className="rounded-lg px-2 py-1 text-xs font-bold text-ink/50 hover:bg-cream-50 hover:text-ink">
                {editing ? "✓ Xong" : "✏️ Ẩn bớt"}
              </button>
              <button
                onClick={() => window.confirm("AI sẽ liệt kê lại các dạng của bài này (tốn 1 lượt). Danh sách cũ sẽ bị thay.") && loadKinds(lessonId, true)}
                disabled={loading === lessonId}
                className="rounded-lg px-2 py-1 text-xs font-bold text-ink/50 hover:bg-cream-50 hover:text-ink disabled:opacity-40"
              >
                🔄 Gợi ý lại
              </button>
            </span>
          ) : null
        }
      >
        {loading === lessonId ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-clay-600">✨ AI đang liệt kê các dạng của bài này… (chỉ lần đầu, vài giây)</p>
            <div className="flex flex-wrap gap-2">
              {[120, 160, 100, 180, 140].map((width) => (
                <span key={width} className="h-9 animate-pulse rounded-full bg-cream-100" style={{ width }} />
              ))}
            </div>
          </div>
        ) : kindsError && !list ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            <span className="font-semibold">{kindsError}</span>
            {ai && (
              <button onClick={() => loadKinds(lessonId, false)} className="rounded-lg bg-white px-2.5 py-1 font-bold shadow-sm">
                Thử lại
              </button>
            )}
          </div>
        ) : list ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {kinds.map((kind) => (
                <KindOption
                  key={kind.id}
                  active={!editing && kindId === kind.id}
                  onClick={() => (editing ? hideKind(kind.id) : setKindId(kind.id))}
                  title={kind.label}
                  detail={kind.hint}
                  mark={editing ? "✕" : kind.real ? "🌏" : null}
                  removing={editing}
                />
              ))}
              {!editing && kinds.length > 1 && (
                <KindOption active={mix} onClick={() => setKindId(MIX_KIND)} title="🎲 Trộn các dạng" detail="Mỗi câu một dạng khác nhau — hợp để ôn cả bài." mark={null} />
              )}
            </div>
            {editing && (
              <p className="mt-2 text-xs text-ink/50">
                Bấm vào dạng để ẩn khỏi danh sách.{" "}
                {list.hidden > 0 && (
                  <button onClick={unhideKinds} className="font-bold text-clay-600 underline">
                    Hiện lại {list.hidden} dạng đã ẩn
                  </button>
                )}
              </p>
            )}
            {!editing && !kindId && <p className="mt-2 text-xs text-ink/45">🌏 = có bài toán thực tế. Chọn một dạng để tiếp tục.</p>}
          </>
        ) : null}
      </Step>

      {kindId && (
        <>
          <Step n={4} title="Kiểu bài">
            <div className="flex flex-wrap gap-2">
              <Chip active={effectiveStyle === "basic"} onClick={() => setStyle("basic")} big>
                📘 Cơ bản
              </Chip>
              <Chip active={effectiveStyle === "real"} onClick={() => setStyle("real")} disabled={!canReal} big>
                🌏 Bài toán thực tế
              </Chip>
            </div>
            {!canReal && <p className="mt-2 text-xs text-ink/45">Dạng này không có bài toán thực tế.</p>}
            {effectiveStyle === "real" && contextChoices.length > 0 && (
              <div className="mt-3 rounded-2xl bg-cream-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-ink/50">Bối cảnh · chọn một hay nhiều</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip active={contexts.length === 0} onClick={() => setContexts([])} small>
                    🎲 AI tự chọn
                  </Chip>
                  {contextChoices.map((context) => (
                    <Chip
                      key={context}
                      active={contexts.includes(context)}
                      onClick={() => setContexts((current) => (current.includes(context) ? current.filter((item) => item !== context) : [...current, context]))}
                      small
                    >
                      {context}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </Step>

          <Step n={5} title="Mức độ">
            <div className="flex flex-wrap gap-2">
              {LEVEL_CHOICES.map((choice) => (
                <Chip key={choice.id} active={level === choice.id} onClick={() => setLevel(choice.id)}>
                  {choice.label}
                </Chip>
              ))}
            </div>
          </Step>

          <Step n={6} title="Số câu">
            <div className="flex flex-wrap gap-2">
              {COUNTS.map((item) => (
                <Chip key={item} active={count === item} onClick={() => setCount(item)} big>
                  {item}
                </Chip>
              ))}
            </div>
          </Step>

          <details className="group mt-5 rounded-2xl border border-dashed border-cream-200 px-3 py-2" open={note.length > 0 || undefined}>
            <summary className="cursor-pointer list-none text-sm font-semibold text-ink/60 [&::-webkit-details-marker]:hidden">
              <span className="mr-1 inline-block transition group-open:rotate-90">▸</span> 📝 Ghi chú thêm cho AI <span className="font-normal text-ink/40">(không bắt buộc)</span>
            </summary>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
              maxLength={NOTE_MAX}
              placeholder="VD: số liệu đẹp · giống đề thi vào 10 · có ý a, b"
              className="mt-2 w-full rounded-xl border border-cream-200 px-3 py-2 text-sm outline-none focus:border-clay-500"
            />
            <p className="mt-1 flex justify-between gap-2 text-xs text-ink/45">
              <span>Chỉ ghi về bài tập — nội dung khác AI sẽ bỏ qua.</span>
              <span>
                {note.length}/{NOTE_MAX}
              </span>
            </p>
          </details>
        </>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-6 rounded-b-3xl border-t border-cream-100 bg-white/95 px-4 pb-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:p-0">
        <button
          onClick={() => kindId && onGenerate({ lessonId, kindId, style: effectiveStyle, contexts: effectiveStyle === "real" ? contexts : [], level, count, note: note.trim() })}
          disabled={!ready}
          className="w-full rounded-2xl bg-clay-500 py-3.5 font-draw-display text-lg font-extrabold text-white shadow-lg shadow-clay-500/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? "AI đang soạn…" : `✨ Soạn ${count} câu`}
        </button>
        <p className="mt-1.5 text-center text-xs text-ink/50">
          {quota.left > 0 ? `Còn ${quota.left}/${quota.limit} lượt AI hôm nay` : "Hôm nay đã hết lượt AI — mai quay lại nhé!"}
        </p>
      </div>
    </section>
  );
}

function KindOption({
  active,
  onClick,
  title,
  detail,
  mark,
  removing,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail: string;
  mark: string | null;
  removing?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-start gap-2.5 rounded-2xl border-2 px-3 py-2.5 text-left transition ${
        active ? "border-clay-500 bg-clay-500/10" : removing ? "border-dashed border-red-200 bg-white hover:border-red-400" : "border-cream-200 bg-white hover:border-clay-500/60"
      }`}
    >
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-clay-500 bg-clay-500" : "border-cream-200"}`}>
        {active && <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-snug">{title}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-ink/55">{detail}</span>
      </span>
      {mark && <span className={`shrink-0 text-sm ${removing ? "font-bold text-red-500" : ""}`}>{mark}</span>}
    </button>
  );
}

function Step({ n, title, aside, children }: { n: number; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-cream-50">{n}</span>
        <h3 className="font-draw-display font-extrabold">{title}</h3>
        {aside && <span className="ml-auto">{aside}</span>}
      </div>
      {children}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  disabled,
  title,
  big,
  small,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  big?: boolean;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`rounded-full border-2 text-left font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${
        big ? "px-4 py-2" : small ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm"
      } ${active ? "border-clay-500 bg-clay-500 text-white shadow-sm" : "border-cream-200 bg-white text-ink/80 hover:border-clay-500/60"}`}
    >
      {children}
    </button>
  );
}

function Select({ value, onChange, label, children }: { value: string | number; onChange: (value: string) => void; label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full truncate rounded-xl border-2 border-cream-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-clay-500"
      >
        {children}
      </select>
    </label>
  );
}
