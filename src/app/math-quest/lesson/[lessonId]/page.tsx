"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { CHAPTERS, findLesson, type Lesson, type LessonExample } from "@shared/mathQuestLessons";
import { makeQuestion, type RevealedQuestion } from "@shared/mathBossTypes";
import { MathText } from "@/components/mathboss/MathText";
import { Loading, Paper, relativeDay, useMe } from "@/components/mathquest/shared";

const PRACTICE_ROUND = 5;
const LETTERS = ["A", "B", "C", "D"];

export default function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const lesson = findLesson(lessonId);
  const { me } = useMe();

  const isStudent = me?.role === "student";
  const progress = isStudent ? me.progress.find((entry) => entry.lessonId === lessonId) : undefined;
  const allowed = me?.role === "tutor" || (isStudent && Boolean(progress?.taughtAt) && me.approved.includes(lessonId));

  // Opening the page counts as a review ("ôn lần cuối").
  const opened = useRef(false);
  useEffect(() => {
    if (!isStudent || !allowed || opened.current) return;
    opened.current = true;
    fetch("/api/math-quest/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "open", lessonId }) });
  }, [isStudent, allowed, lessonId]);

  // "🎯 Luyện 5 câu" on the notebook links here with #practice; the page only
  // has content once the session has loaded, so scroll by hand.
  useEffect(() => {
    if (allowed && window.location.hash === "#practice") document.getElementById("practice")?.scrollIntoView({ behavior: "smooth" });
  }, [allowed]);

  if (!me) return <Loading />;
  if (!lesson || !allowed || me.role === null) {
    return (
      <Paper>
        <p className="py-20 text-center text-ink/60">
          {!lesson ? "Không tìm thấy bài này." : me.role === null ? "Bạn cần đăng nhập để xem bài." : "Bài này chưa mở cho bạn."}
        </p>
        <Link href="/math-quest" className="block text-center font-semibold text-clay-600">← Về sổ tay</Link>
      </Paper>
    );
  }

  const chapter = CHAPTERS.find((candidate) => candidate.grade === lesson.grade && candidate.number === lesson.chapter);
  const approved = me.approved.includes(lesson.id);
  // The next lesson this viewer can open, in book order.
  const reachable = CHAPTERS.filter((candidate) => candidate.grade === lesson.grade)
    .flatMap((candidate) => candidate.lessons)
    .filter((candidate) => me.role === "tutor" || (me.approved.includes(candidate.id) && me.progress.some((entry) => entry.lessonId === candidate.id && entry.taughtAt)));
  const nextLesson = reachable[reachable.findIndex((candidate) => candidate.id === lesson.id) + 1] ?? null;
  const sections = [
    { id: "remember", label: "📌 Cần nhớ" },
    { id: "examples", label: "✍️ Ví dụ" },
    ...(lesson.mistakes.length ? [{ id: "mistakes", label: "⚠️ Lỗi hay gặp" }] : []),
    ...(lesson.practice.length ? [{ id: "practice", label: "🎯 Luyện nhanh" }] : []),
  ];

  return (
    <Paper>
      <Link href="/math-quest" className="text-sm font-semibold text-clay-600">← Sổ tay</Link>
      {me.role === "tutor" && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${approved ? "bg-sage-100 text-sage-600" : "bg-gold-100 text-gold-600"}`}>
          Xem trước · {approved ? "Bài đã duyệt, học sinh xem được khi đã học." : "Bài chưa duyệt — học sinh chưa thấy bài này."}
        </p>
      )}

      <header className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-clay-600">
          Lớp {lesson.grade} · Chương {chapter?.roman} · Bài {lesson.number}
        </p>
        <h1 className="mt-1 font-draw-display text-3xl font-extrabold leading-tight">{lesson.title}</h1>
        <p className="mt-2 text-ink/70">{lesson.summary}</p>
        {progress?.taughtAt && (
          <p className="mt-2 text-sm text-ink/50">
            Đã học trên lớp {relativeDay(progress.taughtAt)}
            {progress.practiceTotal > 0 && ` · Đã luyện đúng ${progress.practiceCorrect}/${progress.practiceTotal} câu`}
          </p>
        )}
        <nav className="mt-4 flex flex-wrap gap-2">
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="rounded-full border border-cream-200 bg-white px-3 py-1.5 text-sm font-semibold text-ink/70 transition hover:border-clay-500 hover:text-clay-600">
              {section.label}
            </a>
          ))}
        </nav>
      </header>

      <Section id="remember" icon="📌" title="Cần nhớ">
        <div className="space-y-3">
          {lesson.remember.map((point) => (
            <div key={point.text} className="rounded-xl border border-cream-200 bg-white p-4">
              {point.formula && (
                <p className="rounded-lg bg-gold-100/60 px-3 py-2 font-mono text-xl font-bold text-ink"><MathText text={point.formula} /></p>
              )}
              <p className={`${point.formula ? "mt-2" : ""} text-ink/80`}>{point.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="examples" icon="✍️" title="Ví dụ mẫu" hint="Tự nghĩ trước, rồi mới bấm xem từng bước.">
        <div className="space-y-3">
          {lesson.examples.map((example, index) => (
            <Example key={example.prompt} example={example} index={index} />
          ))}
        </div>
      </Section>

      {lesson.mistakes.length > 0 && (
        <Section id="mistakes" icon="⚠️" title="Lỗi hay gặp">
          <div className="space-y-3">
            {lesson.mistakes.map((mistake) => (
              <div key={mistake.wrong} className="rounded-xl border border-cream-200 bg-white p-4">
                <p className="font-mono text-red-500 line-through decoration-2"><MathText text={mistake.wrong} /></p>
                <p className="mt-1 font-mono font-bold text-sage-600">✓ <MathText text={mistake.right} /></p>
                <p className="mt-2 text-sm text-ink/70">{mistake.why}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {lesson.practice.length > 0 && (
        <Section id="practice" icon="🎯" title="Luyện nhanh" hint={`${PRACTICE_ROUND} câu, làm xong mới tính điểm.`}>
          <Practice lesson={lesson} record={isStudent} nextLesson={nextLesson} />
        </Section>
      )}

      {/* Always one tap from the next thing to do. pr-28 on phones keeps the
          buttons clear of the site's floating sound toggles. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cream-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5 pr-28 sm:px-6 md:pr-6">
          {lesson.practice.length > 0 && (
            <a href="#practice" className="rounded-xl bg-clay-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-clay-500/30">
              🎯 Luyện 5 câu
            </a>
          )}
          {nextLesson ? (
            <Link href={`/math-quest/lesson/${nextLesson.id}`} className="rounded-xl border-2 border-clay-500 px-4 py-2 text-sm font-bold text-clay-600">
              Bài {nextLesson.number} ▸
            </Link>
          ) : (
            <Link href="/math-quest" className="rounded-xl border-2 border-cream-200 px-4 py-2 text-sm font-bold text-ink/60">
              Về sổ tay
            </Link>
          )}
        </div>
      </div>
    </Paper>
  );
}

function Section({ id, icon, title, hint, children }: { id: string; icon: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-8 scroll-mt-6">
      <h2 className="font-draw-display text-xl font-bold">
        {icon} {title}
      </h2>
      {hint && <p className="text-sm text-ink/50">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Example({ example, index }: { example: LessonExample; index: number }) {
  const [shown, setShown] = useState(0);
  const done = shown >= example.steps.length;
  return (
    <div className="rounded-xl border border-cream-200 bg-white p-4">
      <p className="font-semibold">
        <span className="mr-2 text-clay-600">Ví dụ {index + 1}.</span>
        <MathText text={example.prompt} />
      </p>
      {shown > 0 && (
        <ol className="mt-3 space-y-1.5 border-l-4 border-clay-500/40 pl-4 font-mono">
          {example.steps.slice(0, shown).map((step) => (
            <li key={step} className="animate-bounce-in"><MathText text={step} /></li>
          ))}
        </ol>
      )}
      {!done && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => setShown((count) => count + 1)} className="rounded-lg bg-clay-500 px-3 py-1.5 text-sm font-semibold text-white">
            {shown === 0 ? "Xem bước đầu ▸" : "Bước tiếp theo ▸"}
          </button>
          <button onClick={() => setShown(example.steps.length)} className="rounded-lg border border-cream-200 px-3 py-1.5 text-sm text-ink/60">
            Xem hết
          </button>
        </div>
      )}
    </div>
  );
}

// Five generated questions on this lesson's dạng. The result is saved for a
// student once the round is done; the tutor's preview saves nothing.
function Practice({ lesson, record, nextLesson }: { lesson: Lesson; record: boolean; nextLesson: Lesson | null }) {
  const next = (index: number): RevealedQuestion => makeQuestion(lesson.practice[index % lesson.practice.length], index, false, "");
  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState(() => next(0));
  const [given, setGiven] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const answer = (value: number) => {
    if (given !== null) return;
    setGiven(value);
    if (value === question.answer) setCorrect((count) => count + 1);
  };

  const advance = () => {
    if (index + 1 >= PRACTICE_ROUND) {
      setFinished(true);
      if (record) {
        fetch("/api/math-quest/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "practice", lessonId: lesson.id, correct, total: PRACTICE_ROUND }),
        });
      }
      return;
    }
    setIndex(index + 1);
    setQuestion(next(index + 1));
    setGiven(null);
    setTyped("");
  };

  const restart = () => {
    setIndex(0);
    setQuestion(next(0));
    setGiven(null);
    setTyped("");
    setCorrect(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <div className="rounded-xl border border-cream-200 bg-white p-6 text-center">
        <div className="text-5xl">{correct === PRACTICE_ROUND ? "🏆" : correct >= 3 ? "👍" : "💪"}</div>
        <p className="mt-2 font-draw-display text-2xl font-extrabold">Đúng {correct}/{PRACTICE_ROUND} câu</p>
        <p className="mt-1 text-sm text-ink/60">
          {correct === PRACTICE_ROUND ? "Tuyệt vời! Bài này bạn nắm chắc rồi." : "Xem lại phần Cần nhớ và Lỗi hay gặp rồi thử lại nhé."}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {correct < PRACTICE_ROUND ? (
            <a href="#remember" className="rounded-xl bg-clay-500 px-4 py-2.5 font-bold text-white">📌 Xem lại phần Cần nhớ</a>
          ) : nextLesson ? (
            <Link href={`/math-quest/lesson/${nextLesson.id}`} className="rounded-xl bg-clay-500 px-4 py-2.5 font-bold text-white">
              Sang Bài {nextLesson.number} ▸
            </Link>
          ) : (
            <Link href="/math-quest" className="rounded-xl bg-clay-500 px-4 py-2.5 font-bold text-white">Về sổ tay ▸</Link>
          )}
          <button onClick={restart} className="rounded-xl border-2 border-clay-500 px-4 py-2 font-bold text-clay-600">
            🔁 Luyện thêm {PRACTICE_ROUND} câu
          </button>
        </div>
      </div>
    );
  }

  const answered = given !== null;
  const right = given === question.answer;
  return (
    <div className="rounded-xl border border-cream-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-ink/40">Câu {index + 1}/{PRACTICE_ROUND}</p>
      <p className="mt-1 font-mono text-xl font-bold"><MathText text={question.prompt} /></p>

      {question.kind === "choice" ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {question.options.map((option, optionIndex) => {
            const state = !answered ? "idle" : optionIndex === question.answer ? "right" : optionIndex === given ? "wrong" : "idle";
            return (
              <button
                key={option}
                onClick={() => answer(optionIndex)}
                disabled={answered}
                className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left font-mono transition ${
                  state === "right" ? "border-sage-500 bg-sage-100" : state === "wrong" ? "border-red-400 bg-red-50" : "border-cream-200 hover:border-clay-500"
                }`}
              >
                <span className="font-draw-display font-black text-clay-600">{LETTERS[optionIndex]}</span>
                <MathText text={option} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            value={typed}
            inputMode="numeric"
            disabled={answered}
            onChange={(event) => setTyped(event.target.value.replace(/\D/g, "").slice(0, 7))}
            onKeyDown={(event) => event.key === "Enter" && typed && answer(Number(typed))}
            placeholder="Đáp số"
            className="min-w-0 flex-1 rounded-lg border-2 border-cream-200 px-3 py-2 font-mono text-lg outline-none focus:border-clay-500"
          />
          <button onClick={() => typed && answer(Number(typed))} disabled={answered || !typed} className="rounded-lg bg-clay-500 px-4 font-semibold text-white disabled:opacity-50">
            Kiểm tra
          </button>
        </div>
      )}

      {answered && (
        <div className={`mt-3 rounded-lg p-3 ${right ? "bg-sage-100" : "bg-cream-100"}`}>
          <p className={`font-bold ${right ? "text-sage-600" : "text-ink"}`}>
            {right ? "✓ Chính xác!" : <>Chưa đúng — đáp án: <span className="font-mono"><MathText text={question.answerText} /></span></>}
          </p>
          <ol className="mt-1 space-y-0.5 font-mono text-sm text-ink/70">
            {question.steps.map((step) => (
              <li key={step}><MathText text={step} /></li>
            ))}
          </ol>
          <button onClick={advance} className="mt-3 rounded-lg bg-clay-500 px-4 py-1.5 text-sm font-semibold text-white">
            {index + 1 >= PRACTICE_ROUND ? "Xem kết quả" : "Câu tiếp ▸"}
          </button>
        </div>
      )}
    </div>
  );
}
