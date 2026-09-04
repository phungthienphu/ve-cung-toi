import mongoose, { Schema, type InferSchemaType } from "mongoose";

const PlayerResultSchema = new Schema(
  {
    name: { type: String, required: true },
    score: { type: Number, required: true },
  },
  { _id: false }
);

const GameHistorySchema = new Schema(
  {
    roomId: { type: String, required: true },
    players: { type: [PlayerResultSchema], required: true },
    rounds: { type: Number, required: true },
    playedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export type GameHistoryDoc = InferSchemaType<typeof GameHistorySchema>;

export default mongoose.models.GameHistory || mongoose.model("GameHistory", GameHistorySchema);
