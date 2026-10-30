"use client";

import { useEffect, useRef, useState } from "react";
import { findCurriculumLesson } from "@/lib/mathQuest/curriculum";
import { CHANGES, levelLabel, type ExerciseAnswer, type ExerciseChange, type ExerciseSetView, type ExerciseStyle, type ExerciseView, type GenerateStage, type Verified } from "@/lib/mathQuest/exerciseTypes";
import { relativeDay } from "@/components/mathquest/shared";
import { MathRich } from "./MathRich";
import { postExercises } from "./api";

// The exercise maker's results: a set's header and toolbar, one card per
// exercise, the answer box (only once the tutor's password was typed), the
// password dialog and the print menu.

export type PrintMode = "sheet" | "answers" | "both";
/** What an exercise being rewritten is waiting on. */
export type ReviseStage = "writing" | GenerateStage;

export const lessonName = (lessonId: string) => {
  const found = findCurriculumLesson(lessonId);
  return found ? `Bài ${found.lesson.number}. ${found.lesson.title}` : lessonId;
};
export const lessonGrade = (lessonId: string) => findCurriculumLesson(lessonId)?.lesson.grade ?? null;

const BADGES: Record<Verified, { label: string; className: string; title: string }> = {
  ok: { label: "✓ Đã kiểm đáp án", className: "bg-sage-100 text-sage-600", title: "Máy đã thế đáp số vào lại đề và thấy khớp." },
  manual: { label: "👀 Thầy/cô xem lại", className: "bg-gold-100 text-gold-600", title: "Dạng này máy không tự kiểm được (hình học, chứng minh…) hoặc thầy/cô đã sửa tay." },
  failed: { label: "⚠️ Đáp án chưa khớp", className: "bg-red-50 text-red-600", title: "Máy thế đáp số vào lại đề thấy chưa khớp — nên đổi câu khác." },
};

export function VerifiedBadge({ verified }: { verified: Verified }) {
  const badge = BADGES[verified];
  return (
    <span title={badge.title} className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}>
      {badge.label}
    </span>
  );
}

const STAGE_TEXT: Record<ReviseStage, string> = {
  writing: "✍️ AI đang viết lại câu này…",
  checking: "🔎 Máy đang kiểm đáp án…",
  repairing: "🛠️ Chưa khớp — AI đang sửa lại…",
};

export interface CardActions {
  /** Rewrite with the AI; absent when not allowed (someone else's set, no AI). */
  onRevise?: (change: ExerciseChange) => void;
  onSave?: (saved: boolean) => void;
  /** The tutor's hand edit; only with the answers unlocked. */
  onEdit?: (fields: { statement: string; answer: string; solution: string[] }) => Promise<boolean>;
}

