// Attendance and tuition maths shared by the API and the tutor's calendar
// (docs/diem-danh-hoc-phi-spec.md). Days are "YYYY-MM-DD" strings in the
// tutor's local calendar throughout — never Date instants — so a session
// logged at 23:30 can't slide into the next day on the server.

export type SessionStatus = "taught" | "trial" | "off";
export type OffReason = "holiday" | "student" | "tutor" | "other";

export interface TuitionClass {
  id: string;
  name: string;
  weekdays: number[];
  hoursPerSession: number;
  rates: { from: string; fee: number }[];
  startDate: string;
  archived: boolean;
}

export interface TuitionSession {
  classId: string;
  date: string;
  status: SessionStatus;
  offReason: OffReason | null;
  hours: number;
  amount: number;
  note: string;
  invoiceId: string | null;
}

export interface TuitionInvoice {
  id: string;
  classId: string;
  title: string;
  from: string;
  to: string;
  total: number;
  paidAt: string | null;
}

export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const OFF_REASONS: Record<OffReason, string> = { holiday: "Lễ", student: "HS bận", tutor: "Mình bận", other: "Khác" };
/** Monday-first, as Vietnamese calendars are; values are Date#getDay(). */
export const WEEK = [
  { day: 1, short: "T2", long: "Thứ Hai" },
  { day: 2, short: "T3", long: "Thứ Ba" },
  { day: 3, short: "T4", long: "Thứ Tư" },
  { day: 4, short: "T5", long: "Thứ Năm" },
  { day: 5, short: "T6", long: "Thứ Sáu" },
  { day: 6, short: "T7", long: "Thứ Bảy" },
  { day: 0, short: "CN", long: "Chủ nhật" },
];

const pad = (value: number) => String(value).padStart(2, "0");
export const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const parseDay = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};
export const todayKey = () => dayKey(new Date());
export const addDays = (key: string, days: number) => {
  const date = parseDay(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
};
export const weekdayOf = (key: string) => parseDay(key).getDay();
export const lastDayOfMonth = (key: string) => {
  const date = parseDay(key);
  return dayKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};
/** "04/10" */
export const shortDay = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
/** "Thứ Ba, 13/10/2026" */
export const longDay = (key: string) => `${WEEK.find((item) => item.day === weekdayOf(key))!.long}, ${shortDay(key)}/${key.slice(0, 4)}`;

/** "250.000đ" */
export const formatVnd = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;
/** "1,5" — Vietnamese decimal comma. */
export const formatHours = (hours: number) => hours.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

/** The class's fee on a day: the latest rate already in force (or the first one, for days before any). */
export function feeOn(rates: { from: string; fee: number }[], date: string) {
  let fee = rates[0]?.fee ?? 0;
  for (const rate of rates) if (rate.from <= date) fee = rate.fee;
  return fee;
}

/** What a session costs: only a taught day is billed — trials and days off never are. */
export const sessionAmount = (rates: { from: string; fee: number }[], status: SessionStatus, date: string) =>
  status === "taught" ? feeOn(rates, date) : 0;

/** Whether the class is expected on a day by its regular schedule. */
export const isScheduled = (cls: TuitionClass, date: string) =>
  !cls.archived && date >= cls.startDate && cls.weekdays.includes(weekdayOf(date));

/**
 * Scheduled days with nothing logged, from the end of the last closed
 * invoice (anything before it is settled) up to yesterday — today isn't
 * "forgotten" yet.
 */
export function missedDays(cls: TuitionClass, sessions: TuitionSession[], invoices: TuitionInvoice[], today: string) {
  const logged = new Set(sessions.filter((session) => session.classId === cls.id).map((session) => session.date));
  const settled = invoices.filter((invoice) => invoice.classId === cls.id).reduce((max, invoice) => (invoice.to > max ? invoice.to : max), "");
  let day = settled ? addDays(settled, 1) : cls.startDate;
  if (day < cls.startDate) day = cls.startDate;
  const missed: string[] = [];
  for (; day < today; day = addDays(day, 1)) if (isScheduled(cls, day) && !logged.has(day)) missed.push(day);
  return missed;
}

/** "Tháng 10", "Tháng 8+9", "Tháng 12/2026+1/2027" — the label the tutor's sheet used. */
export function periodTitle(from: string, to: string) {
  const months: string[] = [];
  for (let date = parseDay(from.slice(0, 8) + "01"); dayKey(date) <= to; date.setMonth(date.getMonth() + 1)) months.push(dayKey(date));
  const crossesYear = months[0].slice(0, 4) !== months[months.length - 1].slice(0, 4);
  return `Tháng ${months.map((month) => (crossesYear ? `${Number(month.slice(5, 7))}/${month.slice(0, 4)}` : Number(month.slice(5, 7)))).join("+")}`;
}

/** The ready-to-paste message telling the parent what this bill covers. */
export function parentMessage(cls: TuitionClass, title: string, sessions: TuitionSession[]) {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const taught = sorted.filter((session) => session.status === "taught");
  const trial = sorted.filter((session) => session.status === "trial");
  const off = sorted.filter((session) => session.status === "off");
  const total = taught.reduce((sum, session) => sum + session.amount, 0);

  // One "n buổi × giá" term per price, in date order (a raise mid-bill gives two).
  const terms: { fee: number; count: number }[] = [];
  for (const session of taught) {
    const last = terms[terms.length - 1];
    if (last && last.fee === session.amount) last.count += 1;
    else terms.push({ fee: session.amount, count: 1 });
  }

  const lines = [`Chào anh/chị, em gửi học phí ${title.charAt(0).toLowerCase()}${title.slice(1)} của ${cls.name}:`];
  lines.push(`- ${taught.length} buổi: ${taught.map((session) => shortDay(session.date)).join(", ")}`);
  if (trial.length) lines.push(`- Dạy thử (không tính phí): ${trial.map((session) => shortDay(session.date)).join(", ")}`);
  if (off.length) {
    lines.push(
      `- Nghỉ: ${off.map((session) => `${shortDay(session.date)}${session.offReason === "holiday" ? " (lễ)" : ""}`).join(", ")}`
    );
  }
  const breakdown = terms.map((term) => `${term.count} buổi × ${formatVnd(term.fee)}`).join(" + ");
  lines.push(`- Học phí: ${breakdown ? `${breakdown} = ` : ""}${formatVnd(total)}`);
  lines.push("Anh/chị thanh toán giúp em nhé. Em cảm ơn ạ!");
  return lines.join("\n");
}
