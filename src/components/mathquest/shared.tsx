"use client";

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

/** Light "notebook paper" frame shared by the Math Quest pages. */
export function Paper({ children }: { children: React.ReactNode }) {
  return (
    <main className={`${drawFontClass} min-h-app bg-cream-50 px-4 pb-24 pt-6 text-ink sm:px-6`}>
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </main>
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
