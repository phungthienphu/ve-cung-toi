"use client";

import { useState } from "react";
import {
  OFF_REASONS,
  WEEK,
  addDays,
  dayKey,
  feeOn,
  formatHours,
  formatVnd,
  isScheduled,
  lastDayOfMonth,
  longDay,
  parseDay,
  type OffReason,
  type TuitionClass,
  type TuitionSession,
} from "@/lib/mathQuest/tuition";
import { Card, EXPECTED_CHIP, STATUS_STYLE, type Act, type AttendanceData } from "./ui";

/** The last day each class has billed up to: days up to it are settled. */
export function settledUntil(data: AttendanceData) {
  const until = new Map<string, string>();
  for (const invoice of data.invoices) if (invoice.to > (until.get(invoice.classId) ?? "")) until.set(invoice.classId, invoice.to);
  return until;
}

/**
 * Month grid of every class's sessions, coloured like the tutor's old sheet,
 * with the selected day's check-in panel right under it. Today is selected
 * on arrival, so logging a lesson that just ended is one tap.
 */
export function AttendanceCalendar({
  data,
  act,
  today,
  selected,
  onSelect,
}: {
  data: AttendanceData;
  act: Act;
  today: string;
  selected: string;
  onSelect: (day: string) => void;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const month = selected.slice(0, 8) + "01";
  const settled = settledUntil(data);
  const classes = data.classes.filter((cls) => (filter ? cls.id === filter : !cls.archived || data.sessions.some((s) => s.classId === cls.id && s.date.startsWith(month.slice(0, 7)))));
  const byId = new Map(data.classes.map((cls) => [cls.id, cls]));

  const first = parseDay(month);
  const lead = (first.getDay() + 6) % 7;
  const days: string[] = [];
  for (let day = month; day <= lastDayOfMonth(month); day = addDays(day, 1)) days.push(day);

  const expectedOn = (day: string) =>
    classes.filter((cls) => isScheduled(cls, day) && day > (settled.get(cls.id) ?? "") && !data.sessions.some((s) => s.classId === cls.id && s.date === day));
  const sessionsOn = (day: string) => data.sessions.filter((s) => s.date === day && classes.some((cls) => cls.id === s.classId));
  const shift = (months: number) => {
    const target = new Date(first.getFullYear(), first.getMonth() + months, 1);
    onSelect(dayKey(target));
  };

  return (
    <Card id="calendar">
      {/* ‹ month › on one line at any width — the title used to wrap beside the buttons on phones. */}
      <div className="mb-3 flex items-center gap-1.5">
        <button onClick={() => shift(-1)} className="h-9 w-9 shrink-0 rounded-lg border border-cream-200 bg-white text-lg font-bold" aria-label="Tháng trước">‹</button>
        <h2 className="min-w-0 flex-1 text-center font-draw-display text-lg font-extrabold sm:text-xl">
          Tháng {first.getMonth() + 1}/{first.getFullYear()}
        </h2>
        <button onClick={() => shift(1)} className="h-9 w-9 shrink-0 rounded-lg border border-cream-200 bg-white text-lg font-bold" aria-label="Tháng sau">›</button>
        <button
          onClick={() => onSelect(today)}
          disabled={selected === today}
          className="h-9 shrink-0 rounded-lg border border-cream-200 bg-white px-2.5 text-sm font-semibold disabled:opacity-40"
        >
          Hôm nay
        </button>
      </div>
      {data.classes.length > 1 && (
        <div className="-mx-3 mb-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ id: null, name: "Tất cả lớp" }, ...data.classes.filter((cls) => !cls.archived)].map((cls) => (
            <button
              key={cls.id ?? "all"}
              onClick={() => setFilter(cls.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${filter === cls.id ? "bg-ink text-white" : "bg-cream-100 text-ink/60"}`}
            >
              {cls.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-ink/40">
        {WEEK.map(({ short }) => (
          <span key={short}>{short}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5 sm:gap-1">
        {Array.from({ length: lead }, (_, index) => (
          <span key={`lead-${index}`} />
        ))}
        {days.map((day) => {
          const logged = sessionsOn(day);
          const expected = expectedOn(day);
          const isSelected = day === selected;
          return (
            <button
              key={day}
              onClick={() => onSelect(day)}
              className={`flex min-h-[3rem] flex-col items-center gap-1 rounded-lg p-1 transition sm:min-h-[4.5rem] sm:items-stretch sm:gap-0.5 sm:text-left ${
                isSelected ? "bg-clay-500/10 ring-2 ring-clay-500" : "bg-cream-50 hover:bg-cream-100"
              }`}
            >
              <span
                className={`rounded-full px-1.5 text-xs font-bold sm:self-start ${day === today ? "bg-clay-500 text-white" : day < today ? "text-ink/60" : "text-ink/40"}`}
              >
                {Number(day.slice(8))}
              </span>
              {/* Phones: one dot per session; wider screens: a named chip. */}
              <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                {logged.map((session) => (
                  <span key={session.classId} className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLE[session.status].dot}`} />
                ))}
                {expected.map((cls) => (
                  <span key={cls.id} className={`h-2.5 w-2.5 rounded-full border-2 ${day < today ? "border-red-400" : "border-ink/25"}`} />
                ))}
              </span>
              <span className="hidden flex-col gap-0.5 sm:flex">
                {logged.map((session) => (
                  <span key={session.classId} className={`truncate rounded px-1 text-[11px] font-semibold leading-4 ${STATUS_STYLE[session.status].chip}`}>
                    {byId.get(session.classId)?.name}
                  </span>
                ))}
                {expected.map((cls) => (
                  <span
                    key={cls.id}
                    className={`truncate rounded px-1 text-[11px] leading-4 ${day < today ? "border border-dashed border-red-300 text-red-500" : EXPECTED_CHIP}`}
                  >
                    {day < today ? "? " : ""}
                    {cls.name}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <Legend />

      <DayPanel data={data} act={act} day={selected} today={today} settled={settled} />
      <MonthStats data={data} month={month} classes={classes} />
    </Card>
  );
}

function Legend() {
  return (
    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/50">
      {Object.values(STATUS_STYLE).map((style) => (
        <span key={style.label} className="flex items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} /> {style.label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-ink/25" /> Theo lịch
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-red-400" /> Quên tích
      </span>
    </p>
  );
}

/** Check-in for one day: every class due (or logged) that day, plus extra make-up lessons. */
function DayPanel({ data, act, day, today, settled }: { data: AttendanceData; act: Act; day: string; today: string; settled: Map<string, string> }) {
  const [extra, setExtra] = useState(false);
  const active = data.classes.filter((cls) => !cls.archived);
  const shown = data.classes.filter((cls) => isScheduled(cls, day) || data.sessions.some((s) => s.classId === cls.id && s.date === day));
  const others = active.filter((cls) => !shown.includes(cls));

  return (
    <div className="-mx-3 mt-4 border-y-2 border-clay-500/20 bg-cream-50 px-3 py-3 sm:mx-0 sm:mt-5 sm:rounded-xl sm:border-2 sm:p-4">
      <p className="font-draw-display text-lg font-extrabold">
        {longDay(day)}
        {day === today && <span className="ml-2 rounded-full bg-clay-500 px-2 py-0.5 align-middle text-xs text-white">Hôm nay</span>}
      </p>
      {data.classes.length === 0 && <p className="mt-2 text-sm text-ink/50">Tạo lớp ở phía dưới trước đã.</p>}
      {data.classes.length > 0 && shown.length === 0 && <p className="mt-1 text-sm text-ink/50">Hôm nay không có lớp nào theo lịch.</p>}
      <ul className="mt-3 space-y-2">
        {shown.map((cls) => (
          <DayRow
            key={`${cls.id}-${day}`}
            cls={cls}
            day={day}
            session={data.sessions.find((s) => s.classId === cls.id && s.date === day)}
            locked={day <= (settled.get(cls.id) ?? "")}
            invoiceTitle={data.invoices.find((invoice) => invoice.classId === cls.id && invoice.from <= day && day <= invoice.to)?.title}
            act={act}
          />
        ))}
      </ul>
      {others.length > 0 && (
        <div className="mt-3">
          {!extra ? (
            <button onClick={() => setExtra(true)} className="text-sm font-semibold text-clay-600 hover:underline">
              + Thêm buổi dạy bù ngoài lịch
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm text-ink/60">Dạy bù cho:</span>
              {others.map((cls) => (
                <button
                  key={cls.id}
                  onClick={async () => {
                    if (await act({ action: "mark", classId: cls.id, date: day, status: "taught" })) setExtra(false);
                  }}
                  className="rounded-lg border border-cream-200 bg-white px-3 py-1.5 text-sm font-semibold"
                >
                  {cls.name}
                </button>
              ))}
              <button onClick={() => setExtra(false)} className="px-2 text-sm text-ink/50">Hủy</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DayRow({
  cls,
  day,
  session,
  locked,
  invoiceTitle,
  act,
}: {
  cls: TuitionClass;
  day: string;
  session: TuitionSession | undefined;
  locked: boolean;
  invoiceTitle: string | undefined;
  act: Act;
}) {
  const [choosingReason, setChoosingReason] = useState(false);
  const [note, setNote] = useState(session?.note ?? "");
  const [noteFor, setNoteFor] = useState(session?.note);
  // Pick up the saved note after a reload without clobbering what's being typed.
  if (session?.note !== noteFor) {
    setNoteFor(session?.note);
    setNote(session?.note ?? "");
  }
  const mark = (status: string, offReason?: OffReason) => {
    setChoosingReason(false);
    return act({ action: "mark", classId: cls.id, date: day, status, offReason });
  };
  const offSchedule = !cls.weekdays.includes(parseDay(day).getDay());
  const fee = feeOn(cls.rates, day);

  return (
    <li className="rounded-xl bg-white p-2.5 shadow-sm sm:p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{cls.name}</span>
        {session && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[session.status].chip}`}>
            {STATUS_STYLE[session.status].label}
            {session.status === "off" && session.offReason ? ` · ${OFF_REASONS[session.offReason]}` : ""}
            {session.status === "taught" && offSchedule ? " · bù" : ""}
          </span>
        )}
        {session?.status === "taught" && <span className="text-sm text-ink/60">{formatVnd(session.amount)}</span>}
        {locked && <span className="text-xs font-semibold text-ink/50 sm:ml-auto">🔒 Đã chốt{invoiceTitle ? ` vào đợt ${invoiceTitle}` : ""}</span>}
      </div>

      {!locked && !session && !choosingReason && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-[2fr_1fr_1fr]">
          <button
            onClick={() => mark("taught")}
            className="col-span-2 rounded-xl bg-[#3fa535] px-3 py-3 font-bold text-white shadow-sm transition hover:brightness-105 sm:col-span-1"
          >
            ✓ Đã dạy <span className="font-semibold text-white/80">· {fee ? formatVnd(fee) : "chưa đặt giá"}</span>
          </button>
          <button onClick={() => setChoosingReason(true)} className="whitespace-nowrap rounded-xl bg-[#fde0b8] px-2 py-2.5 font-bold text-[#8a4b05]">Nghỉ…</button>
          <button onClick={() => mark("trial")} className="whitespace-nowrap rounded-xl bg-[#f8c9c4] px-2 py-2.5 font-bold text-[#8a1f14]">Dạy thử</button>
        </div>
      )}

      {!locked && session && !choosingReason && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink/50">Đổi thành:</span>
          {session.status !== "taught" && (
            <button onClick={() => mark("taught")} className="rounded-lg border border-cream-200 px-2.5 py-1 text-xs font-semibold">Đã dạy</button>
          )}
          {session.status !== "off" && (
            <button onClick={() => setChoosingReason(true)} className="rounded-lg border border-cream-200 px-2.5 py-1 text-xs font-semibold">Nghỉ</button>
          )}
          {session.status !== "trial" && (
            <button onClick={() => mark("trial")} className="rounded-lg border border-cream-200 px-2.5 py-1 text-xs font-semibold">Dạy thử</button>
          )}
          <button
            onClick={() => window.confirm(`Bỏ điểm danh ${cls.name} ngày này?`) && act({ action: "unmark", classId: cls.id, date: day })}
            className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-red-500"
          >
            Bỏ điểm danh
          </button>
        </div>
      )}

      {choosingReason && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
          <span className="col-span-2 text-sm text-ink/60">Nghỉ vì:</span>
          {(Object.keys(OFF_REASONS) as OffReason[]).map((reason) => (
            <button key={reason} onClick={() => mark("off", reason)} className="rounded-lg bg-[#fde0b8] px-3 py-2.5 text-sm font-bold text-[#8a4b05] sm:py-2">
              {OFF_REASONS[reason]}
            </button>
          ))}
          <button onClick={() => setChoosingReason(false)} className="col-span-2 py-1 text-sm text-ink/50 sm:px-2">Hủy</button>
        </div>
      )}

      {session && (
        <input
          value={note}
          disabled={locked}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => note.trim() !== session.note && act({ action: "set_note", classId: cls.id, date: day, note })}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          placeholder={locked ? "" : "Ghi chú (ôn giữa kỳ, học bù…)"}
          className="mt-2 w-full rounded-lg border border-cream-200 px-3 py-1.5 text-sm outline-none focus:border-clay-500 disabled:border-transparent disabled:bg-transparent disabled:px-0"
        />
      )}
    </li>
  );
}

/** This month at a glance, per class: what was taught and what it's worth. */
function MonthStats({ data, month, classes }: { data: AttendanceData; month: string; classes: TuitionClass[] }) {
  const prefix = month.slice(0, 7);
  const rows = classes
    .map((cls) => {
      const sessions = data.sessions.filter((s) => s.classId === cls.id && s.date.startsWith(prefix));
      const taught = sessions.filter((s) => s.status === "taught");
      return {
        cls,
        taught: taught.length,
        off: sessions.filter((s) => s.status === "off").length,
        hours: sessions.reduce((sum, s) => sum + s.hours, 0),
        amount: taught.reduce((sum, s) => sum + s.amount, 0),
      };
    })
    .filter((row) => row.taught + row.off > 0 || !row.cls.archived);
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="mt-5">
      <p className="text-sm font-bold text-ink/60">Thống kê tháng {Number(prefix.slice(5))}</p>
      <div className="mt-2 overflow-x-auto rounded-xl border border-cream-200">
        <table className="w-full text-sm">
          <thead className="bg-cream-50 text-xs text-ink/50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Lớp</th>
              <th className="px-2 py-2 text-right font-semibold">Buổi dạy</th>
              <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell">Nghỉ</th>
              <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell">Giờ</th>
              <th className="px-3 py-2 text-right font-semibold">Tiền</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cls.id} className="border-t border-cream-200">
                <td className="px-3 py-2 font-semibold">{row.cls.name}</td>
                <td className="px-2 py-2 text-right">{row.taught}</td>
                <td className="hidden px-2 py-2 text-right text-ink/50 sm:table-cell">{row.off}</td>
                <td className="hidden px-2 py-2 text-right text-ink/50 sm:table-cell">{formatHours(row.hours)}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatVnd(row.amount)}</td>
              </tr>
            ))}
            {rows.length > 1 && (
              <tr className="border-t border-cream-200 bg-cream-50 font-bold">
                <td className="px-3 py-2" colSpan={1}>Tổng</td>
                <td className="px-2 py-2 text-right">{rows.reduce((sum, row) => sum + row.taught, 0)}</td>
                <td className="hidden px-2 py-2 text-right sm:table-cell">{rows.reduce((sum, row) => sum + row.off, 0)}</td>
                <td className="hidden px-2 py-2 text-right sm:table-cell">{formatHours(rows.reduce((sum, row) => sum + row.hours, 0))}</td>
                <td className="px-3 py-2 text-right">{formatVnd(total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
