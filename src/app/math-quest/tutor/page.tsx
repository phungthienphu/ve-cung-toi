"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CHAPTERS, LESSONS } from "@shared/mathQuestLessons";
import { Paper, logout, relativeDay } from "@/components/mathquest/shared";

interface Student {
  id: string;
  name: string;
  grade: 8 | 9;
}
interface Progress {
  studentId: string;
  lessonId: string;
  taughtAt: string | null;
  lastOpenedAt: string | null;
  practiceCorrect: number;
  practiceTotal: number;
}
interface Review {
  lessonId: string;
  status: "approved" | "changes";
  note: string;
}
interface Overview {
  students: Student[];
  progress: Progress[];
  reviews: Review[];
}

// The tutor's side of Math Quest: students and their PINs, which lessons
// each has been taught, and approving the lesson drafts.
export default function TutorPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<"loading" | "login" | "ready">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/math-quest/tutor", { cache: "no-store" });
    if (res.status === 401) return setState("login");
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Không tải được dữ liệu.");
      return setState("login");
    }
    setData(body as Overview);
    setState("ready");
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (payload: Record<string, unknown>) => {
    setError("");
    const res = await fetch("/api/math-quest/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Có lỗi xảy ra.");
    await load();
    return res.ok;
  };

  if (state === "loading") return <Paper><p className="py-24 text-center text-ink/50">Đang tải…</p></Paper>;
  if (state === "login" || !data) return <TutorLogin error={error} onDone={load} />;

  return (
    <Paper>
      <Link href="/math-quest" className="text-sm font-semibold text-ink/50 hover:text-ink">← Math Quest</Link>
      <header className="mt-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-clay-600">🧑‍🏫 Trang gia sư</p>
          <h1 className="mt-1 font-draw-display text-3xl font-extrabold">Math Quest</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/math-quest" className="rounded-lg border border-cream-200 bg-white px-3 py-1.5 text-sm font-semibold">Xem trước sổ tay</Link>
          <button
            onClick={async () => {
              await logout();
              setState("login");
            }}
            className="rounded-lg border border-cream-200 px-3 py-1.5 text-sm text-ink/60"
          >
            Đăng xuất
          </button>
        </div>
      </header>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}

      <QuickStart data={data} />
      <Students data={data} act={act} />
      {data.students.map((student) => (
        <TaughtLessons key={student.id} student={student} data={data} act={act} />
      ))}
      <Reviews data={data} act={act} />
    </Paper>
  );
}

type Act = (payload: Record<string, unknown>) => Promise<boolean>;

