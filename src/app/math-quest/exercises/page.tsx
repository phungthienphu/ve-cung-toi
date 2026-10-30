"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HOME_CRUMB, MATH_QUEST_CRUMB, Paper, TUTOR_CRUMB, TopBar, TutorLogin, TutorTabs, logout } from "@/components/mathquest/shared";
import { Builder, type BuilderRequest } from "@/components/mathquest/exercises/Builder";
import { ExerciseCard, PrintMenu, SetCard, UnlockDialog, lessonGrade, lessonName, type PrintMode, type ReviseStage } from "@/components/mathquest/exercises/ExerciseCards";
import { PrintSheet, type PrintJob } from "@/components/mathquest/exercises/PrintSheet";
import { postExercises, streamGenerate } from "@/components/mathquest/exercises/api";
import type { ExerciseAnswer, ExerciseChange, ExerciseSetView, ExerciseView, GenerateStage, LibraryItem, Quota, Viewer } from "@/lib/mathQuest/exerciseTypes";

// "Xưởng đề AI" (docs/xuong-de-ai-spec.md): pick a lesson and a problem type,
// the AI writes fresh exercises, the machine checks the answers. Students
// and the tutor both use it; answers only open with the tutor's password,
// typed on this page (kept in memory, so a reload locks them again).

interface PageData {
  viewer: Viewer;
  ai: boolean;
  quota: Quota;
  sets: ExerciseSetView[];
  library: LibraryItem[];
}

type Tab = "make" | "recent" | "library";
interface Generating {
  done: number;
  total: number;
  stage: GenerateStage | null;
  startedAt: number;
}

const ANSWER_BATCH = 300;

