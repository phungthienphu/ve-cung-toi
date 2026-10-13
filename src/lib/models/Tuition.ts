import mongoose, { Schema, type Model, type Types } from "mongoose";

// The tutor's attendance book and tuition bills (docs/diem-danh-hoc-phi-spec.md).
// A class is whoever is taught together and billed to one parent; it has
// nothing to do with Math Quest student accounts.
//
// Document shapes are written out by hand, like models/MathQuest.ts.

export type SessionStatus = "taught" | "trial" | "off";
export type OffReason = "holiday" | "student" | "tutor" | "other";

export interface ClassDoc {
  name: string;
  /** Regular days, as Date#getDay() (0 = Chủ nhật … 6 = Thứ 7). */
  weekdays: number[];
  hoursPerSession: number;
  /** Fee for one session of the whole class, each from a day on; sorted by `from`. */
  rates: { from: string; fee: number }[];
  /** "YYYY-MM-DD": no expected sessions before this. */
  startDate: string;
  archived: boolean;
  createdAt: Date;
}

export interface SessionDoc {
  classId: Types.ObjectId;
  /** Local calendar day "YYYY-MM-DD" — a day, not an instant, so no timezone drift. */
  date: string;
  status: SessionStatus;
  offReason: OffReason | null;
  hours: number;
  /** What the day costs; re-priced from the class rates until an invoice freezes it. */
  amount: number;
  note: string;
  invoiceId: Types.ObjectId | null;
}

export interface InvoiceDoc {
  classId: Types.ObjectId;
  title: string;
  from: string;
  to: string;
  total: number;
  paidAt: Date | null;
  createdAt: Date;
}

const ClassSchema = new Schema<ClassDoc>(
  {
    name: { type: String, required: true },
    weekdays: { type: [Number], default: [] },
    hoursPerSession: { type: Number, default: 1.5 },
    rates: { type: [{ _id: false, from: String, fee: Number }], default: [] },
    startDate: { type: String, required: true },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "mq_classes" }
);

const SessionSchema = new Schema<SessionDoc>(
  {
    classId: { type: Schema.Types.ObjectId, required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ["taught", "trial", "off"], required: true },
    offReason: { type: String, enum: ["holiday", "student", "tutor", "other", null], default: null },
    hours: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    note: { type: String, default: "" },
    invoiceId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: "mq_sessions" }
);
SessionSchema.index({ classId: 1, date: 1 }, { unique: true });

const InvoiceSchema = new Schema<InvoiceDoc>(
  {
    classId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    total: { type: Number, required: true },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "mq_invoices" }
);

// Reused across hot reloads in dev, where this module re-runs but mongoose keeps its registry.
export const MqClass: Model<ClassDoc> =
  (mongoose.models.MqClass as Model<ClassDoc> | undefined) ?? mongoose.model<ClassDoc>("MqClass", ClassSchema);
export const MqSession: Model<SessionDoc> =
  (mongoose.models.MqSession as Model<SessionDoc> | undefined) ?? mongoose.model<SessionDoc>("MqSession", SessionSchema);
export const MqInvoice: Model<InvoiceDoc> =
  (mongoose.models.MqInvoice as Model<InvoiceDoc> | undefined) ?? mongoose.model<InvoiceDoc>("MqInvoice", InvoiceSchema);
