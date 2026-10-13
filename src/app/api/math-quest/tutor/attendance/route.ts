import { NextResponse } from "next/server";
import { MqClass, MqInvoice, MqSession, type ClassDoc } from "@/lib/models/Tuition";
import { isId, tutorGuard } from "@/lib/mathQuest/tutorApi";
import { DATE_PATTERN, OFF_REASONS, sessionAmount, type OffReason } from "@/lib/mathQuest/tuition";

// The tutor's attendance book (docs/diem-danh-hoc-phi-spec.md). GET: every
// class, session and invoice — one tutor's handful of classes stays small.
// POST { action, ... }: manage classes and prices, log days, close and
// settle invoices. Sessions inside an invoice are frozen until it's reopened.

export async function GET() {
  const denied = await tutorGuard();
  if (denied) return denied;
  const [classes, sessions, invoices] = await Promise.all([
    MqClass.find().sort({ createdAt: 1 }).lean(),
    MqSession.find().sort({ date: 1 }).lean(),
    MqInvoice.find().sort({ to: 1 }).lean(),
  ]);
  return NextResponse.json({
    classes: classes.map((cls) => ({
      id: String(cls._id),
      name: cls.name,
      weekdays: cls.weekdays,
      hoursPerSession: cls.hoursPerSession,
      rates: cls.rates.map(({ from, fee }) => ({ from, fee })),
      startDate: cls.startDate,
      archived: cls.archived,
    })),
    sessions: sessions.map((session) => ({
      classId: String(session.classId),
      date: session.date,
      status: session.status,
      offReason: session.offReason,
      hours: session.hours,
      amount: session.amount,
      note: session.note,
      invoiceId: session.invoiceId ? String(session.invoiceId) : null,
    })),
    invoices: invoices.map((invoice) => ({
      id: String(invoice._id),
      classId: String(invoice.classId),
      title: invoice.title,
      from: invoice.from,
      to: invoice.to,
      total: invoice.total,
      paidAt: invoice.paidAt,
    })),
  });
}

const isDay = (value: unknown): value is string => typeof value === "string" && DATE_PATTERN.test(value);
const cleanText = (value: unknown, max: number) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);

/** Re-price the class's open (not yet invoiced) sessions after its rates change. */
async function repriceOpen(cls: ClassDoc & { _id: unknown }) {
  const open = await MqSession.find({ classId: cls._id, invoiceId: null }).lean();
  const writes = open
    .map((session) => ({ session, amount: sessionAmount(cls.rates, session.status, session.date) }))
    .filter(({ session, amount }) => session.amount !== amount)
    .map(({ session, amount }) => ({ updateOne: { filter: { _id: session._id }, update: { $set: { amount } } } }));
  if (writes.length) await MqSession.bulkWrite(writes);
}

