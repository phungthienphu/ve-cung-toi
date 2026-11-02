import {
  OFF_REASONS,
  WEEK,
  dayKey,
  formatHours,
  formatVnd,
  parseDay,
  shortDay,
  vndInWords,
  weekdayOf,
  type BillSettings,
  type TuitionClass,
  type TuitionInvoice,
  type TuitionSession,
} from "@/lib/mathQuest/tuition";

// The tuition bill for one closed invoice, drawn on a canvas so the preview
// is exactly the PNG the tutor saves or shares to the parent on Zalo: header
// with bill number and date, who/what/when, one row per session (days off
// and trials listed at 0đ so nothing looks missing), the total in figures
// and in words, a "đã thanh toán" stamp once paid, the tutor's note.

export interface BillInput {
  cls: TuitionClass;
  invoice: TuitionInvoice;
  sessions: TuitionSession[];
  settings: BillSettings;
}

const W = 1080;
const PAD = 72;
const SCALE = 2; // drawn at 2× so the text stays sharp when the parent zooms in
const INK = "#2f2419";
const MUTED = "#7a6a5a";
const LINE = "#eadfca";
const CREAM = "#fbf6ec";
const CLAY = "#c1613f";
const CLAY_DARK = "#8c4028";
const PAID = "#3f7a37";

const fontOf = (selector: string, fallback: string) => {
  const element = document.querySelector(selector);
  return element ? getComputedStyle(element).fontFamily : fallback;
};

const fullDate = (key: string) => `${shortDay(key)}/${key.slice(0, 4)}`;

/** "HP-2610-3F2A": year+month of the period end, then the invoice id's tail. */
export const billNumber = (invoice: TuitionInvoice) => `HP-${invoice.to.slice(2, 4)}${invoice.to.slice(5, 7)}-${invoice.id.slice(-4).toUpperCase()}`;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

function rowLabel(cls: TuitionClass, session: TuitionSession) {
  if (session.status === "trial") return "Buổi dạy thử (miễn phí)";
  if (session.status === "off") return `Nghỉ${session.offReason ? ` · ${OFF_REASONS[session.offReason].toLowerCase()}` : ""} (không tính phí)`;
  return cls.weekdays.includes(weekdayOf(session.date)) ? "Buổi học" : "Buổi học bù";
}

