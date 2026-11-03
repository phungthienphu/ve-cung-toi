// The AI exercise maker ("Xưởng đề AI", docs/xuong-de-ai-spec.md): the
// choices on its pickers and the shapes the browser sees. Answers are a
// separate shape on purpose — they only leave the server after the tutor's
// password has been typed.

export const LEVELS = [
  { id: "nb", label: "Nhận biết" },
  { id: "th", label: "Thông hiểu" },
  { id: "vd", label: "Vận dụng" },
  { id: "vdc", label: "Vận dụng cao" },
] as const;
export type ExerciseLevel = (typeof LEVELS)[number]["id"];

export const LEVEL_CHOICES = [...LEVELS, { id: "mixed", label: "📈 Từ dễ đến khó" }] as const;
export type LevelChoice = (typeof LEVEL_CHOICES)[number]["id"];

export const COUNTS = [1, 3, 5, 8, 10] as const;
export const NOTE_MAX = 150;
/** Picks every problem type of the lesson instead of one. */
export const MIX_KIND = "mix";

export type ExerciseStyle = "basic" | "real";

export const levelLabel = (id: string) => LEVEL_CHOICES.find((level) => level.id === id)?.label ?? id;

/** A problem type of a lesson, suggested once by the AI and cached for everyone. */
export interface ExerciseKind {
  id: string;
  label: string;
  hint: string;
  /** Has real-world word problems ("bài toán thực tế"). */
  real: boolean;
  contexts: string[];
}

export const CHANGES = [
  { id: "new", label: "🔁 Đổi câu khác" },
  { id: "nicer", label: "🔢 Số đẹp hơn" },
  { id: "easier", label: "⬇️ Dễ hơn" },
  { id: "harder", label: "⬆️ Khó hơn" },
  { id: "context", label: "🌏 Đổi bối cảnh" },
  { id: "shorter", label: "✂️ Gọn hơn" },
] as const;
export type ExerciseChange = (typeof CHANGES)[number]["id"];

/** ok: the answer was checked by substituting it back; manual: nothing a machine can check (geometry, proofs); failed: the check didn't hold. */
export type Verified = "ok" | "manual" | "failed";

export interface ExerciseView {
  id: string;
  title: string;
  level: ExerciseLevel;
  statement: string;
  verified: Verified;
  saved: boolean;
}

/** Only sent with a valid answer key (the tutor's password, typed on this page). */
export interface ExerciseAnswer {
  id: string;
  answer: string;
  solution: string[];
  /** Why the machine check failed, if it did. */
  issue: string;
}

export interface ExerciseSetView {
  id: string;
  ownerName: string;
  lessonId: string;
  kindLabel: string;
  style: ExerciseStyle;
  contexts: string[];
  level: LevelChoice;
  note: string;
  noteIgnored: boolean;
  createdAt: string;
  exercises: ExerciseView[];
}

export interface LibraryItem extends ExerciseView {
  lessonId: string;
  setId: string;
}

export interface Quota {
  left: number;
  limit: number;
}

export type Viewer = { role: "tutor"; id: "tutor"; name: string } | { role: "student"; id: string; name: string; grade: 8 | 9 };

/** After writing: the machine checks the answers, and sends failures back to the AI once. */
export type GenerateStage = "checking" | "repairing";

/** An exercise shown while the rest of its set is still being written: no id or tools until the set is saved. */
export type DraftView = Pick<ExerciseView, "title" | "level" | "statement" | "verified">;

/** One line of the generate stream (NDJSON). */
export type GenerateEvent =
  | { type: "progress"; done: number; total: number }
  /** Generating: one exercise is ready (null: the AI failed on that one). */
  | { type: "draft"; index: number; exercise: DraftView | null }
  /** Rewriting one exercise: the machine check, and the repair if it failed. */
  | { type: "stage"; stage: GenerateStage }
  | { type: "set"; set: ExerciseSetView; quota: Quota }
  | { type: "exercise"; setId: string; index: number; exercise: ExerciseView; quota: Quota }
  | { type: "error"; error: string };
