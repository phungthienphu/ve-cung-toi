"use client";

import { useState } from "react";
import {
  DEFAULT_MATH_BOSS_CONFIG,
  GRADES,
  MAX_TOPICS_PER_GRADE,
  QUESTIONS_PER_WAVE_OPTIONS,
  TOPIC_CATALOG,
  type Grade,
  type MathBossConfig,
  type TopicId,
} from "@shared/mathBossTypes";
import { CHAPTERS } from "@shared/mathQuestLessons";

/** Rough minutes per round including the explanation that follows it. */
const ROUND_MINUTES = 0.75;

// The tutor's "what's in this fight" screen, shown before the room code.
// Per grade, chapters → lessons → the dạng each lesson drills; tapping a dạng
// adds it as the next wave (the number on the chip is its wave).
export function BattleSetup({ config, onSave }: { config: MathBossConfig; onSave: (config: MathBossConfig) => void }) {
  const [draft, setDraft] = useState<MathBossConfig>(config);

  const toggle = (grade: Grade, topic: TopicId) =>
    setDraft((current) => {
      const list = current.topics[grade];
      const next = list.includes(topic) ? list.filter((id) => id !== topic) : list.length >= MAX_TOPICS_PER_GRADE ? list : [...list, topic];
      return { ...current, topics: { ...current.topics, [grade]: next } };
    });
  const setGradeTopics = (grade: Grade, topics: TopicId[]) => setDraft((current) => ({ ...current, topics: { ...current.topics, [grade]: topics } }));

  const waves = Math.max(1, ...GRADES.map((grade) => draft.topics[grade].length));
  const minutes = Math.round((waves * draft.questionsPerWave + 5) * ROUND_MINUTES + (draft.showDemo ? 2 : 0) + waves * 0.5);
  const empty = GRADES.every((grade) => draft.topics[grade].length === 0);

  return (
    <div className="w-full">
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-amber-300">Bước 1 · Gia sư chọn</p>
        <h2 className="mt-1 font-draw-display text-4xl font-extrabold">⚙️ Nội dung trận đấu</h2>
        <p className="mt-1 text-violet-200">Bấm vào dạng toán để thêm thành một đợt — số trên thẻ là thứ tự đợt. Mỗi bạn nhận đề theo lớp của mình.</p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {GRADES.map((grade) => (
          <section key={grade} className="rounded-2xl border-2 border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-draw-display text-2xl font-extrabold">Lớp {grade}</h3>
              <div className="flex gap-1.5 text-xs font-bold">
                <button onClick={() => setGradeTopics(grade, DEFAULT_MATH_BOSS_CONFIG.topics[grade])} className="rounded-lg border border-white/15 px-2.5 py-1 hover:bg-white/10">Mặc định</button>
                <button onClick={() => setGradeTopics(grade, [])} className="rounded-lg border border-white/15 px-2.5 py-1 hover:bg-white/10">Bỏ chọn</button>
              </div>
            </div>
            {CHAPTERS.filter((chapter) => chapter.grade === grade).map((chapter) => (
              <div key={chapter.number} className="mt-3">
                <p className="text-sm font-bold text-amber-200">Chương {chapter.roman}. {chapter.title}</p>
                <div className="mt-1.5 space-y-2">
                  {chapter.lessons.filter((lesson) => lesson.practice.length > 0).map((lesson) => (
                    <div key={lesson.id} className="rounded-xl bg-black/20 px-3 py-2">
                      <p className="text-xs text-violet-200">Bài {lesson.number}. {lesson.title}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {lesson.practice.map((topic) => {
                          const order = draft.topics[grade].indexOf(topic);
                          const picked = order >= 0;
                          return (
                            <button
                              key={topic}
                              onClick={() => toggle(grade, topic)}
                              className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold transition ${
                                picked ? "border-amber-300 bg-amber-300/20 text-amber-100" : "border-white/10 bg-white/5 text-violet-100 hover:border-white/30"
                              }`}
                            >
                              {picked && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-violet-950">{order + 1}</span>}
                              {TOPIC_CATALOG[topic].icon} {TOPIC_CATALOG[topic].name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="mt-3 text-sm text-violet-200">
              {draft.topics[grade].length ? `${draft.topics[grade].length} đợt cho lớp ${grade}` : `Chưa chọn — nếu có bạn lớp ${grade} vào, trận sẽ chưa bắt đầu được.`}
            </p>
          </section>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-white/10 bg-white/5 px-5 py-4">
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-sm font-bold">
            Số câu mỗi đợt
            <span className="flex rounded-xl border border-white/15 p-0.5">
              {QUESTIONS_PER_WAVE_OPTIONS.map((count) => (
                <button
                  key={count}
                  onClick={() => setDraft((current) => ({ ...current, questionsPerWave: count }))}
                  className={`rounded-lg px-3 py-1 ${draft.questionsPerWave === count ? "bg-amber-400 text-violet-950" : "text-violet-200"}`}
                >
                  {count}
                </button>
              ))}
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={draft.showDemo}
              onChange={(event) => setDraft((current) => ({ ...current, showDemo: event.target.checked }))}
              className="h-4 w-4 accent-amber-400"
            />
            Mở đầu bằng màn thách đấu với máy tính
          </label>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-violet-200">
            {waves} đợt + 1 đợt nổi giận · khoảng <b className="text-white">{minutes} phút</b>
          </p>
          <button
            onClick={() => onSave(draft)}
            disabled={empty}
            className="rounded-xl bg-amber-400 px-6 py-3 font-draw-display text-lg font-extrabold text-violet-950 shadow-[0_5px_0_#b45309] transition hover:brightness-105 disabled:opacity-40"
          >
            Lưu & mở phòng ▸
          </button>
        </div>
      </div>
    </div>
  );
}
