"use client";

import { useState } from "react";
import { WEEK, type SessionStatus, type TuitionClass, type TuitionInvoice, type TuitionSession } from "@/lib/mathQuest/tuition";

// Building blocks shared by the attendance tab (docs/diem-danh-hoc-phi-spec.md).

export interface AttendanceData {
  classes: TuitionClass[];
  sessions: TuitionSession[];
  invoices: TuitionInvoice[];
}

export type Act = (payload: Record<string, unknown>) => Promise<boolean>;

/** The tutor's Google Sheet colours, kept so the calendar reads the same at a glance. */
export const STATUS_STYLE: Record<SessionStatus, { label: string; chip: string; dot: string }> = {
  taught: { label: "Đã dạy", chip: "bg-[#c9ecc0] text-[#1f5a17]", dot: "bg-[#3fa535]" },
  trial: { label: "Dạy thử", chip: "bg-[#f8c9c4] text-[#8a1f14]", dot: "bg-[#e0442f]" },
  off: { label: "Nghỉ", chip: "bg-[#fde0b8] text-[#8a4b05]", dot: "bg-[#f29a1f]" },
};
export const EXPECTED_CHIP = "border border-dashed border-ink/30 text-ink/50";

export function Card({ id, title, hint, right, children }: { id?: string; title?: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-5 scroll-mt-16 rounded-2xl border border-cream-200 bg-white p-3 shadow-sm sm:mt-6 sm:p-5">
      {title && (
        <div className="mb-3 flex items-start gap-2 sm:mb-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-draw-display text-lg font-bold sm:text-xl">{title}</h2>
            {hint && <p className="text-sm text-ink/50">{hint}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A VND amount typed as plain digits, shown with thousands dots ("250.000"). */
export function MoneyInput({ value, onChange, className = "" }: { value: number; onChange: (value: number) => void; className?: string }) {
  return (
    <div className={`flex items-center rounded-lg border border-cream-200 bg-white focus-within:border-clay-500 ${className}`}>
      <input
        value={value ? value.toLocaleString("vi-VN") : ""}
        inputMode="numeric"
        placeholder="250.000"
        onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, "").slice(0, 9)) || 0)}
        className="min-w-0 flex-1 rounded-lg bg-transparent px-3 py-2 text-right font-mono outline-none"
      />
      <span className="pr-3 text-sm text-ink/50">đ</span>
    </div>
  );
}

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (value: number[]) => void }) {
  return (
    <div className="grid grid-cols-7 gap-1 sm:flex">
      {WEEK.map(({ day, short }) => {
        const on = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => onChange(on ? value.filter((item) => item !== day) : [...value, day])}
            className={`h-10 rounded-lg text-sm font-bold transition sm:w-10 ${on ? "bg-clay-500 text-white" : "border border-cream-200 bg-white text-ink/50"}`}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}

export const scheduleLabel = (weekdays: number[]) =>
  weekdays.length ? WEEK.filter(({ day }) => weekdays.includes(day)).map(({ short }) => short).join(" · ") : "Chưa có lịch cố định";

/** Copies the parent message, with a peek at the text before sending it. */
export function CopyMessage({ text, primary = false }: { text: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className={`rounded-lg px-2.5 py-1 text-xs font-bold ${primary ? "bg-clay-500 text-white" : "border border-cream-200 bg-white"}`}
      >
        {copied ? "✓ Đã chép" : "📋 Chép tin nhắn"}
      </button>
      <button onClick={() => setOpen(!open)} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink/50 hover:text-ink">
        {open ? "Ẩn" : "Xem"}
      </button>
      {open && <pre className="mt-1 w-full whitespace-pre-wrap rounded-lg bg-cream-50 p-3 font-draw-body text-sm text-ink/80">{text}</pre>}
    </>
  );
}
