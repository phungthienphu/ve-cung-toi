import mongoose, { Schema, type InferSchemaType } from "mongoose";

const runSchema = new Schema({
  runId: { type: String, required: true, unique: true },
  playerId: { type: String, required: true },
  name: { type: String, required: true, maxlength: 24 },
  map: { type: String, required: true },
  vehicle: { type: String, required: true },
  seed: { type: Number, required: true },
  day: { type: String, default: null },
  distance: { type: Number, required: true },
  coins: { type: Number, required: true },
  duration: { type: Number, required: true },
}, { timestamps: true });
runSchema.index({ map: 1, day: 1, distance: -1, playerId: 1 });
runSchema.index({ playerId: 1, map: 1, day: 1, distance: -1 });
const walletSchema = new Schema({
  playerId: { type: String, required: true, unique: true },
  coins: { type: Number, default: 0, min: 0 },
  unlocked: { type: [String], default: ["jeep"] },
  mergedTo: { type: String, default: null },
  // Atomic credit guard: retrying a run can never award its coins twice.
  creditedRuns: { type: [String], default: [], select: false },
}, { timestamps: true });
type Run = InferSchemaType<typeof runSchema>;
type Wallet = InferSchemaType<typeof walletSchema>;
export const HillRun = (mongoose.models.HillRun as mongoose.Model<Run> | undefined) ?? mongoose.model<Run>("HillRun", runSchema);
export const HillWallet = (mongoose.models.HillWallet as mongoose.Model<Wallet> | undefined) ?? mongoose.model<Wallet>("HillWallet", walletSchema);