// The tutor's to-do list, in the order things have to happen for a student
// to see anything — plus the two things a lesson day needs: the boss fight
// on the projector and the link to send the kids.
function QuickStart({ data }: { data: Overview }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [link] = useState(() => (typeof window === "undefined" ? "/math-quest" : `${window.location.origin}/math-quest`));
  const approved = new Set(data.reviews.filter((review) => review.status === "approved").map((review) => review.lessonId));
  const pending = LESSONS.filter((lesson) => !approved.has(lesson.id)).length;
  const taught = data.progress.filter((entry) => entry.taughtAt).length;
  const firstStudent = data.students[0];
  const steps = [
    { done: data.students.length > 0, title: "Thêm học sinh", detail: data.students.length ? `${data.students.length} học sinh` : "Tạo tên + mã PIN cho từng bé", href: "#students" },
    { done: pending === 0, title: "Duyệt bài", detail: pending ? `Còn ${pending} bài chờ duyệt` : "Đã duyệt hết", href: "#reviews" },
    { done: taught > 0, title: "Tích bài đã dạy", detail: taught ? `Đã mở ${taught} bài` : "Bài được tích sẽ mở trong sổ tay của bé", href: firstStudent ? `#taught-${firstStudent.id}` : "#students" },
  ];
  const next = steps.find((step) => !step.done);

  return (
    <section className="mt-6 grid gap-4 md:grid-cols-[1.3fr_1fr]">
      <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <p className="font-draw-display text-lg font-extrabold">🚀 Bắt đầu nhanh</p>
        <ol className="mt-3 space-y-2">
          {steps.map((step, index) => (
            <li key={step.title}>
              <a href={step.href} className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${step === next ? "bg-clay-500/10 ring-2 ring-clay-500" : "hover:bg-cream-50"}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step.done ? "bg-sage-500 text-white" : "bg-cream-100 text-ink/60"}`}>
                  {step.done ? "✓" : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block font-semibold ${step.done ? "text-ink/50" : ""}`}>{step.title}</span>
                  <span className="block text-xs text-ink/50">{step.detail}</span>
                </span>
                {step === next && <span className="shrink-0 text-sm font-bold text-clay-600">Làm ngay ▸</span>}
              </a>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-cream-50 px-3 py-2">
          <span className="text-sm">📨 Link cho học sinh:</span>
          <code className="min-w-0 flex-1 truncate text-sm text-clay-600">{link}</code>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded-lg bg-clay-500 px-3 py-1 text-xs font-bold text-white"
          >
            {copied ? "✓ Đã chép" : "Sao chép"}
          </button>
        </div>
      </div>
      <button
        onClick={() => router.push(`/math-boss/${Math.floor(10000 + Math.random() * 90000)}?host=1`)}
        className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#2e1065] to-[#4c1d95] p-5 text-left text-white shadow-md transition hover:brightness-110"
      >
        <span>
          <span className="block font-draw-display text-lg font-extrabold">⚔️ Quái Máy Tính</span>
          <span className="mt-1 block text-sm text-violet-200">Mở màn hình chiếu cho buổi học. Các bé vào bằng mã phòng trên điện thoại.</span>
        </span>
        <span className="mt-4 inline-block self-start rounded-xl bg-amber-400 px-4 py-2 font-bold text-violet-950">🖥️ Mở màn hình chiếu ▸</span>
      </button>
    </section>
  );
}

function Card({ id, title, hint, children }: { id?: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-8 scroll-mt-6 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
      <h2 className="font-draw-display text-xl font-bold">{title}</h2>
      {hint && <p className="text-sm text-ink/50">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Students({ data, act }: { data: Overview; act: Act }) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<8 | 9>(8);
  const [pin, setPin] = useState("");

  const add = async () => {
    if (await act({ action: "create_student", name, grade, pin })) {
      setName("");
      setPin("");
    }
  };

  return (
    <Card id="students" title="👧 Học sinh" hint="Học sinh vào sổ tay bằng tên + mã PIN. PIN được mã hóa, không xem lại được — hãy ghi lại khi tạo.">
      {data.students.length === 0 && <p className="text-sm text-ink/50">Chưa có học sinh nào.</p>}
      <ul className="space-y-2">
        {data.students.map((student) => (
          <li key={student.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream-50 px-3 py-2">
            <span className="font-semibold">{student.name}</span>
            <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold">Lớp {student.grade}</span>
            <span className="ml-auto flex gap-1.5">
              <button
                onClick={() => {
                  const next = window.prompt(`Mã PIN mới cho ${student.name} (4–6 chữ số):`);
                  if (next) act({ action: "update_student", studentId: student.id, pin: next.trim() });
                }}
                className="rounded-lg border border-cream-200 bg-white px-2.5 py-1 text-xs font-semibold"
              >
                Đổi PIN
              </button>
              <button
                onClick={() => act({ action: "update_student", studentId: student.id, grade: student.grade === 8 ? 9 : 8 })}
                className="rounded-lg border border-cream-200 bg-white px-2.5 py-1 text-xs font-semibold"
              >
                Chuyển lớp {student.grade === 8 ? 9 : 8}
              </button>
              <button
                onClick={() => window.confirm(`Xóa ${student.name} và toàn bộ tiến độ của bạn ấy?`) && act({ action: "delete_student", studentId: student.id })}
                className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-500"
              >
                Xóa
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_8rem_auto]">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên học sinh" className="rounded-lg border border-cream-200 px-3 py-2 outline-none focus:border-clay-500" />
        <div className="flex rounded-lg border border-cream-200 p-0.5">
          {([8, 9] as const).map((option) => (
            <button key={option} onClick={() => setGrade(option)} className={`rounded-md px-3 text-sm font-semibold ${grade === option ? "bg-clay-500 text-white" : "text-ink/60"}`}>
              Lớp {option}
            </button>
          ))}
        </div>
        <input
          value={pin}
          inputMode="numeric"
          maxLength={6}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
          placeholder="PIN 4–6 số"
          className="rounded-lg border border-cream-200 px-3 py-2 font-mono outline-none focus:border-clay-500"
        />
        <button onClick={add} disabled={!name.trim() || pin.length < 4} className="rounded-lg bg-clay-500 px-4 py-2 font-semibold text-white disabled:opacity-50">
          Thêm
        </button>
      </div>
    </Card>
  );
}

function TaughtLessons({ student, data, act }: { student: Student; data: Overview; act: Act }) {
  const approved = new Set(data.reviews.filter((review) => review.status === "approved").map((review) => review.lessonId));
  const chapters = CHAPTERS.filter((chapter) => chapter.grade === student.grade);
  return (
    <Card id={`taught-${student.id}`} title={`📚 Bài đã dạy — ${student.name}`} hint="Tích vào bài vừa dạy trên lớp: bài đó mở ra trong sổ tay của bạn ấy.">
      {chapters.map((chapter) => (
        <div key={chapter.number} className="mt-2 first:mt-0">
          <p className="text-sm font-bold text-ink/60">Chương {chapter.roman}. {chapter.title}</p>
          <ul className="mt-2 space-y-1.5">
            {chapter.lessons.map((lesson) => {
              const entry = data.progress.find((item) => item.studentId === student.id && item.lessonId === lesson.id);
              return (
                <li key={lesson.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-cream-50 px-3 py-2 text-sm">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(entry?.taughtAt)}
                      onChange={(event) => act({ action: "set_taught", studentId: student.id, lessonId: lesson.id, taught: event.target.checked })}
                      className="h-4 w-4 accent-clay-500"
                    />
                    <span className="truncate">Bài {lesson.number}. {lesson.title}</span>
                  </label>
                  {!approved.has(lesson.id) && <span className="text-xs font-semibold text-gold-600">Bài chưa duyệt</span>}
                  {entry?.taughtAt && <span className="text-xs text-ink/50">Dạy {relativeDay(entry.taughtAt)}</span>}
                  {entry?.lastOpenedAt && <span className="text-xs text-ink/50">· Ôn {relativeDay(entry.lastOpenedAt)}</span>}
                  {entry && entry.practiceTotal > 0 && (
                    <span className="text-xs text-ink/50">· Luyện đúng {entry.practiceCorrect}/{entry.practiceTotal}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Card>
  );
}

function Reviews({ data, act }: { data: Overview; act: Act }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const reviewOf = (lessonId: string) => data.reviews.find((review) => review.lessonId === lessonId);
  const pending = LESSONS.filter((lesson) => reviewOf(lesson.id)?.status !== "approved").length;

  return (
    <Card id="reviews" title="✅ Duyệt bài" hint={`Claude soạn, bạn duyệt. Học sinh chỉ thấy bài đã duyệt. Còn ${pending} bài chờ duyệt.`}>
      <ul className="space-y-2">
        {LESSONS.map((lesson) => {
          const review = reviewOf(lesson.id);
          return (
            <li key={lesson.id} className="rounded-xl bg-cream-50 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold">Lớp {lesson.grade}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">Bài {lesson.number}. {lesson.title}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    review?.status === "approved" ? "bg-sage-100 text-sage-600" : review?.status === "changes" ? "bg-red-50 text-red-500" : "bg-gold-100 text-gold-600"
                  }`}
                >
                  {review?.status === "approved" ? "Đã duyệt" : review?.status === "changes" ? "Cần sửa" : "Chờ duyệt"}
                </span>
              </div>
              {review?.status === "changes" && review.note && <p className="mt-1.5 text-xs text-ink/60">Ghi chú: {review.note}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link href={`/math-quest/lesson/${lesson.id}`} target="_blank" className="rounded-lg border border-cream-200 bg-white px-2.5 py-1 text-xs font-semibold">
                  Xem bài ↗
                </Link>
                {review?.status !== "approved" && (
                  <button onClick={() => act({ action: "review", lessonId: lesson.id, status: "approved" })} className="rounded-lg bg-sage-500 px-2.5 py-1 text-xs font-semibold text-white">
                    ✓ Duyệt
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditing(lesson.id);
                    setNote(review?.note ?? "");
                  }}
                  className="rounded-lg border border-cream-200 bg-white px-2.5 py-1 text-xs font-semibold"
                >
                  ✎ Cần sửa
                </button>
                {review && (
                  <button onClick={() => act({ action: "review", lessonId: lesson.id, status: "draft" })} className="rounded-lg border border-cream-200 bg-white px-2.5 py-1 text-xs text-ink/60">
                    ↺ Đưa về chờ duyệt
                  </button>
                )}
              </div>
              {editing === lesson.id && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    placeholder="Cần sửa gì? (ví dụ: thêm ví dụ có hệ số âm, đổi cách giải thích…)"
                    className="min-w-0 flex-1 rounded-lg border border-cream-200 px-3 py-2 text-sm outline-none focus:border-clay-500"
                  />
                  <button
                    onClick={async () => {
                      if (await act({ action: "review", lessonId: lesson.id, status: "changes", note })) setEditing(null);
                    }}
                    className="rounded-lg bg-clay-500 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Lưu ghi chú
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TutorLogin({ error, onDone }: { error: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(error);
  const submit = async () => {
    const res = await fetch("/api/math-quest/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "tutor", password }),
    });
    if (res.ok) return onDone();
    setMessage(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Không đăng nhập được.");
  };
  return (
    <Paper>
      <section className="mx-auto mt-10 max-w-sm rounded-2xl border border-cream-200 bg-white p-6 text-center shadow-sm">
        <div className="text-5xl">🧑‍🏫</div>
        <h1 className="mt-2 font-draw-display text-3xl font-extrabold">Trang gia sư</h1>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit()}
          placeholder="Mật khẩu gia sư"
          className="mt-5 w-full rounded-xl border border-cream-200 px-4 py-3 outline-none focus:border-clay-500"
        />
        {message && <p className="mt-3 text-sm font-semibold text-red-500">{message}</p>}
        <button onClick={submit} disabled={!password} className="mt-4 w-full rounded-xl bg-clay-500 py-3 font-bold text-white disabled:opacity-50">Đăng nhập</button>
      </section>
    </Paper>
  );
}
