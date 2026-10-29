import mongoose, { Schema, type Model } from "mongoose";

// Every reading the fortune teller gives — the AI one or the quick offline
// one — for the admin's history on /card-draw. Written by /api/fortune only.
export interface FortuneReadingDoc {
  name: string;
  question: string;
  topic: string;
  cards: number[];
  text: string;
  source: "ai" | "offline";
  /** done; interrupted = the stream broke off part-way; refused = the AI declined. */
  status: "done" | "interrupted" | "refused";
  /** Why it is an offline reading: rate_limited | daily_limit | no_ai | ai_error. */
  reason: string;
  model: string;
  /** Hashed IP: tells repeat visitors apart without storing the address. */
  visitor: string;
  createdAt: Date;
}

const FortuneReadingSchema = new Schema<FortuneReadingDoc>({
  name: { type: String, default: "" },
  question: { type: String, default: "" },
  topic: { type: String, default: "any" },
  cards: { type: [Number], default: [] },
  text: { type: String, default: "" },
  source: { type: String, enum: ["ai", "offline"], required: true },
  status: { type: String, enum: ["done", "interrupted", "refused"], default: "done" },
  reason: { type: String, default: "" },
  model: { type: String, default: "" },
  visitor: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const FortuneReading: Model<FortuneReadingDoc> =
  (mongoose.models.FortuneReading as Model<FortuneReadingDoc> | undefined) ?? mongoose.model<FortuneReadingDoc>("FortuneReading", FortuneReadingSchema);
