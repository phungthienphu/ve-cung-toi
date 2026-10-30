# Xưởng đề AI — spec

The AI exercise maker in Math Quest, at `/math-quest/exercises`. It is the "✨ Soạn đề" tab on the tutor page and the "Luyện đề với AI" card in the student notebook. Agreed with the tutor on 2026-10-30.

## Who uses it
- **Tutor and logged-in students** can generate exercises. Anonymous visitors cannot.
- **Answers and solutions are tutor-only.**
  - They are unlocked by typing the tutor password on the page. This is required even on a device already logged in as tutor (projector, a kid's phone).
  - The server returns a 30-minute answer key. The page keeps it in memory only, so a reload locks the answers again.
  - Answers are never sent to the browser without that key.
  - Password tries are limited to 10 per hour.
- **Daily AI allowance:** tutor 40, each student 15, whole site 150 (Vietnam day). Generating, rewriting and listing a lesson's problem types each count as one. A failed AI call is refunded.

## Picking, not typing
Everything is chosen from lists, in this order:
1. **Grade.** Lớp 8 or 9.
2. **Chapter → lesson.** The Kết nối tri thức outline is fixed in `src/lib/mathQuest/curriculum.ts`. It is never AI-generated, because the AI invents lesson names.
3. **Problem type ("dạng").**
   - The AI lists 4–8 types per lesson the first time anyone opens that lesson. The list is cached in `MqExerciseKinds` and shared by everyone.
   - The tutor can hide types or ask for a fresh list.
   - "🎲 Trộn các dạng" mixes all types.
4. **Cơ bản / Bài toán thực tế.** "Thực tế" is only offered when the type has real-world problems.
   - Its contexts (ca nô xuôi/ngược dòng, làm chung làm riêng…) come from the same cached list. Pick several, or "AI tự chọn".
   - The server only accepts contexts that are on the list.
5. **Level.** Nhận biết / Thông hiểu / Vận dụng / Vận dụng cao / Từ dễ đến khó.
6. **Number of problems.** 1, 3, 5, 8 or 10.

The only free text is an optional note of up to 150 characters.

## Study-only scope
- The prompt allows exactly one job: write maths exercises.
- An off-topic note (chat, other subjects, role-play, "ignore the rules") is ignored and flagged with `noteIgnored`. The page then says the note was skipped.
- Replies must match a JSON schema of exercises, so there is no free-text channel back.

## Correctness
The AI writes everything: story, numbers and solution. Each exercise also declares a `check`, and `src/lib/mathQuest/mathCheck.ts` evaluates it with its own parser (never `eval`).

| `check.type` | Used for | How it is checked |
|---|---|---|
| `equations` | Equations, systems, quadratics, word problems after choosing unknowns | Substitute every solution, then test the conditions (e.g. "x > 0", "x > y") |
| `value` | Numeric answers | Recompute the expression |
| `identity` | Simplifying, factoring, rational expressions | Compare both sides at sample points |
| `none` | Geometry proofs and similar | No machine check |

Failures go back to the AI once for repair. The result is labelled:
- **✓ Đã kiểm đáp án:** the check passed.
- **👀 Thầy/cô xem lại:** nothing to check, the check could not be read, or the tutor edited the exercise by hand.
- **⚠️ Đáp án chưa khớp:** the check still fails after the repair.

No figures in v1. Like đề thi vào 10, students draw them.

## Results
- **Each exercise:**
  - 🔁 Đổi câu khác.
  - ✏️ Sửa: Số đẹp hơn · Dễ hơn · Khó hơn · Đổi bối cảnh · Gọn hơn.
  - Tutor only: ☆ Lưu vào kho, and 📝 Sửa tay once answers are unlocked.
- **Print:** worksheet only, answer key only, or both with the key on a new page. Uses KaTeX and an A4 print stylesheet.
- **🕘 Gần đây:** a student sees their own last 20 sets. The tutor sees everyone's, with the owner's name.
- **📦 Kho đề (tutor):** saved exercises grouped by lesson. Tick some, or none for all, then print.

## Plumbing
- **AI:** the OpenAI-compatible router (`AI_ROUTER_API_KEY`, `AI_ROUTER_BASE_URL`; model `AI_EXERCISE_MODEL` or `AI_ROUTER_MODEL`).
  - Uses the Responses API with structured output.
  - Falls back to prompt-only JSON if the router rejects `text.format`.
  - Claude is not wired for this feature.
- **Generation is fast by being parallel.**
  - Each exercise of a set is its own AI call, at most 5 at once, all at low reasoning effort.
  - Each call is given its own type (when mixing), level ("Từ dễ đến khó" is spread over the four levels), context (picked contexts dealt in turn, otherwise the type's own list shuffled) and two seed numbers, so parallel calls don't write the same problem.
  - A failed call is retried once. If a call still fails, the set is saved with the exercises that did succeed.
- **`POST /api/math-quest/exercises/generate`** streams NDJSON:
  - a `draft` event per exercise as soon as it is written and checked, which the page shows right away without tools;
  - `progress` events;
  - `stage` events, for rewriting one exercise only;
  - then a `set` or `exercise` event, or an `error` event.
- **`/api/math-quest/exercises`** handles the rest: problem types, unlock, answers, edit, save, delete.
- **Data:** `MqExerciseSet` keeps every generated set with answers, its check, the note, the owner and the model. `MqExerciseKinds` is the cache of problem types.
