"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Lesson } from "@shared/mathQuestLessons";
import { drawFontClass } from "@/lib/drawFonts";

export interface ProgressEntry {
  lessonId: string;
  taughtAt: string | null;
  lastOpenedAt: string | null;
  practiceCorrect: number;
  practiceTotal: number;
}

export type Me =
  | { role: null; error?: string }
  | { role: "tutor"; approved: string[] }
  | { role: "student"; student: { id: string; name: string; grade: 8 | 9 }; approved: string[]; progress: ProgressEntry[] };

/** Who's looking at the notebook (student, tutor or nobody), reloadable after login/logout. */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/math-quest/me", { cache: "no-store" });
      setMe((await res.json()) as Me);
    } catch {
      setMe({ role: null, error: "Không kết nối được máy chủ." });
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { me, reload };
}

export async function logout() {
  await fetch("/api/math-quest/auth", { method: "DELETE" });
}

/** "hôm nay", "hôm qua", "3 ngày trước", or "12/10" for older dates. */
export function relativeDay(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const days = Math.floor((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return "hôm nay";
  if (days === 1) return "hôm qua";
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export interface Crumb {
  href?: string;
  label: string;
}

export const HOME_CRUMB: Crumb = { href: "/", label: "Trang chủ" };
export const MATH_QUEST_CRUMB: Crumb = { href: "/math-quest", label: "Math Quest" };
export const TUTOR_CRUMB: Crumb = { href: "/math-quest/tutor", label: "Trang gia sư" };
/** Where the tutor's projector last opened a fight, so a closed tab can find its way back. */
export const LAST_HOST_ROOM_KEY = "vct_mathboss_host_room";

/**
 * The one navigation bar every Math Quest page uses: "‹ Parent" always goes
 * to the page's logical parent (never browser history, so a link opened cold
 * still has a way out), the trail says where you are, account actions sit on
 * the right. Sticky, so the way back is never scrolled away.
 */
export function TopBar({ back, trail, right }: { back?: { href: string; label: string }; trail: Crumb[]; right?: React.ReactNode }) {
  return (
    <nav className="sticky top-0 z-30 -mx-4 mb-5 flex items-center gap-3 border-b border-cream-200 bg-cream-50/90 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
      {back && (
        <Link
          href={back.href}
          className="flex shrink-0 items-center gap-1 rounded-full border border-cream-200 bg-white px-3 py-1.5 text-sm font-bold text-ink/70 shadow-sm transition hover:border-clay-500 hover:text-clay-600"
        >
          <span aria-hidden>‹</span> {back.label}
        </Link>
      )}
      <ol className="hidden min-w-0 flex-1 items-center gap-1.5 text-sm text-ink/45 sm:flex" aria-label="Bạn đang ở">
        {trail.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
            {index > 0 && <span aria-hidden>/</span>}
            {crumb.href && index < trail.length - 1 ? (
              <Link href={crumb.href} className="truncate hover:text-clay-600">{crumb.label}</Link>
            ) : (
              <span className="truncate font-semibold text-ink/80">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
      {right && <div className="ml-auto flex min-w-0 items-center gap-2">{right}</div>}
    </nav>
  );
}

/** Switches between the tutor's pages: lessons, the AI exercise maker, attendance & tuition. */
export function TutorTabs({ active }: { active: "lessons" | "exercises" | "attendance" }) {
  const tabs = [
    { key: "lessons", href: "/math-quest/tutor", label: "📚 Bài học" },
    { key: "exercises", href: "/math-quest/exercises", label: "✨ Soạn đề" },
    { key: "attendance", href: "/math-quest/tutor/attendance", label: "🗓️ Điểm danh", more: " & học phí" },
  ] as const;
  return (
    <div className="mt-4 flex gap-1 rounded-xl border border-cream-200 bg-white p-1 shadow-sm" role="tablist">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          role="tab"
          aria-selected={tab.key === active}
          className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-center text-sm font-bold transition ${
            tab.key === active ? "bg-clay-500 text-white shadow-sm" : "text-ink/60 hover:bg-cream-50 hover:text-ink"
          }`}
        >
          {tab.label}
          {"more" in tab && <span className="hidden sm:inline">{tab.more}</span>}
        </Link>
      ))}
    </div>
  );
}

/** Light "notebook paper" frame shared by the Math Quest pages. */
export function Paper({ children }: { children: React.ReactNode }) {
  return (
    <main className={`${drawFontClass} min-h-app overflow-x-clip bg-cream-50 px-4 pb-24 pt-6 text-ink sm:px-6`}>
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </main>
  );
}

/** The tutor's password screen, shared by both tutor pages. */
export function TutorLogin({ error, onDone }: { error: string; onDone: () => void }) {
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
      <TopBar back={{ href: "/math-quest", label: "Math Quest" }} trail={[HOME_CRUMB, MATH_QUEST_CRUMB, { label: "Đăng nhập gia sư" }]} />
      <section className="mx-auto mt-6 max-w-sm rounded-2xl border border-cream-200 bg-white p-6 text-center shadow-sm">
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
        <button onClick={submit} disabled={!password} className="mt-4 w-full rounded-xl bg-clay-500 py-3 font-bold text-white disabled:opacity-50">Đăng nhập ▸</button>
        <p className="mt-4 text-xs text-ink/40">
          Là học sinh? <Link href="/math-quest" className="underline hover:text-ink">Mở sổ tay của bạn</Link>
        </p>
      </section>
    </Paper>
  );
}

export function Loading() {
  return (
    <Paper>
      <p className="py-24 text-center text-ink/50">Đang mở sổ tay…</p>
    </Paper>
  );
}


export interface Suggestion {
  lesson: Lesson;
  icon: string;
  title: string;
  detail: string;
  cta: string;
  href: string;
}

const accuracy = (entry: ProgressEntry) => (entry.practiceTotal ? entry.practiceCorrect / entry.practiceTotal : 0);
const daysSince = (iso: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 86_400_000 : Infinity);

/**
 * The one thing a student should do next, in priority order: a lesson
 * just taught and never opened, one never practised, the weakest one, one
 * not reviewed for a while — or, all caught up, keep practising the
 * least recently practised.
 */
export function suggestNext(open: Lesson[], progress: ProgressEntry[]): Suggestion | null {
  const withProgress = open
    .map((lesson) => ({ lesson, entry: progress.find((item) => item.lessonId === lesson.id) }))
    .filter((item): item is { lesson: Lesson; entry: ProgressEntry } => Boolean(item.entry));
  if (withProgress.length === 0) return null;
  const label = (lesson: Lesson) => `Bài ${lesson.number}. ${lesson.title}`;
  const read = (lesson: Lesson) => `/math-quest/lesson/${lesson.id}`;
  const drill = (lesson: Lesson) => `/math-quest/lesson/${lesson.id}#practice`;

  const fresh = withProgress
    .filter(({ entry }) => !entry.lastOpenedAt)
    .sort((a, b) => daysSince(a.entry.taughtAt) - daysSince(b.entry.taughtAt))[0];
  if (fresh) return { lesson: fresh.lesson, icon: "✨", title: "Bài mới vừa học trên lớp", detail: label(fresh.lesson), cta: "Học bài này", href: read(fresh.lesson) };

  const untried = withProgress.find(({ lesson, entry }) => lesson.practice.length > 0 && entry.practiceTotal === 0);
  if (untried) return { lesson: untried.lesson, icon: "🎯", title: "Thử sức bài vừa đọc", detail: label(untried.lesson), cta: "Luyện 5 câu", href: drill(untried.lesson) };

  const weak = withProgress
    .filter(({ lesson, entry }) => lesson.practice.length > 0 && accuracy(entry) < 0.8)
    .sort((a, b) => accuracy(a.entry) - accuracy(b.entry))[0];
  if (weak) {
    return {
      lesson: weak.lesson,
      icon: "💪",
      title: `Bài này mới đúng ${Math.round(accuracy(weak.entry) * 100)}% — ôn thêm chút nhé`,
      detail: label(weak.lesson),
      cta: "Ôn và luyện lại",
      href: read(weak.lesson),
    };
  }

  const stale = withProgress
    .filter(({ entry }) => daysSince(entry.lastOpenedAt) >= 5)
    .sort((a, b) => daysSince(b.entry.lastOpenedAt) - daysSince(a.entry.lastOpenedAt))[0];
  if (stale) return { lesson: stale.lesson, icon: "⏰", title: "Lâu rồi chưa ôn — kẻo quên mất", detail: label(stale.lesson), cta: "Ôn lại ngay", href: read(stale.lesson) };

  const practisable = withProgress.filter(({ lesson }) => lesson.practice.length > 0);
  const keepGoing = (practisable.length ? practisable : withProgress).sort(
    (a, b) => daysSince(b.entry.lastOpenedAt) - daysSince(a.entry.lastOpenedAt)
  )[0];
  return { lesson: keepGoing.lesson, icon: "🏆", title: "Bạn đang nắm rất chắc! Giữ phong độ nào", detail: label(keepGoing.lesson), cta: "Luyện thêm 5 câu", href: drill(keepGoing.lesson) };
}