export async function renderBill({ cls, invoice, sessions, settings }: BillInput): Promise<Blob> {
  const display = fontOf(".font-draw-display", "system-ui, sans-serif");
  const body = fontOf("main", "system-ui, sans-serif");
  await Promise.all([
    document.fonts.load(`800 60px ${display}`, "PHIẾU BÁO HỌC PHÍ"),
    document.fonts.load(`700 40px ${display}`, "Tổng cộng 0123456789đ"),
    document.fonts.load(`400 26px ${body}`, "Buổi học bù nghỉ lễ ắằẳẵặ ộ ữ"),
    document.fonts.load(`700 26px ${body}`, "Buổi học bù nghỉ lễ ắằẳẵặ ộ ữ"),
    document.fonts.load(`italic 500 24px ${body}`, "Bằng chữ"),
  ]).catch(() => undefined);

  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const taught = sorted.filter((s) => s.status === "taught");
  const total = taught.reduce((sum, s) => sum + s.amount, 0);
  const hours = taught.reduce((sum, s) => sum + s.hours, 0);
  const terms: { fee: number; count: number }[] = [];
  for (const session of taught) {
    const last = terms[terms.length - 1];
    if (last && last.fee === session.amount) last.count += 1;
    else terms.push({ fee: session.amount, count: 1 });
  }
  const tutor = settings.tutorName.trim();

  // Measure everything that wraps before sizing the canvas.
  const measure = document.createElement("canvas").getContext("2d")!;
  const contentW = W - PAD * 2;
  const col = { no: PAD + 24, date: PAD + 96, label: PAD + 330, amount: W - PAD - 24 };
  measure.font = `500 21px ${body}`;
  const rows = sorted.map((session) => {
    const note = session.note ? wrap(measure, session.note, col.amount - col.label - 200) : [];
    return { session, note, height: 64 + note.length * 28 };
  });
  measure.font = `500 24px ${body}`;
  const noteLines = settings.note.trim() ? wrap(measure, settings.note.trim(), contentW - 64) : [];

  const headerH = 300;
  const infoH = 190;
  const tableH = 60 + rows.reduce((sum, row) => sum + row.height, 0);
  const termsH = Math.max(terms.length, 1) * 40;
  const summaryH = 48 + 52 + termsH + 12 + 92 + 42 + 40;
  const paidH = invoice.paidAt ? 170 : 0;
  const noteH = noteLines.length ? 76 + noteLines.length * 36 : 0;
  const footerH = 220;
  const H = headerH + infoH + tableH + summaryH + paidH + noteH + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = CLAY;
  ctx.fillRect(0, 0, W, 14);
  ctx.fillRect(0, H - 14, W, 14);

  // Header: who issues it, the title, the period; number and date on the right.
  let y = 96;
  ctx.textAlign = "left";
  ctx.fillStyle = CLAY;
  ctx.font = `700 24px ${body}`;
  ctx.fillText((tutor ? `Gia sư ${tutor}` : "Gia sư Toán").toUpperCase(), PAD, y);
  ctx.fillStyle = INK;
  ctx.font = `800 64px ${display}`;
  ctx.fillText("PHIẾU BÁO HỌC PHÍ", PAD, y + 76);
  ctx.fillStyle = MUTED;
  ctx.font = `600 28px ${body}`;
  ctx.fillText(`${invoice.title} · ${fullDate(invoice.from)} – ${fullDate(invoice.to)}`, PAD, y + 124);

  ctx.textAlign = "right";
  ctx.fillStyle = MUTED;
  ctx.font = `600 20px ${body}`;
  ctx.fillText("SỐ PHIẾU", W - PAD, y - 4);
  ctx.fillStyle = INK;
  ctx.font = `700 28px ${body}`;
  ctx.fillText(billNumber(invoice), W - PAD, y + 32);
  ctx.fillStyle = MUTED;
  ctx.font = `600 20px ${body}`;
  ctx.fillText("NGÀY LẬP", W - PAD, y + 76);
  ctx.fillStyle = INK;
  ctx.font = `700 26px ${body}`;
  ctx.fillText(fullDate(dayKey(new Date(invoice.createdAt))), W - PAD, y + 110);

  y = headerH - 40;
  ctx.fillStyle = LINE;
  ctx.fillRect(PAD, y, contentW, 2);

  // Who / schedule / unit price, two columns.
  y += 56;
  const info: [string, string][] = [
    ["Học sinh", cls.name],
    ["Lịch học", `${WEEK.filter(({ day }) => cls.weekdays.includes(day)).map(({ short }) => short).join(", ") || "Theo thỏa thuận"} · ${formatHours(cls.hoursPerSession)} giờ/buổi`],
    ["Kỳ thu", `${fullDate(invoice.from)} – ${fullDate(invoice.to)}`],
    ["Đơn giá", terms.length ? [...new Set(terms.map((term) => formatVnd(term.fee)))].join(" / ") + " / buổi" : "—"],
  ];
  info.forEach(([label, value], index) => {
    const x = index % 2 === 0 ? PAD : PAD + contentW / 2 + 12;
    const rowY = y + Math.floor(index / 2) * 70;
    ctx.textAlign = "left";
    ctx.fillStyle = MUTED;
    ctx.font = `600 20px ${body}`;
    ctx.fillText(label.toUpperCase(), x, rowY);
    ctx.fillStyle = INK;
    ctx.font = `700 28px ${body}`;
    ctx.fillText(value, x, rowY + 36, contentW / 2 - 24);
  });

  // Session table.
  y = headerH + infoH;
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.roundRect(PAD, y, contentW, 60, 12);
  ctx.fill();
  ctx.fillStyle = CLAY_DARK;
  ctx.font = `700 21px ${body}`;
  ctx.textAlign = "left";
  ctx.fillText("STT", col.no - 8, y + 38);
  ctx.fillText("NGÀY HỌC", col.date, y + 38);
  ctx.fillText("NỘI DUNG", col.label, y + 38);
  ctx.textAlign = "right";
  ctx.fillText("THÀNH TIỀN", col.amount, y + 38);
  y += 60;

  rows.forEach(({ session, note, height }, index) => {
    const muted = session.status !== "taught";
    if (index % 2 === 1) {
      ctx.fillStyle = "#fdfaf4";
      ctx.fillRect(PAD, y, contentW, height);
    }
    const base = y + 41;
    ctx.fillStyle = muted ? MUTED : INK;
    ctx.textAlign = "center";
    ctx.font = `600 24px ${body}`;
    ctx.fillText(String(index + 1), col.no + 10, base);
    ctx.textAlign = "left";
    const weekday = WEEK.find((item) => item.day === parseDay(session.date).getDay())!.short;
    ctx.fillText(`${weekday}, ${fullDate(session.date)}`, col.date, base);
    ctx.font = `${muted ? 500 : 600} 24px ${body}`;
    ctx.fillText(rowLabel(cls, session), col.label, base, col.amount - col.label - 190);
    ctx.fillStyle = MUTED;
    ctx.font = `italic 500 21px ${body}`;
    note.forEach((line, lineIndex) => ctx.fillText(line, col.label, base + 30 + lineIndex * 28));
    ctx.textAlign = "right";
    ctx.fillStyle = muted ? MUTED : INK;
    ctx.font = `${muted ? 500 : 700} 24px ${body}`;
    ctx.fillText(session.amount ? formatVnd(session.amount) : "0đ", col.amount, base);
    y += height;
    ctx.fillStyle = LINE;
    ctx.fillRect(PAD, y - 1, contentW, 1);
  });

  // Summary: counts, price breakdown, the total in figures and words.
  y += 48;
  const offCount = sorted.filter((s) => s.status === "off").length;
  const trialCount = sorted.filter((s) => s.status === "trial").length;
  const facts = [`${taught.length} buổi học · ${formatHours(hours)} giờ`];
  if (offCount) facts.push(`${offCount} buổi nghỉ`);
  if (trialCount) facts.push(`${trialCount} buổi dạy thử`);
  ctx.textAlign = "right";
  ctx.fillStyle = MUTED;
  ctx.font = `600 24px ${body}`;
  ctx.fillText(facts.join(" · "), W - PAD, y, contentW);
  y += 52;
  terms.forEach((term, index) => {
    ctx.fillStyle = INK;
    ctx.font = `600 26px ${body}`;
    ctx.fillText(`${term.count} buổi × ${formatVnd(term.fee)} = ${formatVnd(term.count * term.fee)}`, W - PAD, y + index * 40);
  });
  y += termsH + 12 - 28;

  ctx.fillStyle = CLAY;
  ctx.beginPath();
  ctx.roundRect(PAD, y, contentW, 92, 18);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.font = `800 30px ${display}`;
  ctx.fillText("TỔNG CỘNG", PAD + 32, y + 59);
  ctx.textAlign = "right";
  ctx.font = `800 48px ${display}`;
  ctx.fillText(formatVnd(total), W - PAD - 32, y + 64);
  y += 92 + 42;
  ctx.fillStyle = MUTED;
  ctx.font = `italic 500 24px ${body}`;
  ctx.fillText(`Bằng chữ: ${vndInWords(total)}.`, W - PAD, y, contentW);

  y += 40;

  // Paid: a receipt stamp in its own band, with the date spelled out beside it.
  if (invoice.paidAt) {
    const paidDay = fullDate(dayKey(new Date(invoice.paidAt)));
    ctx.save();
    ctx.translate(PAD + 180, y + 70);
    ctx.rotate(-0.12);
    ctx.strokeStyle = PAID;
    ctx.fillStyle = PAID;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(-170, -56, 340, 112, 16);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-160, -46, 320, 92, 10);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = `800 38px ${display}`;
    ctx.fillText("ĐÃ THANH TOÁN", 0, 8);
    ctx.font = `700 20px ${body}`;
    ctx.fillText(paidDay, 0, 36);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.fillStyle = PAID;
    ctx.font = `700 26px ${body}`;
    ctx.fillText(`Đã nhận đủ ${formatVnd(total)}`, PAD + 400, y + 62);
    ctx.fillStyle = MUTED;
    ctx.font = `500 22px ${body}`;
    ctx.fillText(`ngày ${paidDay}`, PAD + 400, y + 96);
    y += paidH;
  }

  // The tutor's note (payment details, reminders).
  if (noteLines.length) {
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.roundRect(PAD, y, contentW, noteH - 20, 16);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = CLAY_DARK;
    ctx.font = `700 20px ${body}`;
    ctx.fillText("GHI CHÚ", PAD + 32, y + 40);
    ctx.fillStyle = INK;
    ctx.font = `500 24px ${body}`;
    noteLines.forEach((line, index) => ctx.fillText(line, PAD + 32, y + 78 + index * 36));
    y += noteH;
  }

  // Thanks on the left, the issuer on the right.
  y += 56;
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `700 26px ${body}`;
  ctx.fillText("Cảm ơn quý phụ huynh đã tin tưởng!", PAD, y + 40);
  ctx.fillStyle = MUTED;
  ctx.font = `500 22px ${body}`;
  ctx.fillText(invoice.paidAt ? "Phiếu này xác nhận học phí đã được thanh toán." : "Kính mong phụ huynh thanh toán giúp em ạ.", PAD, y + 76);
  ctx.textAlign = "center";
  const signX = W - PAD - 130;
  ctx.fillStyle = MUTED;
  ctx.font = `600 20px ${body}`;
  ctx.fillText("NGƯỜI LẬP PHIẾU", signX, y);
  ctx.fillStyle = INK;
  ctx.font = `700 34px ${display}`;
  ctx.fillText(tutor || "Gia sư", signX, y + 64, 300);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png"));
}

/** "Nhật + Vinh", "Tháng 10" → "hoc-phi-nhat-vinh-thang-10.png" */
export function billFileName(cls: TuitionClass, invoice: TuitionInvoice) {
  const slug = `${cls.name} ${invoice.title}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `hoc-phi-${slug || "phieu"}.png`;
}