export default function ExercisesPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [state, setState] = useState<"loading" | "login" | "tutor-login" | "ready">("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("make");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [openRecent, setOpenRecent] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Generating | null>(null);
  const [generateError, setGenerateError] = useState<{ error: string; request: BuilderRequest } | null>(null);
  const [revising, setRevising] = useState<Record<string, ReviseStage>>({});
  const [key, setKey] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [answers, setAnswers] = useState<Record<string, ExerciseAnswer>>({});
  const [unlocking, setUnlocking] = useState<{ then?: (key: string) => void } | null>(null);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const abort = useRef<AbortController | null>(null);
  const requested = useRef(new Set<string>());
  const results = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/math-quest/exercises", { cache: "no-store" }).catch(() => null);
    if (!res) {
      setError("Không kết nối được máy chủ.");
      return setState("login");
    }
    if (res.status === 401) return setState("login");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((body as { error?: string }).error ?? "Không tải được dữ liệu.");
      return setState("login");
    }
    setData(body as PageData);
    setState("ready");
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const flash = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // ─── Answers: only with the key the tutor's password unlocked ──────────

  const lock = useCallback(
    (message?: string) => {
      setKey(null);
      setShowAnswers(false);
      setAnswers({});
      requested.current.clear();
      if (message) flash(message);
    },
    [flash],
  );
  useEffect(() => {
    if (!key) return;
    const timer = window.setTimeout(() => lock("Đã khoá lại đáp án sau 30 phút."), Math.max(0, Number(key.split(".")[0]) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [key, lock]);

  /** Fetches answers; returns them (or null when refused). */
  const fetchAnswers = useCallback(
    async (ids: string[], withKey: string): Promise<Record<string, ExerciseAnswer> | null> => {
      const fetched: Record<string, ExerciseAnswer> = {};
      for (let start = 0; start < ids.length; start += ANSWER_BATCH) {
        const result = await postExercises<{ answers: ExerciseAnswer[] }>({ action: "answers", key: withKey, ids: ids.slice(start, start + ANSWER_BATCH) });
        if (!result.ok) {
          if (result.locked) lock("Hết hạn mở khoá — nhập lại mật khẩu nhé.");
          else flash(result.error);
          return null;
        }
        for (const answer of result.data.answers) fetched[answer.id] = answer;
      }
      setAnswers((current) => ({ ...current, ...fetched }));
      return fetched;
    },
    [flash, lock],
  );

  const visibleIds = useMemo(() => (data ? [...data.sets.flatMap((set) => set.exercises.map((exercise) => exercise.id)), ...data.library.map((item) => item.id)] : []), [data]);
  useEffect(() => {
    if (!key || !showAnswers) return;
    const missing = [...new Set(visibleIds)].filter((id) => !requested.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.add(id));
    fetchAnswers(missing, key).then((fetched) => {
      if (!fetched) missing.forEach((id) => requested.current.delete(id));
    });
  }, [key, showAnswers, visibleIds, fetchAnswers]);

  /** Runs `then` with a valid key, asking for the password first if needed. */
  const requireKey = (then?: (key: string) => void) => {
    if (key) then?.(key);
    else setUnlocking({ then });
  };

  // ─── AI: generate a set, rewrite one exercise ──────────────────────────

  const generate = async (request: BuilderRequest) => {
    if (generating) return;
    const controller = new AbortController();
    abort.current = controller;
    setGenerateError(null);
    setCurrentId(null);
    setGenerating({ done: 0, total: request.count, stage: null, startedAt: Date.now() });
    window.setTimeout(() => results.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    await streamGenerate(
      { action: "generate", ...request },
      (event) => {
        if (event.type === "progress") setGenerating((current) => current && { ...current, done: event.done, total: event.total });
        else if (event.type === "stage") setGenerating((current) => current && { ...current, stage: event.stage });
        else if (event.type === "set") {
          setData((current) => current && { ...current, sets: [event.set, ...current.sets], quota: event.quota });
          setCurrentId(event.set.id);
        } else if (event.type === "error") setGenerateError({ error: event.error, request });
      },
      controller.signal,
    );
    if (abort.current === controller) abort.current = null;
    setGenerating(null);
  };
  const cancel = () => {
    abort.current?.abort();
    abort.current = null;
    setGenerating(null);
  };

  const patchExercise = (id: string, next: ExerciseView) =>
    setData(
      (current) =>
        current && {
          ...current,
          sets: current.sets.map((set) => (set.exercises.some((exercise) => exercise.id === id) ? { ...set, exercises: set.exercises.map((exercise) => (exercise.id === id ? next : exercise)) } : set)),
          library: current.library.map((item) => (item.id === id ? { ...item, ...next } : item)),
        },
    );

  const revise = async (exerciseId: string, change: ExerciseChange) => {
    if (revising[exerciseId]) return;
    setRevising((current) => ({ ...current, [exerciseId]: "writing" }));
    await streamGenerate(
      { action: "revise", exerciseId, change },
      (event) => {
        if (event.type === "stage") setRevising((current) => ({ ...current, [exerciseId]: event.stage }));
        else if (event.type === "exercise") {
          patchExercise(exerciseId, event.exercise);
          setData((current) => current && { ...current, quota: event.quota });
        } else if (event.type === "error") flash(event.error);
      },
      new AbortController().signal,
    );
    setRevising((current) => {
      const next = { ...current };
      delete next[exerciseId];
      return next;
    });
  };

  // ─── Library, edits, deleting ───────────────────────────────────────────

  const save = async (exercise: ExerciseView, saved: boolean) => {
    patchExercise(exercise.id, { ...exercise, saved });
    const result = await postExercises({ action: "save", exerciseId: exercise.id, saved });
    if (!result.ok) flash(result.error);
    else flash(saved ? "★ Đã lưu vào kho đề" : "Đã bỏ khỏi kho đề");
    load();
  };

  const edit = async (exerciseId: string, fields: { statement: string; answer: string; solution: string[] }) => {
    if (!key) return false;
    const result = await postExercises<{ exercise: ExerciseView; answer: ExerciseAnswer }>({ action: "edit", key, exerciseId, ...fields });
    if (!result.ok) {
      if (result.locked) lock("Hết hạn mở khoá — nhập lại mật khẩu nhé.");
      else flash(result.error);
      return false;
    }
    patchExercise(exerciseId, result.data.exercise);
    setAnswers((current) => ({ ...current, [exerciseId]: result.data.answer }));
    return true;
  };

  const removeSet = async (set: ExerciseSetView) => {
    const saved = set.exercises.filter((exercise) => exercise.saved).length;
    if (!window.confirm(saved ? `Xoá bộ đề này? ${saved} câu đã lưu kho cũng bị xoá theo.` : "Xoá bộ đề này?")) return;
    const result = await postExercises({ action: "delete_set", setId: set.id });
    if (!result.ok) return flash(result.error);
    setData((current) => current && { ...current, sets: current.sets.filter((item) => item.id !== set.id), library: current.library.filter((item) => item.setId !== set.id) });
    if (currentId === set.id) setCurrentId(null);
  };

  // ─── Printing ───────────────────────────────────────────────────────────

  const print = (title: string, subtitle: string, items: ExerciseView[], mode: PrintMode) => {
    const run = (known: Record<string, ExerciseAnswer>) => setPrintJob({ mode, title, subtitle, items: items.map((item) => ({ statement: item.statement, answer: known[item.id] })) });
    if (mode === "sheet") return run({});
    requireKey(async (withKey) => {
      const missing = items.filter((item) => !answers[item.id]).map((item) => item.id);
      const fetched = missing.length ? await fetchAnswers(missing, withKey) : {};
      if (fetched) run({ ...answers, ...fetched });
    });
  };
  useEffect(() => {
    if (!printJob) return;
    const done = () => setPrintJob(null);
    window.addEventListener("afterprint", done);
    // Let KaTeX lay out before the print dialog snapshots the page.
    const timer = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", done);
    };
  }, [printJob]);

  const printSet = (set: ExerciseSetView, mode: PrintMode) => {
    const grade = lessonGrade(set.lessonId);
    print(`Phiếu bài tập Toán ${grade ?? ""}`.trim(), `${lessonName(set.lessonId)} — ${set.kindLabel}`, set.exercises, mode);
  };

  // ─── Screens ────────────────────────────────────────────────────────────

  if (state === "loading") {
    return (
      <Paper>
        <p className="py-24 text-center text-ink/50">Đang mở Xưởng đề…</p>
      </Paper>
    );
  }
  if (state === "tutor-login") return <TutorLogin error="" onDone={load} />;
  if (state === "login" || !data) {
    return (
      <Paper>
        <TopBar back={{ href: "/math-quest", label: "Math Quest" }} trail={[HOME_CRUMB, MATH_QUEST_CRUMB, { label: "Xưởng đề AI" }]} />
        <section className="mx-auto mt-6 max-w-sm rounded-3xl border border-cream-200 bg-white p-6 text-center shadow-sm">
          <div className="text-5xl">✨</div>
          <h1 className="mt-2 font-draw-display text-3xl font-extrabold">Xưởng đề AI</h1>
          <p className="mt-2 text-sm text-ink/60">Chọn bài, AI soạn ngay đề mới để luyện. Đăng nhập để bắt đầu.</p>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}
          <Link href="/math-quest" className="mt-5 block rounded-xl bg-clay-500 py-3 font-bold text-white">
            📒 Học sinh: đăng nhập ở Sổ tay
          </Link>
          <button onClick={() => setState("tutor-login")} className="mt-2 w-full rounded-xl border-2 border-cream-200 py-2.5 font-bold text-ink/70">
            🧑‍🏫 Gia sư đăng nhập
          </button>
        </section>
      </Paper>
    );
  }

  const { viewer } = data;
  const tutor = viewer.role === "tutor";
  const current = data.sets.find((set) => set.id === currentId) ?? null;
  const answersOpen = Boolean(key) && showAnswers;

  const answerTools = key ? (
    <button onClick={() => setShowAnswers((value) => !value)} className="rounded-xl bg-cream-50/15 px-3 py-1.5 text-sm font-bold text-cream-50 transition hover:bg-cream-50/25">
      {showAnswers ? "🙈 Ẩn đáp án" : "👁 Hiện đáp án"}
    </button>
  ) : (
    <button onClick={() => requireKey(() => setShowAnswers(true))} className="rounded-xl bg-gold-500 px-3 py-1.5 text-sm font-bold text-white shadow-sm transition hover:brightness-105">
      🔒 Xem đáp án
    </button>
  );

  const cards = (exercises: ExerciseView[], style: ExerciseSetView["style"], selection?: (id: string) => { selected: boolean; onToggle: () => void }) =>
    exercises.map((exercise, index) => (
      <ExerciseCard
        key={exercise.id}
        exercise={exercise}
        number={index + 1}
        style={style}
        answer={answers[exercise.id]}
        showAnswer={answersOpen}
        revising={revising[exercise.id] ?? null}
        selection={selection?.(exercise.id)}
        actions={{
          onRevise: data.ai && !selection ? (change) => revise(exercise.id, change) : undefined,
          onSave: tutor ? (saved) => save(exercise, saved) : undefined,
          onEdit: tutor && key ? (fields) => edit(exercise.id, fields) : undefined,
        }}
      />
    ));

  const setCard = (set: ExerciseSetView) => (
    <SetCard key={set.id} set={set} showOwner={tutor && set.ownerName !== viewer.name} answerTools={answerTools} onPrint={(mode) => printSet(set, mode)} onDelete={() => removeSet(set)}>
      {cards(set.exercises, set.style)}
    </SetCard>
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "make", label: "✨ Soạn đề" },
    { id: "recent", label: `🕘 Gần đây${data.sets.length ? ` (${data.sets.length})` : ""}` },
    ...(tutor ? [{ id: "library" as const, label: `📦 Kho đề${data.library.length ? ` (${data.library.length})` : ""}` }] : []),
  ];

  return (
    <>
      <div className="print:hidden">
        <Paper>
          <TopBar
            back={tutor ? { href: "/math-quest/tutor", label: "Trang gia sư" } : { href: "/math-quest", label: "Sổ tay" }}
            trail={tutor ? [HOME_CRUMB, MATH_QUEST_CRUMB, TUTOR_CRUMB, { label: "Xưởng đề AI" }] : [HOME_CRUMB, MATH_QUEST_CRUMB, { label: "Xưởng đề AI" }]}
            right={
              <>
                {!tutor && <span className="min-w-0 truncate rounded-full bg-ink/10 px-3 py-1 text-sm font-bold">{viewer.name}</span>}
                <button
                  onClick={async () => {
                    await logout();
                    lock();
                    setState("login");
                  }}
                  className="shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-sm font-semibold text-ink/50 hover:text-ink"
                >
                  Đăng xuất
                </button>
              </>
            }
          />
          <header>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-clay-600">{tutor ? "🧑‍🏫 Trang gia sư" : "✨ Xưởng đề AI"}</p>
            <h1 className="mt-1 font-draw-display text-2xl font-extrabold sm:text-3xl">{tutor ? "Xưởng đề AI" : "Luyện đề với AI"}</h1>
            <p className="mt-1 text-sm text-ink/60">Chọn bài và dạng — AI soạn đề mới, máy tự kiểm đáp án. Đáp án chỉ mở bằng mật khẩu thầy/cô.</p>
          </header>
          {tutor && <TutorTabs active="exercises" />}

          <div className="mt-5 flex gap-1 rounded-xl bg-ink/5 p-1" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-sm font-bold transition ${tab === item.id ? "bg-white text-ink shadow-sm" : "text-ink/55 hover:text-ink"}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "make" && (
            <>
              <Builder viewer={viewer} ai={data.ai} quota={data.quota} busy={Boolean(generating)} onGenerate={generate} onQuota={(quota) => setData((value) => value && { ...value, quota })} />
              <div ref={results} className="scroll-mt-20">
                {generating && <Progress progress={generating} onCancel={cancel} />}
                {!generating && generateError && (
                  <section className="mt-6 rounded-3xl border-2 border-red-200 bg-red-50 p-5 text-center">
                    <div className="text-4xl">😵</div>
                    <p className="mt-2 font-bold text-red-700">{generateError.error}</p>
                    <button onClick={() => generate(generateError.request)} className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-bold text-red-700 shadow-sm">
                      Thử lại
                    </button>
                  </section>
                )}
                {!generating && current && setCard(current)}
              </div>
            </>
          )}

          {tab === "recent" &&
            (data.sets.length === 0 ? (
              <Empty icon="🕘" title="Chưa có bộ đề nào" detail="Đề soạn xong sẽ được giữ ở đây để xem lại và in." />
            ) : (
              <div className="mt-4 space-y-2">
                {data.sets.map((set) =>
                  openRecent === set.id ? (
                    <div key={set.id}>
                      <button onClick={() => setOpenRecent(null)} className="mt-4 text-sm font-bold text-ink/50 hover:text-ink">
                        ▴ Thu gọn
                      </button>
                      {setCard(set)}
                    </div>
                  ) : (
                    <button
                      key={set.id}
                      onClick={() => setOpenRecent(set.id)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-cream-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-clay-500/60"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clay-500/10 font-draw-display font-extrabold text-clay-600">{set.exercises.length}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{lessonName(set.lessonId)}</span>
                        <span className="block truncate text-xs text-ink/50">
                          {tutor && set.ownerName !== viewer.name ? `${set.ownerName} · ` : ""}
                          {set.kindLabel} · {new Date(set.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                      <span className="shrink-0 text-ink/30">▸</span>
                    </button>
                  ),
                )}
              </div>
            ))}

          {tab === "library" && tutor && (
            <Library
              items={data.library}
              selected={selected}
              setSelected={setSelected}
              answerTools={answerTools}
              onPrint={(items, mode) => {
                const lessons = [...new Set(items.map((item) => item.lessonId))];
                const grades = [...new Set(lessons.map(lessonGrade))];
                print(
                  `Phiếu bài tập Toán ${grades.length === 1 ? (grades[0] ?? "") : ""}`.trim(),
                  lessons.length === 1 ? lessonName(lessons[0]) : "Tổng hợp từ kho đề",
                  items,
                  mode,
                );
              }}
              renderCards={(items) => cards(items, "basic", (id) => ({ selected: selected.includes(id), onToggle: () => setSelected((value) => (value.includes(id) ? value.filter((item) => item !== id) : [...value, id])) }))}
            />
          )}
        </Paper>
      </div>

      {printJob && <PrintSheet job={printJob} />}
      {unlocking && (
        <UnlockDialog
          onClose={() => setUnlocking(null)}
          onUnlocked={(newKey) => {
            const then = unlocking.then;
            setKey(newKey);
            setShowAnswers(true);
            setUnlocking(null);
            then?.(newKey);
          }}
        />
      )}
      {toast && (
        <div className="fixed inset-x-4 top-3 z-[60] mx-auto max-w-md rounded-xl bg-ink px-4 py-2.5 text-center text-sm font-semibold text-cream-50 shadow-xl print:hidden" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

function Progress({ progress, onCancel }: { progress: Generating; onCancel: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const { done, total, stage } = progress;
  const seconds = Math.max(0, Math.round((now - progress.startedAt) / 1000));
  const text =
    stage === "checking"
      ? "🔎 Máy đang kiểm đáp án…"
      : stage === "repairing"
        ? "🛠️ Có câu chưa khớp — AI đang sửa lại…"
        : done === 0
          ? "💭 AI đang nghĩ đề…"
          : `✍️ AI đang viết câu ${Math.min(done + 1, total)}/${total}…`;
  // Thinking gets a slow creep so the bar never looks stuck; then one step per exercise.
  const percent = stage ? 96 : done === 0 ? Math.min(25, 4 + seconds * 0.6) : 25 + (done / total) * 70;
  return (
    <section className="mt-6 rounded-3xl border-2 border-clay-500/25 bg-white p-5 text-center shadow-sm" aria-live="polite">
      <div className="text-4xl motion-safe:animate-bounce">{stage ? "🔎" : "✍️"}</div>
      <p className="mt-2 font-draw-display text-lg font-extrabold">{text}</p>
      <div className="mx-auto mt-3 h-2.5 max-w-sm overflow-hidden rounded-full bg-cream-100">
        <div className="h-full rounded-full bg-clay-500 transition-all duration-700" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-ink/50">{seconds} giây · thường mất 20–60 giây, cứ để trang mở nhé</p>
      <button onClick={onCancel} className="mt-2 rounded-lg px-3 py-1.5 text-sm font-bold text-ink/45 hover:text-ink">
        Huỷ
      </button>
    </section>
  );
}

function Empty({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <div className="mt-6 rounded-3xl border-2 border-dashed border-cream-200 bg-white/60 p-8 text-center">
      <div className="text-4xl">{icon}</div>
      <p className="mt-2 font-draw-display text-lg font-bold">{title}</p>
      <p className="mt-1 text-sm text-ink/55">{detail}</p>
    </div>
  );
}

/** The tutor's saved exercises, by lesson: tick some (or none for all) and print them as one sheet. */
function Library({
  items,
  selected,
  setSelected,
  answerTools,
  onPrint,
  renderCards,
}: {
  items: LibraryItem[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  answerTools: React.ReactNode;
  onPrint: (items: LibraryItem[], mode: PrintMode) => void;
  renderCards: (items: LibraryItem[]) => React.ReactNode;
}) {
  if (items.length === 0) return <Empty icon="📦" title="Kho đề còn trống" detail="Bấm “☆ Lưu vào kho” ở những câu bạn ưng ý — chúng sẽ được gom về đây theo bài." />;
  const lessons = [...new Set(items.map((item) => item.lessonId))];
  const chosen = items.filter((item) => selected.includes(item.id));
  const target = chosen.length ? chosen : items;
  return (
    <div>
      <div className="sticky top-14 z-20 mt-5 rounded-2xl bg-ink px-4 py-3 text-cream-50 shadow-md">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold">{chosen.length ? `Đã chọn ${chosen.length}/${items.length} câu` : `${items.length} câu trong kho`}</p>
          <button onClick={() => setSelected(chosen.length ? [] : items.map((item) => item.id))} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-cream-50/70 hover:text-cream-50">
            {chosen.length ? "Bỏ chọn" : "Chọn hết"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {answerTools}
          <PrintMenu onPrint={(mode) => onPrint(target, mode)} label={chosen.length ? `🖨️ In ${chosen.length} câu` : "🖨️ In tất cả"} />
        </div>
      </div>
      {lessons.map((lessonId) => (
        <section key={lessonId} className="mt-6">
          <h2 className="font-draw-display text-lg font-extrabold">
            <span className="mr-2 rounded-full bg-ink/10 px-2 py-0.5 text-xs">Lớp {lessonGrade(lessonId)}</span>
            {lessonName(lessonId)}
          </h2>
          <div className="mt-3 space-y-3">{renderCards(items.filter((item) => item.lessonId === lessonId))}</div>
        </section>
      ))}
    </div>
  );
}
