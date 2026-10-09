"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CHAPTERS, type Lesson } from "@shared/mathQuestLessons";
import { Loading, Paper, logout, relativeDay, suggestNext, useMe, type ProgressEntry } from "@/components/mathquest/shared";

// The lesson notebook's front page. It always leads with one obvious next
// step ("Việc nên làm bây giờ"), then the chapters of the student's grade —
// approved lessons open once the tutor has taught them.
export default function MathQuestHome() {
  const { me, reload } = useMe();
  if (!me) return <Loading />;
  if (me.role === null) return <Landing error={me.error} onDone={reload} />;

  const tutor = me.role === "tutor";
  const chapters = tutor ? CHAPTERS : CHAPTERS.filter((chapter) => chapter.grade === me.student.grade);
  const progress = me.role === "student" ? me.progress : [];
  const progressOf = (lessonId: string) => progress.find((entry) => entry.lessonId === lessonId);
  const visible = chapters.flatMap((chapter) => chapter.lessons).filter((lesson) => tutor || me.approved.includes(lesson.id));
  const open = visible.filter((lesson) => tutor || Boolean(progressOf(lesson.id)?.taughtAt));

  const signOut = async () => {
    await logout();
    reload();
  };

  return (
    <Paper>
      <Link href="/" className="text-sm font-semibold text-ink/50 hover:text-ink">← Trang chủ</Link>
      <header className="mt-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-clay-600">📒 Sổ tay bài học</p>
          <h1 className="mt-1 font-draw-display text-3xl font-extrabold">
            {tutor ? "Xem trước sổ tay" : `Chào ${me.student.name} 👋`}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!tutor && <span className="rounded-full bg-ink/10 px-3 py-1 text-sm font-bold">Lớp {me.student.grade}</span>}
          <button onClick={signOut} className="rounded-lg px-2 py-1 text-sm text-ink/50 hover:text-ink">Đăng xuất</button>
        </div>
      </header>

      {tutor ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-5 py-4 text-cream-50">
          <p className="text-sm">Bạn đang xem với tư cách gia sư: thấy mọi bài, kể cả bài chưa duyệt.</p>
          <Link href="/math-quest/tutor" className="rounded-xl bg-gold-500 px-4 py-2 font-bold text-white">Về trang gia sư ▸</Link>
        </div>
      ) : (
        <>
          <NextStep open={open} progress={progress} />
          <ProgressStrip visible={visible} open={open} progress={progress} />
        </>
      )}

      {chapters.map((chapter) => {
        const lessons = chapter.lessons.filter((lesson) => visible.includes(lesson));
        return (
          <section key={`${chapter.grade}-${chapter.number}`} className="mt-9">
            <h2 className="font-draw-display text-xl font-bold">
              {tutor && <span className="mr-2 rounded-full bg-ink/10 px-2 py-0.5 text-xs">Lớp {chapter.grade}</span>}
              Chương {chapter.roman}. {chapter.title}
            </h2>
            {lessons.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-cream-200 bg-white/60 p-4 text-sm text-ink/50">
                Thầy/cô đang soạn các bài của chương này — quay lại sau nhé.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {lessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    progress={progressOf(lesson.id)}
                    open={open.includes(lesson)}
                    reviewBadge={tutor ? (me.approved.includes(lesson.id) ? "approved" : "pending") : null}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <Link
        href="/math-boss"
        className="mt-10 flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#2e1065] to-[#4c1d95] px-5 py-4 text-white shadow-md transition hover:brightness-110"
      >
        <span>
          <span className="block font-draw-display text-lg font-extrabold">⚔️ Đánh Quái Máy Tính</span>
          <span className="block text-sm text-violet-200">Có mã phòng trên màn hình lớn? Vào trận cùng cả lớp.</span>
        </span>
        <span className="shrink-0 rounded-xl bg-amber-400 px-4 py-2 font-bold text-violet-950">Vào trận ▸</span>
      </Link>
    </Paper>
  );
}

function NextStep({ open, progress }: { open: Lesson[]; progress: ProgressEntry[] }) {
  const suggestion = suggestNext(open, progress);
  if (!suggestion) {
    return (
      <div className="mt-5 rounded-2xl border-2 border-dashed border-cream-200 bg-white p-5 text-center">
        <div className="text-4xl">📚</div>
        <p className="mt-2 font-draw-display text-xl font-bold">Chưa có bài nào được mở</p>
        <p className="mt-1 text-sm text-ink/60">Học xong buổi tới, thầy/cô sẽ mở bài ở đây để bạn ôn lại.</p>
      </div>
    );
  }
  return (
    <Link
      href={suggestion.href}
      className="group mt-5 block overflow-hidden rounded-2xl bg-gradient-to-br from-clay-500 to-gold-500 p-5 text-white shadow-lg shadow-clay-500/30 transition hover:shadow-xl"
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Việc nên làm bây giờ</p>
      <div className="mt-2 flex items-center gap-4">
        <span className="text-5xl drop-shadow">{suggestion.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white/90">{suggestion.title}</p>
          <p className="mt-0.5 font-draw-display text-xl font-extrabold leading-snug sm:text-2xl">{suggestion.detail}</p>
        </div>
      </div>
      <span className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 font-bold text-clay-600 shadow transition group-hover:translate-x-1">
        {suggestion.cta} ▸
      </span>
    </Link>
  );
}

function ProgressStrip({ visible, open, progress }: { visible: Lesson[]; open: Lesson[]; progress: ProgressEntry[] }) {
  if (visible.length === 0) return null;
  const correct = progress.reduce((sum, entry) => sum + entry.practiceCorrect, 0);
  const total = progress.reduce((sum, entry) => sum + entry.practiceTotal, 0);
  const pct = Math.round((open.length / visible.length) * 100);
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-cream-200 bg-white p-3">
        <p className="text-xs font-semibold text-ink/50">Đã học</p>
        <p className="font-draw-display text-2xl font-extrabold">
          {open.length}<span className="text-base text-ink/40">/{visible.length} bài</span>
        </p>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream-100">
          <div className="h-full rounded-full bg-sage-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="rounded-xl border border-cream-200 bg-white p-3">
        <p className="text-xs font-semibold text-ink/50">Luyện tập</p>
        <p className="font-draw-display text-2xl font-extrabold">
          {total ? `${Math.round((correct / total) * 100)}%` : "—"}
          <span className="text-base text-ink/40"> {total ? `đúng ${correct}/${total}` : "chưa luyện"}</span>
        </p>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream-100">
          <div className="h-full rounded-full bg-gold-500" style={{ width: `${total ? (correct / total) * 100 : 0}%` }} />
        </div>
      </div>
    </div>
  );
}

function LessonCard({ lesson, progress, open, reviewBadge }: { lesson: Lesson; progress?: ProgressEntry; open: boolean; reviewBadge: "approved" | "pending" | null }) {
  if (!open) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-cream-200 bg-white/50 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream-100 text-lg">🔒</span>
        <div className="min-w-0">
          <p className="font-draw-display font-bold text-ink/50">Bài {lesson.number}. {lesson.title}</p>
          <p className="text-sm text-ink/40">Mở khi thầy/cô dạy bài này trên lớp.</p>
        </div>
      </div>
    );
  }

  const pct = progress?.practiceTotal ? Math.round((progress.practiceCorrect / progress.practiceTotal) * 100) : null;
  return (
    <div className="rounded-xl border border-cream-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-100 font-draw-display text-lg font-extrabold text-sage-600">
          {lesson.number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-draw-display text-lg font-bold leading-snug">{lesson.title}</p>
            {reviewBadge && (
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${reviewBadge === "approved" ? "bg-sage-100 text-sage-600" : "bg-gold-100 text-gold-600"}`}>
                {reviewBadge === "approved" ? "Đã duyệt" : "Chưa duyệt"}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink/60">{lesson.summary}</p>
          {progress?.taughtAt && (
            <p className="mt-1.5 text-xs text-ink/50">
              Học {relativeDay(progress.taughtAt)}
              {progress.lastOpenedAt ? ` · Ôn ${relativeDay(progress.lastOpenedAt)}` : " · Chưa ôn lần nào"}
              {pct !== null && ` · Luyện đúng ${pct}%`}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 pl-[3.25rem]">
        <Link href={`/math-quest/lesson/${lesson.id}`} className="rounded-lg bg-clay-500 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-clay-500/30 transition hover:bg-clay-600">
          📖 Ôn bài
        </Link>
        {lesson.practice.length > 0 && (
          <Link
            href={`/math-quest/lesson/${lesson.id}#practice`}
            className="rounded-lg border-2 border-clay-500 px-4 py-1.5 text-sm font-bold text-clay-600 transition hover:bg-clay-500/10"
          >
            🎯 Luyện 5 câu
          </Link>
        )}
      </div>
    </div>
  );
}

// Logged out: what Math Quest is, and the three ways in — a student logs in
// to their notebook, anyone with a code joins the boss fight on the big
// screen, the tutor goes to their page.
function Landing({ error, onDone }: { error?: string; onDone: () => void }) {
  return (
    <Paper>
      <Link href="/" className="text-sm font-semibold text-ink/50 hover:text-ink">← Trang chủ</Link>
      <header className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-500 via-violet-600 to-indigo-700 px-6 py-8 text-white shadow-xl sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70">Lớp học toán 8 – 9</p>
        <h1 className="mt-1 font-draw-display text-4xl font-extrabold sm:text-5xl">🧮 Math Quest</h1>
        <p className="mt-2 max-w-lg text-white/85">Học bài trên lớp, về nhà ôn lại trong sổ tay, luyện vài câu mỗi ngày — và cùng nhau hạ Quái Máy Tính.</p>
        <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
          <li className="rounded-xl bg-white/15 px-3 py-2">📒 Sổ tay từng bài SGK</li>
          <li className="rounded-xl bg-white/15 px-3 py-2">🎯 Luyện nhanh, chấm ngay</li>
          <li className="rounded-xl bg-white/15 px-3 py-2">⚔️ Đánh boss cùng cả lớp</li>
        </ul>
      </header>

      <div className="mt-6 grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <StudentLogin error={error} onDone={onDone} />
        <div className="flex flex-col gap-5">
          <JoinFight />
          <Link href="/math-quest/tutor" className="group rounded-2xl border border-cream-200 bg-white p-5 shadow-sm transition hover:border-clay-500">
            <p className="font-draw-display text-lg font-extrabold">🧑‍🏫 Tôi là gia sư</p>
            <p className="mt-1 text-sm text-ink/60">Thêm học sinh, mở bài đã dạy, duyệt bài và mở màn hình chiếu Quái Máy Tính.</p>
            <span className="mt-3 inline-block font-bold text-clay-600 transition group-hover:translate-x-1">Vào trang gia sư ▸</span>
          </Link>
        </div>
      </div>
    </Paper>
  );
}

function JoinFight() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const join = () => code && router.push(`/math-boss/${code}`);
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#2e1065] to-[#4c1d95] p-5 text-white shadow-md">
      <p className="font-draw-display text-lg font-extrabold">⚔️ Vào trận Quái Máy Tính</p>
      <p className="mt-1 text-sm text-violet-200">Nhập mã phòng đang hiện trên màn hình lớn.</p>
      <div className="mt-3 flex gap-2">
        <input
          value={code}
          inputMode="numeric"
          maxLength={8}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          onKeyDown={(event) => event.key === "Enter" && join()}
          placeholder="Mã phòng"
          className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-violet-300 focus:border-amber-300"
        />
        <button onClick={join} disabled={!code} className="rounded-xl bg-amber-400 px-4 font-bold text-violet-950 disabled:opacity-40">Vào ▸</button>
      </div>
    </div>
  );
}

function StudentLogin({ error, onDone }: { error?: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState(error ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !pin || busy) return;
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/math-quest/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "student", name, pin }),
    });
    setBusy(false);
    if (res.ok) return onDone();
    setMessage(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Không đăng nhập được.");
  };

  return (
    <section className="rounded-2xl border border-cream-200 bg-white p-6 shadow-lg">
      <p className="font-draw-display text-xl font-extrabold">📒 Tôi là học sinh</p>
      <p className="mt-1 text-sm text-ink/60">Mở sổ tay bằng tên và mã PIN thầy/cô đã cho.</p>
      <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-ink/50">Tên của bạn</label>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Ví dụ: Minh"
        className="mt-1 w-full rounded-xl border-2 border-cream-200 px-4 py-3 outline-none focus:border-clay-500"
      />
      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-ink/50">Mã PIN</label>
      <input
        value={pin}
        inputMode="numeric"
        type="password"
        maxLength={6}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
        onKeyDown={(event) => event.key === "Enter" && submit()}
        placeholder="••••"
        className="mt-1 w-full rounded-xl border-2 border-cream-200 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:border-clay-500"
      />
      {message && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{message}</p>}
      <button
        onClick={submit}
        disabled={busy || !name.trim() || !pin}
        className="mt-5 w-full rounded-xl bg-clay-500 py-3.5 font-draw-display text-lg font-extrabold text-white shadow-md shadow-clay-500/30 transition hover:bg-clay-600 disabled:opacity-50"
      >
        {busy ? "Đang mở…" : "Mở sổ tay ▸"}
      </button>
      <p className="mt-3 text-center text-xs text-ink/40">Chưa có PIN? Hỏi thầy/cô nhé.</p>
    </section>
  );
}
