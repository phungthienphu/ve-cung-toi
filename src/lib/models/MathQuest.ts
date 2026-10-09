import mongoose, { Schema, type Model, type Types } from "mongoose";

// Math Quest (docs/math-quest-design-spec.md): the tutor's students, what
// each has been taught / reviewed, and which lesson drafts the tutor has
// approved. Lesson *content* lives in shared/mathQuestLessons.ts.
//
// Document shapes are written out by hand: letting mongoose infer them
// (InferSchemaType) sent the TypeScript checker out of memory.

export interface StudentDoc {
  name: string;
  /** Lower-cased, accent-stripped name used to log in ("Minh" = "minh"). */
  nameKey: string;
  grade: 8 | 9;
  pinHash: string;
  pinSalt: string;
  failedLogins: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonProgressDoc {
  studentId: Types.ObjectId;
  lessonId: string;
  /** Set by the tutor ("đã dạy"); the lesson opens for the student from then on. */
  taughtAt: Date | null;
  lastOpenedAt: Date | null;
  practiceCorrect: number;
  practiceTotal: number;
  lastPracticedAt: Date | null;
}

export interface LessonReviewDoc {
  lessonId: string;
  status: "approved" | "changes";
  /** What the tutor wants changed, for the next drafting pass. */
  note: string;
  updatedAt: Date;
}

const StudentSchema = new Schema<StudentDoc>(
  {
    name: { type: String, required: true },
    nameKey: { type: String, required: true, unique: true },
    grade: { type: Number, enum: [8, 9], required: true },
    pinHash: { type: String, required: true },
    pinSalt: { type: String, required: true },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true, collection: "mq_students" }
);

const LessonProgressSchema = new Schema<LessonProgressDoc>(
  {
    studentId: { type: Schema.Types.ObjectId, required: true, index: true },
    lessonId: { type: String, required: true },
    taughtAt: { type: Date, default: null },
    lastOpenedAt: { type: Date, default: null },
    practiceCorrect: { type: Number, default: 0 },
    practiceTotal: { type: Number, default: 0 },
    lastPracticedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "mq_lesson_progress" }
);
LessonProgressSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });

const LessonReviewSchema = new Schema<LessonReviewDoc>(
  {
    lessonId: { type: String, required: true, unique: true },
    status: { type: String, enum: ["approved", "changes"], required: true },
    note: { type: String, default: "" },
  },
  { timestamps: true, collection: "mq_lesson_reviews" }
);

// Reused across hot reloads in dev, where this module re-runs but mongoose keeps its registry.
export const MqStudent: Model<StudentDoc> =
  (mongoose.models.MqStudent as Model<StudentDoc> | undefined) ?? mongoose.model<StudentDoc>("MqStudent", StudentSchema);
export const MqLessonProgress: Model<LessonProgressDoc> =
  (mongoose.models.MqLessonProgress as Model<LessonProgressDoc> | undefined) ?? mongoose.model<LessonProgressDoc>("MqLessonProgress", LessonProgressSchema);
export const MqLessonReview: Model<LessonReviewDoc> =
  (mongoose.models.MqLessonReview as Model<LessonReviewDoc> | undefined) ?? mongoose.model<LessonReviewDoc>("MqLessonReview", LessonReviewSchema);
