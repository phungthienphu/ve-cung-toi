"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEMOS,
  GRADES,
  HERO_COLORS,
  THEMES,
  DEFAULT_MATH_BOSS_CONFIG,
  TOPIC_CATALOG,
  WEAPONS,
  formatNumber,
  isRageWave,
  type HeroColor,
  type HeroWeapon,
  type MathBossClientMessage,
  type MathBossPlayer,
  type PublicMathBossState,
  type PublicQuestion,
  type Shot,
} from "@shared/mathBossTypes";
import { drawFontClass } from "@/lib/drawFonts";
import { playCorrect, playPop, playTypeTick } from "@/lib/sound";
import { HpBar, TimeBar } from "./Boss";
import { MathText } from "./MathText";
import { HERO_PALETTE, HeroSprite } from "./HeroSprite";
import { TopicCard } from "./TopicCard";

type Send = (msg: MathBossClientMessage) => void;

const MAX_DIGITS = 6;
const LETTERS = ["A", "B", "C", "D"];
const FIGHT_PHASES = new Set(["intro", "question", "result"]);
const COLOR_IDS = Object.keys(HERO_COLORS) as HeroColor[];

// A student's phone: their own question and the buttons to answer it. The
// battle itself plays on the tutor's screen; the phone says "look up" when
// there's nothing to do.
export function PlayerView({ state, selfId, send }: { state: PublicMathBossState; selfId: string; send: Send }) {
  const self = state.players.find((player) => player.id === selfId);

  return (
    <main className={`${drawFontClass} bg-mathboss flex min-h-app flex-col px-4 pb-20 pt-4 text-white`}>
      <header className="flex items-center justify-between gap-3 text-sm">
        <span className="font-draw-display text-lg font-bold">🧮 Quái Máy Tính</span>
        <span className="truncate rounded-full bg-white/10 px-3 py-1 font-semibold text-violet-100">
          {self ? `${self.name} · Lớp ${self.grade}` : "…"}
        </span>
      </header>
      {FIGHT_PHASES.has(state.phase) && state.bossMaxHp > 0 && (
        <div className="mt-3">
          <HpBar hp={state.bossHp} maxHp={state.bossMaxHp} />
        </div>
      )}
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-5">
        {!self ? <LookUp title="Đang vào phòng…" /> : <Content state={state} self={self} send={send} />}
      </section>
    </main>
  );
}

