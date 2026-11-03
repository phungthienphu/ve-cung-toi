import mongoose, { Schema, type Model } from "mongoose";

// Rate-limit counters for the fortune teller's AI readings (/api/fortune):
// one document per window — "ip:<hash>:<hour>" per visitor, "day:<date>"
// for the whole site. MongoDB's TTL monitor deletes each once it expires.
export interface FortuneUsageDoc {
  key: string;
  count: number;
  expiresAt: Date;
}

const FortuneUsageSchema = new Schema<FortuneUsageDoc>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 },
});

export const FortuneUsage: Model<FortuneUsageDoc> =
  (mongoose.models.FortuneUsage as Model<FortuneUsageDoc> | undefined) ?? mongoose.model<FortuneUsageDoc>("FortuneUsage", FortuneUsageSchema);
