import mongoose, { Schema, type InferSchemaType } from "mongoose";

const WordlistSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    language: { type: String, enum: ["vi", "en", "custom"], required: true },
    words: { type: [String], required: true },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: String, default: null }, // playerId of the room host, for custom lists
  },
  { timestamps: true }
);

export type WordlistDoc = InferSchemaType<typeof WordlistSchema>;

export default mongoose.models.Wordlist || mongoose.model("Wordlist", WordlistSchema);