function Content({ state, self, send }: { state: PublicMathBossState; self: MathBossPlayer; send: Send }) {
  // This student's dạng, in wave order (a grade the tutor left empty uses the defaults).
  const myTopics = state.config.topics[self.grade].length ? state.config.topics[self.grade] : DEFAULT_MATH_BOSS_CONFIG.topics[self.grade];
  const rage = isRageWave(state.wave, state.topicWaves);
  switch (state.phase) {
    case "lobby":
      return (
        <div className="text-center">
          <div className="text-6xl">✅</div>
          <h1 className="mt-3 font-draw-display text-3xl font-extrabold">Đã vào phòng!</h1>
          <p className="mt-2 text-violet-200">Chờ thầy/cô bắt đầu…</p>
          <GradeSwitch self={self} send={send} />
          <p className="mt-6 text-sm text-violet-300">Trong phòng: {state.players.map((player) => player.name).join(", ")}</p>
        </div>
      );
    case "pick":
      return <HeroPicker state={state} self={self} send={send} />;
    case "show": {
      const demo = DEMOS[state.showIndex];
      return (
        <LookUp
          title="Nhìn lên màn hình lớn!"
          detail={state.showRevealed
            ? <>Đáp án {formatNumber(demo.answer)} — bí mật là hằng đẳng thức!</>
            : <>Ai tính nhanh hơn: thầy/cô hay máy tính?</>}
        />
      );
    }
    case "intro":
      if (!rage && state.wave <= myTopics.length) {
        return (
          <div>
            <TopicCard topic={TOPIC_CATALOG[myTopics[state.wave - 1]]} size="sm" />
            <p className="mt-4 text-center text-violet-200">Nhớ công thức này — quái vật sắp tới!</p>
          </div>
        );
      }
      return (
        <div className="text-center">
          <div className="text-6xl">🔥</div>
          <h2 className="mt-2 font-draw-display text-3xl font-extrabold text-rose-300">{rage ? "Quái Máy Tính nổi giận!" : "Ôn tổng hợp!"}</h2>
          <p className="mt-2 text-violet-100">{rage ? "Đợt cuối trộn các dạng đã học:" : "Đợt này trộn các dạng của bạn:"}</p>
          <ul className="mt-4 space-y-2 text-left">
            {myTopics.map((id) => (
              <li key={id} className="rounded-xl bg-white/5 px-4 py-2.5">
                <span className="font-bold">{TOPIC_CATALOG[id].icon} {TOPIC_CATALOG[id].name}</span>
                <span className="block font-mono text-sm text-amber-200"><MathText text={TOPIC_CATALOG[id].formulas[0]} /></span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "question": {
      const question = state.questions[self.id];
      if (!question || !state.questionStartedAt || !state.questionEndsAt) return <LookUp title="Chờ lượt sau nhé!" />;
      return (
        <QuestionPanel
          key={question.id}
          question={question}
          label={`Đợt ${state.wave} · Lượt ${state.questionIndex + 1}${rage ? "" : `/${state.config.questionsPerWave}`}`}
          startedAt={state.questionStartedAt}
          endsAt={state.questionEndsAt}
          shot={state.shots.find((shot) => shot.playerId === self.id) ?? null}
          onSubmit={(value) => send({ type: "answer", value })}
        />
      );
    }
    case "result":
      return state.lastOutcome ? <ResultCard key={state.lastOutcome.roundId} state={state} selfId={self.id} /> : null;
    case "victory":
      return (
        <div className="text-center">
          <div className="text-7xl">🏆</div>
          <h2 className="mt-2 font-draw-display text-4xl font-extrabold text-amber-300">Hạ boss rồi!</h2>
          <p className="mt-2 text-violet-100">Bạn nhận được {myTopics.length} thẻ công thức:</p>
          <div className="mt-5 space-y-3">
            {myTopics.map((id) => (
              <div key={id} className="animate-bounce-in rounded-2xl border-2 border-amber-300/70 bg-violet-900/70 px-4 py-3 text-left">
                <div className="font-draw-display text-xl font-extrabold">{TOPIC_CATALOG[id].icon} {TOPIC_CATALOG[id].name}</div>
                <div className="font-mono text-sm text-amber-200"><MathText text={TOPIC_CATALOG[id].formulas[0]} /></div>
              </div>
            ))}
          </div>
        </div>
      );
    case "vote":
      return <VotePanel state={state} selfId={self.id} send={send} />;
    case "done": {
      const theme = THEMES.find((option) => option.id === state.chosenTheme);
      return (
        <div className="text-center">
          <div className="text-7xl">{theme?.icon ?? "🏆"}</div>
          <p className="mt-3 text-sm font-bold uppercase tracking-[0.25em] text-amber-300">{theme?.name}</p>
          <h2 className="mt-1 font-draw-display text-4xl font-extrabold">{state.chosenTeamName}</h2>
          <p className="mt-3 text-violet-100">Hẹn gặp lại ở Math Quest! ⚔️</p>
          <Link href="/math-quest" className="mt-6 inline-block rounded-xl bg-amber-400 px-6 py-3 font-draw-display text-lg font-extrabold text-violet-950">
            📒 Ôn lại bài trong sổ tay ▸
          </Link>
        </div>
      );
    }
  }
}

function LookUp({ title, detail }: { title: string; detail?: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="text-6xl">👀</div>
      <h2 className="mt-3 font-draw-display text-3xl font-extrabold">{title}</h2>
      {detail && <p className="mt-2 text-lg text-violet-200">{detail}</p>}
    </div>
  );
}

/** In case of a mis-tap when joining. */
function GradeSwitch({ self, send }: { self: MathBossPlayer; send: Send }) {
  return (
    <div className="mt-5 inline-flex rounded-full border border-white/15 bg-white/5 p-1">
      {GRADES.map((grade) => (
        <button
          key={grade}
          onClick={() => send({ type: "set_grade", grade })}
          className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${self.grade === grade ? "bg-amber-400 text-violet-950" : "text-violet-200"}`}
        >
          Lớp {grade}
        </button>
      ))}
    </div>
  );
}

function HeroPicker({ state, self, send }: { state: PublicMathBossState; self: MathBossPlayer; send: Send }) {
  const taken = new Set(state.players.filter((player) => player.id !== self.id).map((player) => player.hero?.color));
  const color = self.hero?.color ?? COLOR_IDS.find((id) => !taken.has(id)) ?? "red";
  const pick = (weapon: HeroWeapon, nextColor: HeroColor) => send({ type: "pick_hero", weapon, color: nextColor });

  return (
    <div>
      <h2 className="text-center font-draw-display text-3xl font-extrabold">Chọn nhân vật</h2>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {WEAPONS.map((weapon) => {
          const chosen = self.hero?.weapon === weapon.id;
          return (
            <button
              key={weapon.id}
              onClick={() => pick(weapon.id, color)}
              className={`flex flex-col items-center rounded-2xl border-2 p-3 transition ${chosen ? "border-amber-300 bg-amber-300/15" : "border-white/10 bg-white/5"}`}
            >
              <HeroSprite hero={{ weapon: weapon.id, color }} className="h-32 w-32" />
              <span className="mt-1 font-draw-display text-xl font-extrabold">{weapon.icon} {weapon.name}</span>
              <span className="text-xs text-violet-200">{weapon.pitch}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-5 text-sm font-bold uppercase tracking-wider text-violet-200">Màu khăn</p>
      <div className="mt-2 flex flex-wrap gap-2.5">
        {COLOR_IDS.map((id) => (
          <button
            key={id}
            onClick={() => pick(self.hero?.weapon ?? "bow", id)}
            aria-label={`Màu ${id}`}
            disabled={taken.has(id)}
            className={`h-11 w-11 rounded-full border-4 transition disabled:opacity-20 ${color === id ? "border-white" : "border-transparent"}`}
            style={{ backgroundColor: HERO_PALETTE[id].main }}
          />
        ))}
      </div>
      <p className="mt-5 text-center text-sm text-violet-200">
        {self.hero ? "✓ Đã chọn — nhìn lên màn hình lớn!" : "Bấm vào một nhân vật để chọn"}
      </p>
    </div>
  );
}

function QuestionPanel({ question, label, startedAt, endsAt, shot, onSubmit }: {
  question: PublicQuestion;
  label: string;
  startedAt: number;
  endsAt: number;
  shot: Shot | null;
  onSubmit: (value: number) => void;
}) {
  const [sent, setSent] = useState(false);
  const done = sent || shot !== null;
  const submit = (value: number) => {
    if (done) return;
    setSent(true);
    playPop();
    onSubmit(value);
  };

  useEffect(() => {
    if (shot?.hit) playCorrect();
  }, [shot?.hit]);

  return (
    <div>
      <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-amber-300">{label}</p>
      <p className="mt-1 text-center font-draw-display text-2xl font-extrabold text-rose-200">🎯 {question.callout}</p>
      <p className="mt-3 text-center font-mono text-3xl font-bold leading-snug"><MathText text={question.prompt} /></p>
      <div className="mt-4">
        <TimeBar startedAt={startedAt} endsAt={endsAt} />
      </div>

      {done ? (
        <ShotFeedback shot={shot} />
      ) : question.kind === "choice" ? (
        <div className="mt-5 grid gap-2.5">
          {question.options.map((option, index) => (
            <button
              key={option}
              onClick={() => submit(index)}
              className="flex items-center gap-3 rounded-xl border-2 border-white/10 bg-white/10 px-4 py-3.5 text-left font-mono text-xl transition active:scale-[0.98] active:border-amber-300"
            >
              <span className="font-draw-display text-2xl font-black text-amber-300">{LETTERS[index]}</span>
              <MathText text={option} />
            </button>
          ))}
        </div>
      ) : (
        <NumberPad onSubmit={submit} />
      )}
    </div>
  );
}

function ShotFeedback({ shot }: { shot: Shot | null }) {
  if (!shot) {
    return (
      <div className="mt-6 rounded-2xl border border-cyan-400/40 bg-white/10 p-6 text-center">
        <p className="text-lg text-violet-100">Đã gửi! Đang ngắm bắn…</p>
      </div>
    );
  }
  return shot.hit ? (
    <div className="animate-bounce-in mt-6 rounded-2xl border-2 border-emerald-400/60 bg-emerald-500/15 p-6 text-center">
      <div className="text-6xl">🎯</div>
      <p className="mt-1 font-draw-display text-4xl font-extrabold text-emerald-300">Trúng rồi!</p>
      <p className="mt-1 text-emerald-100">Nhìn lên màn hình — phát bắn của bạn đang bay!</p>
    </div>
  ) : (
    <div className="animate-bounce-in mt-6 rounded-2xl border-2 border-white/15 bg-white/5 p-6 text-center">
      <div className="text-5xl">💨</div>
      <p className="mt-1 font-draw-display text-3xl font-extrabold">Trượt mất rồi</p>
      <p className="mt-1 text-violet-200">Hết lượt sẽ có cách làm — xem kỹ nhé!</p>
    </div>
  );
}

function NumberPad({ onSubmit }: { onSubmit: (value: number) => void }) {
  const [value, setValue] = useState("");
  const press = (key: string) => {
    if (key === "⌫") setValue((current) => current.slice(0, -1));
    else if (/^\d$/.test(key)) setValue((current) => (current.length >= MAX_DIGITS ? current : (current + key).replace(/^0+(?=\d)/, "")));
    playTypeTick();
  };
  const submit = () => {
    if (value) onSubmit(Number(value));
  };

  // A laptop keyboard works too.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") press("⌫");
      else if (event.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <div className="mt-5 flex h-16 items-center justify-end rounded-xl border-2 border-cyan-400/50 bg-black/30 px-4 font-mono text-4xl font-bold">
        {value || <span className="text-white/25">?</span>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0"].map((key) => (
          <button
            key={key}
            onClick={() => press(key)}
            className={`h-16 rounded-xl font-mono text-3xl font-bold transition active:scale-95 ${key === "⌫" ? "bg-white/5 text-violet-200" : "bg-white/10 hover:bg-white/15"}`}
          >
            {key}
          </button>
        ))}
        <button
          onClick={submit}
          disabled={!value}
          className="h-16 rounded-xl bg-amber-400 font-draw-display text-2xl font-extrabold text-violet-950 transition active:scale-95 disabled:opacity-40"
        >
          Bắn!
        </button>
      </div>
    </>
  );
}

function ResultCard({ state, selfId }: { state: PublicMathBossState; selfId: string }) {
  const outcome = state.lastOutcome!;
  const mine = outcome.results.find((result) => result.playerId === selfId);
  if (!mine) return <LookUp title="Nhìn lên màn hình lớn!" />;
  const { question } = mine;
  const givenText = mine.given === null ? null : question.kind === "choice" ? question.options[mine.given] : formatNumber(mine.given);

  return (
    <div>
      <p className={`text-center font-draw-display text-3xl font-extrabold ${mine.correct ? "text-emerald-300" : "text-violet-100"}`}>
        {mine.correct ? "🎯 Bạn đã bắn trúng!" : mine.given === null ? "⏰ Hết giờ mất rồi!" : "💭 Lần này trượt — xem cách làm nhé"}
      </p>
      {outcome.combo && <p className="mt-2 text-center font-draw-display text-xl font-extrabold text-amber-300">⚡ COMBO! Cả đội cùng trúng</p>}
      <div className="mt-4 rounded-xl bg-black/30 p-4">
        <p className="font-mono text-xl"><MathText text={question.prompt} /></p>
        {givenText && !mine.correct && (
          <p className="mt-2 text-sm text-violet-300">Bạn chọn: <span className="font-mono"><MathText text={givenText} /></span></p>
        )}
        <p className="mt-2 font-mono text-xl font-bold text-amber-300">→ <MathText text={question.answerText} /></p>
        <ol className="mt-2 space-y-1 font-mono text-sm text-violet-100">
          {question.steps.map((step, index) => (
            <li key={step}><span className="text-amber-300">{index + 1}.</span> <MathText text={step} /></li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function VotePanel({ state, selfId, send }: { state: PublicMathBossState; selfId: string; send: Send }) {
  const myVote = state.themeVotes[selfId];
  const myIdea = state.teamNameIdeas[selfId] ?? "";
  const [teamName, setTeamName] = useState(myIdea);

  return (
    <div>
      <h2 className="text-center font-draw-display text-3xl font-extrabold">Chọn thế giới cho Math Quest</h2>
      <div className="mt-5 space-y-3">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => send({ type: "vote_theme", theme: theme.id })}
            className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${
              myVote === theme.id ? "border-amber-300 bg-amber-300/15" : "border-white/10 bg-white/5"
            }`}
          >
            <span className="text-4xl">{theme.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-draw-display text-xl font-extrabold">{theme.name}</span>
              <span className="block text-sm text-violet-200">{theme.pitch}</span>
            </span>
            {myVote === theme.id && <span className="text-2xl text-amber-300">✓</span>}
          </button>
        ))}
      </div>
      <label className="mt-6 block">
        <span className="text-sm font-bold uppercase tracking-wider text-violet-200">Đề xuất tên đội</span>
        <div className="mt-2 flex gap-2">
          <input
            value={teamName}
            maxLength={24}
            onChange={(event) => setTeamName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && send({ type: "team_name", name: teamName })}
            placeholder="VD: Biệt đội Bình Phương"
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none placeholder:text-violet-300/60 focus:border-amber-300"
          />
          <button
            onClick={() => send({ type: "team_name", name: teamName })}
            disabled={!teamName.trim() || teamName.trim() === myIdea}
            className="rounded-xl bg-amber-400 px-5 font-bold text-violet-950 disabled:opacity-40"
          >
            Gửi
          </button>
        </div>
        {myIdea && <p className="mt-2 text-sm text-emerald-300">✓ Đã gửi: {myIdea}</p>}
      </label>
    </div>
  );
}