export async function POST(req: Request) {
  const denied = await tutorGuard();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fail = (error: string) => NextResponse.json({ error }, { status: 400 });
  const ok = () => NextResponse.json({ ok: true });

  const findClass = async () => (isId(body.classId) ? MqClass.findById(body.classId) : null);
  const readFee = () => {
    const fee = Math.round(Number(body.fee));
    return Number.isFinite(fee) && fee >= 0 && fee <= 100_000_000 ? fee : null;
  };

  switch (body.action) {
    case "save_class": {
      const name = cleanText(body.name, 40);
      const weekdays = Array.isArray(body.weekdays) ? [...new Set(body.weekdays.map(Number))].filter((day) => day >= 0 && day <= 6 && Number.isInteger(day)) : [];
      const hours = Number(body.hoursPerSession);
      if (!name) return fail("Nhập tên lớp.");
      if (!(hours > 0 && hours <= 12)) return fail("Số giờ một buổi không hợp lệ.");
      if (!isDay(body.startDate)) return fail("Chọn ngày bắt đầu.");
      const fields = { name, weekdays: weekdays.sort(), hoursPerSession: hours, startDate: body.startDate };
      if (body.classId === undefined) {
        const fee = readFee();
        if (fee === null) return fail("Học phí một buổi không hợp lệ.");
        await MqClass.create({ ...fields, rates: [{ from: body.startDate, fee }] });
        return ok();
      }
      const cls = await findClass();
      if (!cls) return fail("Không tìm thấy lớp.");
      cls.set(fields);
      await cls.save();
      return ok();
    }

    case "add_rate": {
      const cls = await findClass();
      const fee = readFee();
      if (!cls) return fail("Không tìm thấy lớp.");
      if (!isDay(body.from)) return fail("Chọn ngày áp dụng.");
      if (fee === null) return fail("Học phí một buổi không hợp lệ.");
      const rates = cls.rates.filter((rate) => rate.from !== body.from).map(({ from, fee }) => ({ from, fee }));
      rates.push({ from: body.from, fee });
      cls.set({ rates: rates.sort((a, b) => a.from.localeCompare(b.from)) });
      await cls.save();
      await repriceOpen(cls);
      return ok();
    }

    case "remove_rate": {
      const cls = await findClass();
      if (!cls) return fail("Không tìm thấy lớp.");
      if (cls.rates.length <= 1) return fail("Lớp cần ít nhất một mức học phí.");
      cls.set({ rates: cls.rates.filter((rate) => rate.from !== body.from).map(({ from, fee }) => ({ from, fee })) });
      await cls.save();
      await repriceOpen(cls);
      return ok();
    }

    case "archive_class": {
      const cls = await findClass();
      if (!cls) return fail("Không tìm thấy lớp.");
      cls.set({ archived: Boolean(body.archived) });
      await cls.save();
      return ok();
    }

    case "delete_class": {
      if (!isId(body.classId)) return fail("Không tìm thấy lớp.");
      await Promise.all([
        MqClass.deleteOne({ _id: body.classId }),
        MqSession.deleteMany({ classId: body.classId }),
        MqInvoice.deleteMany({ classId: body.classId }),
      ]);
      return ok();
    }

    case "mark": {
      const cls = await findClass();
      if (!cls) return fail("Không tìm thấy lớp.");
      if (!isDay(body.date)) return fail("Ngày không hợp lệ.");
      const status = body.status;
      if (status !== "taught" && status !== "trial" && status !== "off") return fail("Trạng thái không hợp lệ.");
      const offReason = status === "off" ? (String(body.offReason) in OFF_REASONS ? (body.offReason as OffReason) : "other") : null;
      // A day inside a closed bill's range is settled, logged or not.
      if (await MqInvoice.exists({ classId: cls._id, to: { $gte: body.date } })) return fail("Ngày này thuộc đợt thu đã chốt — mở lại đợt để sửa.");
      await MqSession.updateOne(
        { classId: cls._id, date: body.date },
        {
          $set: {
            status,
            offReason,
            hours: status === "off" ? 0 : cls.hoursPerSession,
            amount: sessionAmount(cls.rates, status, body.date),
            ...(body.note !== undefined ? { note: cleanText(body.note, 200) } : {}),
          },
          $setOnInsert: { invoiceId: null },
        },
        { upsert: true }
      );
      return ok();
    }

    case "set_note": {
      if (!isId(body.classId) || !isDay(body.date)) return fail("Không tìm thấy buổi học.");
      await MqSession.updateOne({ classId: body.classId, date: body.date }, { $set: { note: cleanText(body.note, 200) } });
      return ok();
    }

    case "unmark": {
      if (!isId(body.classId) || !isDay(body.date)) return fail("Không tìm thấy buổi học.");
      await MqSession.deleteOne({ classId: body.classId, date: body.date, invoiceId: null });
      return ok();
    }

    case "close_invoice": {
      const cls = await findClass();
      if (!cls) return fail("Không tìm thấy lớp.");
      if (!isDay(body.to)) return fail("Chọn ngày chốt.");
      const sessions = await MqSession.find({ classId: cls._id, invoiceId: null, date: { $lte: body.to } }).sort({ date: 1 }).lean();
      if (sessions.length === 0) return fail("Chưa có buổi nào để chốt.");
      const title = cleanText(body.title, 40) || "Học phí";
      const invoice = await MqInvoice.create({
        classId: cls._id,
        title,
        from: sessions[0].date,
        to: body.to,
        total: sessions.reduce((sum, session) => sum + session.amount, 0),
      });
      await MqSession.updateMany({ _id: { $in: sessions.map((session) => session._id) } }, { $set: { invoiceId: invoice._id } });
      return ok();
    }

    case "reopen_invoice": {
      if (!isId(body.invoiceId)) return fail("Không tìm thấy đợt thu.");
      const invoice = await MqInvoice.findById(body.invoiceId);
      if (!invoice) return fail("Không tìm thấy đợt thu.");
      // Only the latest bill can be reopened: an older one would leave a gap
      // the next bill's "everything open up to a date" can't cover cleanly.
      if (await MqInvoice.exists({ classId: invoice.classId, to: { $gt: invoice.to } })) return fail("Chỉ mở lại được đợt thu mới nhất.");
      await MqSession.updateMany({ invoiceId: invoice._id }, { $set: { invoiceId: null } });
      await invoice.deleteOne();
      const cls = await MqClass.findById(invoice.classId);
      if (cls) await repriceOpen(cls);
      return ok();
    }

    case "set_paid": {
      if (!isId(body.invoiceId)) return fail("Không tìm thấy đợt thu.");
      await MqInvoice.updateOne({ _id: body.invoiceId }, { $set: { paidAt: body.paid ? new Date() : null } });
      return ok();
    }

    default:
      return fail("Thao tác không hợp lệ.");
  }
}