export function ExerciseCard({
  exercise,
  number,
  style,
  answer,
  showAnswer,
  revising,
  actions,
  selection,
}: {
  exercise: ExerciseView;
  number: number;
  style: ExerciseStyle;
  answer?: ExerciseAnswer;
  showAnswer: boolean;
  revising: ReviseStage | null;
  actions: CardActions;
  selection?: { selected: boolean; onToggle: () => void };
}) {
  const [changing, setChanging] = useState(false);
  const [editing, setEditing] = useState(false);
  const changes = CHANGES.filter((change) => change.id !== "new" && (change.id !== "context" || style === "real"));

  return (
    <article className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition sm:p-5 ${selection?.selected ? "border-clay-500 ring-2 ring-clay-500/30" : "border-cream-200"}`}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {selection && (
          <input type="checkbox" checked={selection.selected} onChange={selection.onToggle} className="h-4 w-4 accent-clay-500" aria-label={`Chọn câu ${number}`} />
        )}
        <span className="font-draw-display text-lg font-extrabold text-clay-600">Câu {number}</span>
        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-bold text-ink/60">{levelLabel(exercise.level)}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-ink/45">{exercise.title}</span>
        <VerifiedBadge verified={exercise.verified} />
      </header>

      {editing && answer && actions.onEdit ? (
        <Editor exercise={exercise} answer={answer} onCancel={() => setEditing(false)} onSave={actions.onEdit} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div className="mt-3 text-[15px] leading-relaxed sm:text-base">
            <MathRich text={exercise.statement} />
          </div>
          {showAnswer && <AnswerBox answer={answer} verified={exercise.verified} />}
        </>
      )}

      {!editing && (actions.onRevise || actions.onSave || (actions.onEdit && answer)) && (
        <footer className="mt-4 border-t border-cream-100 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {actions.onRevise && (
              <>
                <SmallButton onClick={() => actions.onRevise!("new")} disabled={Boolean(revising)}>
                  🔁 Đổi câu khác
                </SmallButton>
                <SmallButton onClick={() => setChanging((value) => !value)} disabled={Boolean(revising)} active={changing}>
                  ✏️ Sửa {changing ? "▴" : "▾"}
                </SmallButton>
              </>
            )}
            {actions.onEdit && answer && showAnswer && <SmallButton onClick={() => setEditing(true)}>📝 Sửa tay</SmallButton>}
            {actions.onSave && (
              <SmallButton onClick={() => actions.onSave!(!exercise.saved)} active={exercise.saved}>
                {exercise.saved ? "★ Đã lưu kho" : "☆ Lưu vào kho"}
              </SmallButton>
            )}
          </div>
          {changing && actions.onRevise && (
            <div className="mt-2 flex flex-wrap gap-1.5 rounded-xl bg-cream-50 p-2">
              {changes.map((change) => (
                <button
                  key={change.id}
                  onClick={() => {
                    setChanging(false);
                    actions.onRevise!(change.id);
                  }}
                  disabled={Boolean(revising)}
                  className="rounded-full border border-cream-200 bg-white px-3 py-1 text-xs font-bold text-ink/75 transition hover:border-clay-500 disabled:opacity-40"
                >
                  {change.label}
                </button>
              ))}
            </div>
          )}
        </footer>
      )}

      {revising && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-[2px]">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-clay-500/25 border-t-clay-500" />
          <p className="text-sm font-bold text-clay-600">{STAGE_TEXT[revising]}</p>
        </div>
      )}
    </article>
  );
}

function AnswerBox({ answer, verified }: { answer?: ExerciseAnswer; verified: Verified }) {
  if (!answer) return <p className="mt-3 animate-pulse rounded-xl bg-sage-100/60 px-3 py-2 text-sm text-sage-600">Đang mở đáp án…</p>;
  return (
    <div className="mt-3 rounded-xl border border-sage-500/25 bg-sage-100/50 px-3 py-2.5">
      <p className="text-sm">
        <span className="font-bold text-sage-600">Đáp số: </span>
        <MathRich text={answer.answer || "—"} />
      </p>
      {verified === "failed" && answer.issue && <p className="mt-1.5 text-xs font-semibold text-red-600">⚠️ Máy kiểm thấy: {answer.issue}</p>}
      {answer.solution.length > 0 && (
        <details className="group mt-1.5">
          <summary className="cursor-pointer list-none text-sm font-bold text-sage-600 [&::-webkit-details-marker]:hidden">
            <span className="mr-1 inline-block transition group-open:rotate-90">▸</span>Lời giải ({answer.solution.length} bước)
          </summary>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
            {answer.solution.map((step, index) => (
              <li key={index}>
                <MathRich text={step} />
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function Editor({
  exercise,
  answer,
  onSave,
  onCancel,
  onDone,
}: {
  exercise: ExerciseView;
  answer: ExerciseAnswer;
  onSave: NonNullable<CardActions["onEdit"]>;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [statement, setStatement] = useState(exercise.statement);
  const [result, setResult] = useState(answer.answer);
  const [solution, setSolution] = useState(answer.solution.join("\n"));
  const [busy, setBusy] = useState(false);
  const field = "mt-1 w-full rounded-xl border border-cream-200 px-3 py-2 font-mono text-sm outline-none focus:border-clay-500";
  return (
    <div className="mt-3 space-y-3">
      <label className="block text-xs font-bold text-ink/60">
        Đề bài <span className="font-normal">(công thức trong $…$)</span>
        <textarea value={statement} onChange={(event) => setStatement(event.target.value)} rows={5} className={field} />
      </label>
      <div className="rounded-xl bg-cream-50 px-3 py-2 text-sm">
        <MathRich text={statement} />
      </div>
      <label className="block text-xs font-bold text-ink/60">
        Đáp số
        <textarea value={result} onChange={(event) => setResult(event.target.value)} rows={2} className={field} />
      </label>
      <label className="block text-xs font-bold text-ink/60">
        Lời giải <span className="font-normal">(mỗi dòng một bước)</span>
        <textarea value={solution} onChange={(event) => setSolution(event.target.value)} rows={6} className={field} />
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-bold text-ink/50 hover:text-ink">
          Huỷ
        </button>
        <button
          onClick={async () => {
            setBusy(true);
            const ok = await onSave({ statement, answer: result, solution: solution.split("\n").map((step) => step.trim()).filter(Boolean) });
            setBusy(false);
            if (ok) onDone();
          }}
          disabled={busy || !statement.trim()}
          className="rounded-lg bg-clay-500 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
    </div>
  );
}

function SmallButton({ onClick, disabled, active, children }: { onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition disabled:opacity-40 ${active ? "bg-clay-500/10 text-clay-600" : "bg-cream-50 text-ink/70 hover:bg-cream-100 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

/** One generated set: what was asked for, the answer and print tools, then its exercises. */
export function SetCard({
  set,
  showOwner,
  answerTools,
  onPrint,
  onDelete,
  children,
}: {
  set: ExerciseSetView;
  showOwner: boolean;
  answerTools: React.ReactNode;
  onPrint: (mode: PrintMode) => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const grade = lessonGrade(set.lessonId);
  const meta = [
    grade ? `Lớp ${grade}` : null,
    set.kindLabel,
    set.style === "real" ? (set.contexts.length ? `Thực tế: ${set.contexts.join(", ")}` : "Thực tế") : "Cơ bản",
    levelLabel(set.level).replace("📈 ", ""),
  ].filter(Boolean);
  return (
    <section className="mt-6">
      <div className="rounded-2xl bg-ink px-4 py-3 text-cream-50 shadow-md sm:px-5">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-draw-display text-lg font-extrabold leading-snug">{lessonName(set.lessonId)}</h2>
            <p className="mt-0.5 text-xs text-cream-50/70">
              {meta.join(" · ")}
              <span className="mx-1">·</span>
              {relativeDay(set.createdAt)} {time(set.createdAt)}
              {showOwner && <span className="ml-1 rounded-full bg-cream-50/15 px-2 py-0.5 font-bold text-cream-50">{set.ownerName}</span>}
            </p>
          </div>
          <button onClick={onDelete} className="rounded-lg px-2 py-1 text-xs font-bold text-cream-50/50 hover:bg-cream-50/10 hover:text-cream-50" title="Xoá bộ đề này">
            🗑
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {answerTools}
          <PrintMenu onPrint={onPrint} />
        </div>
      </div>
      {set.note && (
        <p className={`mt-2 rounded-xl px-3 py-2 text-sm ${set.noteIgnored ? "bg-gold-100 text-gold-600" : "bg-cream-100 text-ink/70"}`}>
          📝 Ghi chú: “{set.note}”
          {set.noteIgnored && <span className="font-semibold"> — không liên quan tới bài tập nên AI đã bỏ qua.</span>}
        </p>
      )}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function PrintMenu({ onPrint, label = "🖨️ In" }: { onPrint: (mode: PrintMode) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  const pick = (mode: PrintMode) => {
    setOpen(false);
    onPrint(mode);
  };
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((value) => !value)} className="rounded-xl bg-cream-50/15 px-3 py-1.5 text-sm font-bold text-cream-50 transition hover:bg-cream-50/25">
        {label} ▾
      </button>
      {open && (
        // A sheet from the bottom on phones, a dropdown on wider screens.
        <div className="fixed inset-x-3 bottom-3 z-40 overflow-hidden rounded-2xl border border-cream-200 bg-white text-ink shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-1 sm:w-60 sm:rounded-xl">
          <p className="px-4 pt-3 text-xs font-bold uppercase tracking-wider text-ink/40 sm:hidden">In ra giấy</p>
          <MenuItem onClick={() => pick("sheet")} title="📄 Phiếu bài tập" detail="Chỉ có đề, để phát cho học sinh" />
          <MenuItem onClick={() => pick("answers")} title="🔑 Đáp án" detail="Cần mật khẩu gia sư" />
          <MenuItem onClick={() => pick("both")} title="📄 + 🔑 Đề và đáp án" detail="Đáp án sang trang riêng" />
          <button onClick={() => setOpen(false)} className="w-full border-t border-cream-100 py-3 text-sm font-bold text-ink/50 sm:hidden">
            Đóng
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, title, detail }: { onClick: () => void; title: string; detail: string }) {
  return (
    <button onClick={onClick} className="block w-full px-4 py-3 text-left hover:bg-cream-50 sm:px-3 sm:py-2">
      <span className="block text-sm font-bold">{title}</span>
      <span className="block text-xs text-ink/50">{detail}</span>
    </button>
  );
}

/** Asks for the tutor password; answers stay open for 30 minutes on this page. */
export function UnlockDialog({ onClose, onUnlocked }: { onClose: () => void; onUnlocked: (key: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError("");
    const result = await postExercises<{ key: string }>({ action: "unlock", password });
    setBusy(false);
    if (result.ok) return onUnlocked(result.data.key);
    setError(result.error);
    setPassword("");
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-4" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="unlock-title" className="w-full max-w-sm rounded-t-3xl bg-white p-6 pb-8 text-center shadow-2xl sm:rounded-3xl sm:pb-6">
        <div className="text-5xl">🔒</div>
        <h2 id="unlock-title" className="mt-2 font-draw-display text-2xl font-extrabold">Đáp án của thầy/cô</h2>
        <p className="mt-1 text-sm text-ink/60">Nhập mật khẩu gia sư để xem đáp án và lời giải.</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit()}
          placeholder="Mật khẩu gia sư"
          className="mt-4 w-full rounded-xl border-2 border-cream-200 px-4 py-3 text-center outline-none focus:border-clay-500"
        />
        {error && <p className="mt-2 text-sm font-semibold text-red-500">{error}</p>}
        <button onClick={submit} disabled={!password || busy} className="mt-4 w-full rounded-xl bg-clay-500 py-3 font-bold text-white disabled:opacity-50">
          {busy ? "Đang kiểm tra…" : "Mở khoá đáp án"}
        </button>
        <button onClick={onClose} className="mt-2 w-full rounded-xl py-2 text-sm font-semibold text-ink/50 hover:text-ink">
          Để sau
        </button>
        <p className="mt-3 text-xs text-ink/40">Mở trong 30 phút trên trang này. Tải lại trang là khoá lại.</p>
      </div>
    </div>
  );
}
