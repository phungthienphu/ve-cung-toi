"use client";

import { useCallback, useEffect, useState } from "react";
import { HOME_CRUMB, MATH_QUEST_CRUMB, Paper, TUTOR_CRUMB, TopBar, TutorLogin, TutorTabs, logout } from "@/components/mathquest/shared";
import { AttendanceCalendar } from "@/components/mathquest/attendance/Calendar";
import { ClassCard, NewClassForm } from "@/components/mathquest/attendance/Classes";
import { CopyMessage, type AttendanceData } from "@/components/mathquest/attendance/ui";
import { WEEK, formatVnd, missedDays, parentMessage, shortDay, todayKey, weekdayOf } from "@/lib/mathQuest/tuition";

const TRAIL = [HOME_CRUMB, MATH_QUEST_CRUMB, TUTOR_CRUMB, { label: "Điểm danh & học phí" }];

// The tutor's attendance book and tuition bills, replacing their Google
// Sheet (docs/diem-danh-hoc-phi-spec.md): log each lesson on a calendar,
// close a bill at month end, copy the message for the parent.
export default function AttendancePage() {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [state, setState] = useState<"loading" | "login" | "ready">("loading");
  const [error, setError] = useState("");
  const [today] = useState(todayKey);
  const [selected, setSelected] = useState(today);

  const load = useCallback(async () => {
    const res = await fetch("/api/math-quest/tutor/attendance", { cache: "no-store" });
    if (res.status === 401) return setState("login");
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Không tải được dữ liệu.");
      return setState("login");
    }
    setData(body as AttendanceData);
    setState("ready");
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (payload: Record<string, unknown>) => {
    setError("");
    const res = await fetch("/api/math-quest/tutor/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Có lỗi xảy ra.");
    await load();
    return res.ok;
  };

  const back = { href: "/math-quest/tutor", label: "Trang gia sư" };
  if (state === "loading") {
    return (
      <Paper>
        <TopBar back={back} trail={TRAIL} />
        <p className="py-24 text-center text-ink/50">Đang tải…</p>
      </Paper>
    );
  }
  if (state === "login" || !data) return <TutorLogin error={error} onDone={load} />;

  const active = data.classes.filter((cls) => !cls.archived);
  const archived = data.classes.filter((cls) => cls.archived);
  const jumpTo = (day: string) => {
    setSelected(day);
    document.getElementById("calendar")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <Paper>
      <TopBar
        back={back}
        trail={TRAIL}
        right={
          <button
            onClick={async () => {
              await logout();
              setState("login");
            }}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-ink/50 hover:text-ink"
          >
            Đăng xuất
          </button>
        }
      />
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-clay-600">🧑‍🏫 Trang gia sư</p>
        <h1 className="mt-1 font-draw-display text-2xl font-extrabold sm:text-3xl">Điểm danh & học phí</h1>
      </header>
      <TutorTabs active="attendance" />
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}

      {data.classes.length === 0 ? (
        <NewClassForm act={act} today={today} first />
      ) : (
        <>
          <Reminders data={data} today={today} onJump={jumpTo} act={act} />
          <AttendanceCalendar data={data} act={act} today={today} selected={selected} onSelect={setSelected} />
          {active.map((cls) => (
            <ClassCard key={cls.id} cls={cls} data={data} act={act} today={today} />
          ))}
          <NewClassForm act={act} today={today} first={false} />
          {archived.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-semibold text-ink/50">Lớp đã ngừng dạy ({archived.length})</summary>
              {archived.map((cls) => (
                <ClassCard key={cls.id} cls={cls} data={data} act={act} today={today} />
              ))}
            </details>
          )}
        </>
      )}
    </Paper>
  );
}

/** What needs the tutor's attention: lessons not logged yet, and bills not paid yet. */
function Reminders({ data, today, onJump, act }: { data: AttendanceData; today: string; onJump: (day: string) => void; act: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const missed = data.classes
    .filter((cls) => !cls.archived)
    .flatMap((cls) => missedDays(cls, data.sessions, data.invoices, today).map((day) => ({ cls, day })))
    .sort((a, b) => a.day.localeCompare(b.day));
  const unpaid = data.invoices.filter((invoice) => !invoice.paidAt).sort((a, b) => a.to.localeCompare(b.to));
  if (missed.length === 0 && unpaid.length === 0) return null;
  const byId = new Map(data.classes.map((cls) => [cls.id, cls]));

  return (
    <div className="mt-6 grid gap-3">
      {missed.length > 0 && (
        <section className="rounded-2xl border-2 border-red-200 bg-red-50 p-4">
          <p className="font-bold text-red-700">⏰ Quên điểm danh? {missed.length} buổi theo lịch chưa tích</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missed.slice(0, 12).map(({ cls, day }) => (
              <button key={`${cls.id}-${day}`} onClick={() => onJump(day)} className="rounded-lg bg-white px-2.5 py-1 text-sm font-semibold shadow-sm">
                {WEEK.find((item) => item.day === weekdayOf(day))!.short} {shortDay(day)} · {cls.name}
              </button>
            ))}
            {missed.length > 12 && <span className="self-center text-sm text-red-700">+{missed.length - 12} buổi nữa</span>}
          </div>
        </section>
      )}
      {unpaid.length > 0 && (
        <section className="rounded-2xl border-2 border-gold-500/40 bg-gold-100/60 p-4">
          <p className="font-bold text-gold-600">
            💸 Chờ phụ huynh trả · {formatVnd(unpaid.reduce((sum, invoice) => sum + invoice.total, 0))}
          </p>
          <ul className="mt-2 space-y-2">
            {unpaid.map((invoice) => {
              const cls = byId.get(invoice.classId);
              if (!cls) return null;
              const sessions = data.sessions.filter((s) => s.invoiceId === invoice.id);
              return (
                <li key={invoice.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2">
                  <span className="min-w-0 flex-1 font-semibold">
                    {cls.name} <span className="font-normal text-ink/60">· {invoice.title}</span>
                  </span>
                  <span className="font-bold">{formatVnd(invoice.total)}</span>
                  <div className="flex w-full flex-wrap items-center gap-1.5">
                    <CopyMessage text={parentMessage(cls, invoice.title, sessions)} primary />
                    <button onClick={() => act({ action: "set_paid", invoiceId: invoice.id, paid: true })} className="rounded-lg bg-sage-500 px-2.5 py-1 text-xs font-bold text-white">
                      ✓ Đã trả
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
