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
  parentMessage,
  periodTitle,
  shortDay,
  weekdayOf,
  type TuitionClass,
  type TuitionInvoice,
  type TuitionSession,
} from "@/lib/mathQuest/tuition";
import { settledUntil } from "./Calendar";
import { Card, CopyMessage, MoneyInput, STATUS_STYLE, WeekdayPicker, scheduleLabel, type Act, type AttendanceData } from "./ui";

const dayLabel = (day: string) => `${WEEK.find((item) => item.day === weekdayOf(day))!.short} ${shortDay(day)}`;

/** One class: the bill building up since the last one, closing it, and the bills before. */
export function ClassCard({ cls, data, act, today }: { cls: TuitionClass; data: AttendanceData; act: Act; today: string }) {
  const [editing, setEditing] = useState(false);
  const invoices = data.invoices.filter((invoice) => invoice.classId === cls.id).sort((a, b) => b.to.localeCompare(a.to));

  return (
    <Card
      id={`class-${cls.id}`}
      title={`👥 ${cls.name}${cls.archived ? " (đã ngừng)" : ""}`}
      hint={`${scheduleLabel(cls.weekdays)} · ${formatHours(cls.hoursPerSession)} giờ/buổi · ${formatVnd(feeOn(cls.rates, today))}/buổi`}
      right={
        <button onClick={() => setEditing(!editing)} className="rounded-lg border border-cream-200 bg-white px-3 py-1.5 text-sm font-semibold">
          {editing ? "Đóng" : "⚙️ Sửa lớp"}
        </button>
      }
    >
      {editing && <ClassSettings cls={cls} act={act} today={today} onDone={() => setEditing(false)} />}
      <OpenPeriod cls={cls} data={data} act={act} today={today} />
      {invoices.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-bold text-ink/60">Các đợt đã chốt</p>
          <ul className="mt-2 space-y-2">
            {invoices.map((invoice, index) => (
              <InvoiceRow key={invoice.id} cls={cls} invoice={invoice} data={data} act={act} latest={index === 0} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** Numbered like the tutor's sheet: days off keep their number but cost nothing. */
function SessionTable({ sessions }: { sessions: TuitionSession[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-cream-200">
      <table className="w-full text-sm">
        <tbody>
          {sessions.map((session, index) => (
            <tr key={session.date} className="border-t border-cream-200 first:border-t-0">
              <td className="w-8 px-2 py-1.5 text-center text-xs text-ink/40">{index + 1}</td>
              <td className="whitespace-nowrap px-2 py-1.5">{dayLabel(session.date)}</td>
              <td className="px-2 py-1.5">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[session.status].chip}`}>
                  {STATUS_STYLE[session.status].label}
                  {session.status === "off" && session.offReason ? ` · ${OFF_REASONS[session.offReason]}` : ""}
                </span>
                {session.note && <span className="ml-2 hidden text-xs text-ink/50 sm:inline">{session.note}</span>}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-xs">{session.amount ? session.amount.toLocaleString("vi-VN") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpenPeriod({ cls, data, act, today }: { cls: TuitionClass; data: AttendanceData; act: Act; today: string }) {
  const open = data.sessions.filter((s) => s.classId === cls.id && !s.invoiceId).sort((a, b) => a.date.localeCompare(b.date));
  const [closing, setClosing] = useState(false);
  const [to, setTo] = useState("");
  const [title, setTitle] = useState("");
  const total = open.reduce((sum, s) => sum + s.amount, 0);

  const startClosing = () => {
    const end = lastDayOfMonth(open[0].date);
    setTo(end);
    setTitle(periodTitle(open[0].date, end));
    setClosing(true);
  };
  const included = open.filter((s) => s.date <= to);
  const includedTotal = included.reduce((sum, s) => sum + s.amount, 0);
  // Regular days in the bill's range that were never logged — likely forgotten.
  const unlogged: string[] = [];
  if (closing && to) {
    const settled = settledUntil(data).get(cls.id);
    for (let day = settled && settled >= cls.startDate ? addDays(settled, 1) : cls.startDate; day <= to; day = addDays(day, 1)) {
      if (isScheduled(cls, day) && !data.sessions.some((s) => s.classId === cls.id && s.date === day)) unlogged.push(day);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-sm font-bold text-ink/60">Đang tính (chưa chốt)</p>
        {open.length > 0 && (
          <p className="ml-auto text-sm">
            {open.filter((s) => s.status === "taught").length} buổi dạy · <span className="font-bold">{formatVnd(total)}</span>
          </p>
        )}
      </div>
      {open.length === 0 ? (
        <p className="mt-2 rounded-xl bg-cream-50 px-3 py-3 text-sm text-ink/50">Chưa có buổi nào. Điểm danh trên lịch ở trên nhé.</p>
      ) : (
        <div className="mt-2">
          <SessionTable sessions={open} />
          {!closing ? (
            <button onClick={startClosing} className="mt-3 w-full rounded-xl bg-clay-500 py-2.5 font-bold text-white sm:w-auto sm:px-5">
              🧾 Chốt đợt thu ▸
            </button>
          ) : (
            <div className="mt-3 rounded-xl border-2 border-clay-500/30 bg-cream-50 p-3">
              <p className="font-bold">Chốt đợt thu</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-ink/60">Tính đến hết ngày</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (!next) return;
                      setTo(next);
                      setTitle(periodTitle(open[0].date, next));
                    }}
                    className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 outline-none focus:border-clay-500"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-ink/60">Tên đợt</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 outline-none focus:border-clay-500"
                  />
                </label>
              </div>
              {unlogged.length > 0 && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  ⚠️ {unlogged.length} buổi theo lịch chưa điểm danh: {unlogged.map(shortDay).join(", ")}. Chốt luôn thì các buổi này không được tính.
                </p>
              )}
              {to > today && <p className="mt-2 text-xs text-ink/50">Ngày chốt ở tương lai: buổi nào điểm danh sau khi chốt mà rơi vào khoảng này sẽ bị khóa.</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  disabled={included.length === 0}
                  onClick={async () => {
                    if (await act({ action: "close_invoice", classId: cls.id, to, title })) setClosing(false);
                  }}
                  className="rounded-xl bg-clay-500 px-4 py-2 font-bold text-white disabled:opacity-50"
                >
                  Chốt {included.length} buổi · {formatVnd(includedTotal)}
                </button>
                <button onClick={() => setClosing(false)} className="px-2 text-sm text-ink/50">Hủy</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InvoiceRow({ cls, invoice, data, act, latest }: { cls: TuitionClass; invoice: TuitionInvoice; data: AttendanceData; act: Act; latest: boolean }) {
  const [open, setOpen] = useState(false);
  const sessions = data.sessions.filter((s) => s.invoiceId === invoice.id).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <li className="rounded-xl bg-cream-50 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <span className="font-semibold">{invoice.title}</span>
          <span className="ml-2 text-xs text-ink/50">
            {shortDay(invoice.from)} → {shortDay(invoice.to)} {open ? "▴" : "▾"}
          </span>
        </button>
        <span className="font-bold">{formatVnd(invoice.total)}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${invoice.paidAt ? "bg-sage-100 text-sage-600" : "bg-gold-100 text-gold-600"}`}>
          {invoice.paidAt ? `✓ Đã trả ${shortDay(dayKey(new Date(invoice.paidAt)))}` : "Chưa trả"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <CopyMessage text={parentMessage(cls, invoice.title, sessions)} primary={!invoice.paidAt} />
        <button
          onClick={() => act({ action: "set_paid", invoiceId: invoice.id, paid: !invoice.paidAt })}
          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${invoice.paidAt ? "border border-cream-200 bg-white text-ink/60" : "bg-sage-500 text-white"}`}
        >
          {invoice.paidAt ? "↺ Chưa trả" : "✓ Đã trả"}
        </button>
        {latest && (
          <button
            onClick={() =>
              window.confirm(`Mở lại đợt "${invoice.title}"? Các buổi trong đợt quay về "đang tính" để sửa, rồi chốt lại sau.`) &&
              act({ action: "reopen_invoice", invoiceId: invoice.id })
            }
            className="rounded-lg px-2 py-1 text-xs font-semibold text-ink/50 hover:text-ink"
          >
            Mở lại đợt
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2">
          <SessionTable sessions={sessions} />
        </div>
      )}
    </li>
  );
}

function ClassSettings({ cls, act, today, onDone }: { cls: TuitionClass; act: Act; today: string; onDone: () => void }) {
  const [name, setName] = useState(cls.name);
  const [weekdays, setWeekdays] = useState(cls.weekdays);
  const [hours, setHours] = useState(cls.hoursPerSession);
  const [startDate, setStartDate] = useState(cls.startDate);
  const [rateFrom, setRateFrom] = useState(today);
  const [rateFee, setRateFee] = useState(0);

  return (
    <div className="mb-5 space-y-4 rounded-xl border border-cream-200 bg-cream-50 p-3">
      <ClassFields name={name} setName={setName} weekdays={weekdays} setWeekdays={setWeekdays} hours={hours} setHours={setHours} startDate={startDate} setStartDate={setStartDate} />
      <button
        onClick={async () => {
          if (await act({ action: "save_class", classId: cls.id, name, weekdays, hoursPerSession: hours, startDate })) onDone();
        }}
        className="rounded-lg bg-clay-500 px-4 py-2 text-sm font-bold text-white"
      >
        Lưu thông tin lớp
      </button>

      <div>
        <p className="text-sm font-bold text-ink/60">Học phí một buổi (cả lớp)</p>
        <p className="text-xs text-ink/50">Tăng giá: thêm mức mới kèm ngày áp dụng. Buổi trước ngày đó giữ giá cũ; đợt đã chốt không bị tính lại.</p>
        <ul className="mt-2 space-y-1">
          {cls.rates.map((rate) => (
            <li key={rate.from} className="flex items-center gap-2 text-sm">
              <span className="w-24 text-ink/60">từ {shortDay(rate.from)}/{rate.from.slice(2, 4)}</span>
              <span className="font-semibold">{formatVnd(rate.fee)}</span>
              {cls.rates.length > 1 && (
                <button
                  onClick={() => window.confirm(`Xóa mức ${formatVnd(rate.fee)} từ ${shortDay(rate.from)}?`) && act({ action: "remove_rate", classId: cls.id, from: rate.from })}
                  className="text-xs text-red-500"
                >
                  Xóa
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink/60">Mức mới từ</span>
          <input type="date" value={rateFrom} onChange={(event) => setRateFrom(event.target.value)} className="rounded-lg border border-cream-200 bg-white px-2 py-1.5 text-sm" />
          <MoneyInput value={rateFee} onChange={setRateFee} className="w-36" />
          <button
            disabled={!rateFee || !rateFrom}
            onClick={async () => {
              if (await act({ action: "add_rate", classId: cls.id, from: rateFrom, fee: rateFee })) setRateFee(0);
            }}
            className="rounded-lg bg-clay-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            Thêm
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-cream-200 pt-3">
        <button onClick={() => act({ action: "archive_class", classId: cls.id, archived: !cls.archived })} className="rounded-lg border border-cream-200 bg-white px-3 py-1.5 text-xs font-semibold">
          {cls.archived ? "Dạy lại lớp này" : "Ngừng dạy (ẩn khỏi lịch, giữ lịch sử)"}
        </button>
        <button
          onClick={() => window.confirm(`Xóa hẳn lớp ${cls.name} cùng toàn bộ điểm danh và các đợt thu? Không khôi phục được.`) && act({ action: "delete_class", classId: cls.id })}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-500"
        >
          Xóa lớp
        </button>
      </div>
    </div>
  );
}

function ClassFields(props: {
  name: string;
  setName: (value: string) => void;
  weekdays: number[];
  setWeekdays: (value: number[]) => void;
  hours: number;
  setHours: (value: number) => void;
  startDate: string;
  setStartDate: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="text-ink/60">Tên lớp</span>
        <input
          value={props.name}
          onChange={(event) => props.setName(event.target.value)}
          placeholder="Nhật + Vinh"
          className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 outline-none focus:border-clay-500"
        />
      </label>
      <label className="text-sm">
        <span className="text-ink/60">Bắt đầu dạy từ</span>
        <input
          type="date"
          value={props.startDate}
          onChange={(event) => event.target.value && props.setStartDate(event.target.value)}
          className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 outline-none focus:border-clay-500"
        />
      </label>
      <div className="text-sm">
        <span className="text-ink/60">Lịch cố định</span>
        <div className="mt-1">
          <WeekdayPicker value={props.weekdays} onChange={props.setWeekdays} />
        </div>
      </div>
      <div className="text-sm">
        <span className="text-ink/60">Giờ một buổi</span>
        <div className="mt-1 flex items-center gap-1">
          <button type="button" onClick={() => props.setHours(Math.max(0.5, props.hours - 0.5))} className="h-9 w-9 rounded-lg border border-cream-200 bg-white font-bold">−</button>
          <span className="w-14 text-center font-semibold">{formatHours(props.hours)} giờ</span>
          <button type="button" onClick={() => props.setHours(Math.min(6, props.hours + 0.5))} className="h-9 w-9 rounded-lg border border-cream-200 bg-white font-bold">+</button>
        </div>
      </div>
    </div>
  );
}

export function NewClassForm({ act, today, first }: { act: Act; today: string; first: boolean }) {
  const [open, setOpen] = useState(first);
  const [name, setName] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [hours, setHours] = useState(1.5);
  const [startDate, setStartDate] = useState(today);
  const [fee, setFee] = useState(0);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-6 w-full rounded-2xl border-2 border-dashed border-cream-200 py-4 font-bold text-ink/50 hover:border-clay-500 hover:text-clay-600">
        ➕ Thêm lớp
      </button>
    );
  }
  return (
    <Card id="new-class" title="➕ Thêm lớp" hint="Một lớp = những bé học chung và một phụ huynh trả tiền (ví dụ “Nhật + Vinh”).">
      <div className="space-y-3">
        <ClassFields name={name} setName={setName} weekdays={weekdays} setWeekdays={setWeekdays} hours={hours} setHours={setHours} startDate={startDate} setStartDate={setStartDate} />
        <label className="block text-sm">
          <span className="text-ink/60">Học phí một buổi (cả lớp)</span>
          <MoneyInput value={fee} onChange={setFee} className="mt-1 sm:w-56" />
        </label>
        <div className="flex gap-2">
          <button
            disabled={!name.trim() || !fee}
            onClick={async () => {
              if (await act({ action: "save_class", name, weekdays, hoursPerSession: hours, startDate, fee })) {
                setName("");
                setWeekdays([]);
                setFee(0);
                setOpen(false);
              }
            }}
            className="rounded-xl bg-clay-500 px-5 py-2.5 font-bold text-white disabled:opacity-50"
          >
            Tạo lớp
          </button>
          {!first && (
            <button onClick={() => setOpen(false)} className="px-2 text-sm text-ink/50">Hủy</button>
          )}
        </div>
      </div>
    </Card>
  );
}
