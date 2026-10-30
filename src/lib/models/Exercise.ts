import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { ExerciseCheck } from "@/lib/mathQuest/mathCheck";
import type { ExerciseKind, ExerciseLevel, ExerciseStyle, LevelChoice, Verified } from "@/lib/mathQuest/exerciseTypes";

// The AI exercise maker (docs/xuong-de-ai-spec.md): each lesson's problem
// types, suggested once by the AI and shared by everyone; and every set of
// exercises generated, answers included — those are only handed out with
// the tutor's password.

export interface ExerciseKindsDoc {
  lessonId: string;
  kinds: ExerciseKind[];
  /** Kinds the tutor hid from the picker. */
  hidden: string[];
  updatedAt: Date;
}

export interface ExerciseDoc {
  _id: Types.ObjectId;
  title: string;
  level: ExerciseLevel;
  statement: string;
  answer: string;
  solution: string[];
  check: ExerciseCheck;
  verified: Verified;
  issue: string;
  /** In the tutor's library ("Kho đề"). */
  saved: boolean;
}

export interface ExerciseSetDoc {
  /** "tutor", or the student's id. */
  owner: string;
  ownerName: string;
  lessonId: string;
  kindLabel: string;
  style: ExerciseStyle;
  contexts: string[];
  level: LevelChoice;
  note: string;
  noteIgnored: boolean;
  model: string;
  exercises: ExerciseDoc[];
  createdAt: Date;
}

const KindSchema = new Schema<ExerciseKind>(
  { id: String, label: String, hint: String, real: Boolean, contexts: [String] },
  { _id: false },
);

const ExerciseKindsSchema = new Schema<ExerciseKindsDoc>(
  {
    lessonId: { type: String, required: true, unique: true },
    kinds: { type: [KindSchema], default: [] },
    hidden: { type: [String], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

const CheckSchema = new Schema<ExerciseCheck>(
  {
    type: { type: String, enum: ["equations", "value", "identity", "none"], default: "none" },
    variables: [String],
    equations: [String],
    solutions: [[String]],
    conditions: [String],
    expression: String,
    value: String,
  },
  { _id: false },
);

const ExerciseSchema = new Schema<ExerciseDoc>({
  title: String,
  level: String,
  statement: String,
  answer: String,
  solution: [String],
  check: CheckSchema,
  verified: { type: String, enum: ["ok", "manual", "failed"], default: "manual" },
  issue: { type: String, default: "" },
  saved: { type: Boolean, default: false },
});

const ExerciseSetSchema = new Schema<ExerciseSetDoc>(
  {
    owner: { type: String, required: true, index: true },
    ownerName: String,
    lessonId: { type: String, required: true },
    kindLabel: String,
    style: { type: String, enum: ["basic", "real"] },
    contexts: [String],
    level: String,
    note: { type: String, default: "" },
    noteIgnored: { type: Boolean, default: false },
    model: String,
    exercises: { type: [ExerciseSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
ExerciseSetSchema.index({ createdAt: -1 });
ExerciseSetSchema.index({ "exercises._id": 1 });
ExerciseSetSchema.index({ "exercises.saved": 1 });

export const MqExerciseKinds: Model<ExerciseKindsDoc> =
  (mongoose.models.MqExerciseKinds as Model<ExerciseKindsDoc> | undefined) ?? mongoose.model<ExerciseKindsDoc>("MqExerciseKinds", ExerciseKindsSchema);

export const MqExerciseSet: Model<ExerciseSetDoc> =
  (mongoose.models.MqExerciseSet as Model<ExerciseSetDoc> | undefined) ?? mongoose.model<ExerciseSetDoc>("MqExerciseSet", ExerciseSetSchema);
