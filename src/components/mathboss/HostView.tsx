"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  COMBO_BONUS,
  DAMAGE_PER_CORRECT,
  DEMOS,
  THEMES,
  TOPIC_CATALOG,
  WEAPONS,
  isRageWave,
  formatNumber,
  type Grade,
  type MathBossClientMessage,
  type MathBossPlayer,
  type PublicMathBossState,
} from "@shared/mathBossTypes";
import { fireworks } from "@/lib/confetti";
import { drawFontClass } from "@/lib/drawFonts";
import { playMatchWin, playUltimateReady } from "@/lib/sound";
import { LAST_HOST_ROOM_KEY } from "@/components/mathquest/shared";
import { Arena } from "./Arena";
import { BattleSetup } from "./BattleSetup";
import { DarkBack } from "./DarkBack";
import { Boss, HpBar, TimeBar, TypingScreen } from "./Boss";
import { MathText } from "./MathText";
import { TopicCard } from "./TopicCard";

type Send = (msg: MathBossClientMessage) => void;

const SHOW_TYPING_MS = 8000;
const LETTERS = ["A", "B", "C", "D"];
const TAUNTS = ["Hơ hơ, trượt rồi!", "Ta vẫn còn khỏe lắm!", "Thử lại đi nhóc!", "Máy tính bất bại!"];
const OUCH = ["Úi da!", "Á á!", "Sao giải nhanh thế?!", "Không thể nào!"];
const FIGHT_PHASES = new Set(["intro", "question", "result", "victory"]);
/** Phases that show the battlefield. It stays mounted across them so shots never re-fire. */
const ARENA_PHASES = new Set(["pick", "question", "result", "victory"]);

/** Stable pick per round so the boss doesn't change its line on every render. */
const lineFor = (lines: string[], seed: string) => lines[[...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % lines.length];
/** Grades actually at the table, so a class of two grade-8s never sees grade-9 cards. */
const gradesOf = (players: MathBossPlayer[]): Grade[] => [...new Set(players.map((player) => player.grade))].sort();

// The tutor's laptop / TV. Everything is sized to be read from across a room.
export function HostView({ state, send }: { state: PublicMathBossState; send: Send }) {
  // Opening the room starts on "what's in this fight"; the code for the kids
  // shows once that's saved. It can be reopened until the fight begins.
  const [setupOpen, setSetupOpen] = useState(state.phase === "lobby" && state.players.length === 0);

  // Remember this room so the tutor page can offer "Mở lại phòng" if the tab closes.
  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_HOST_ROOM_KEY, state.roomId);
    } catch {
      // No storage: no reopen shortcut, nothing else breaks.
    }
  }, [state.roomId]);
  const live = state.phase !== "lobby" && state.phase !== "done";
  const editable = state.phase === "lobby" || state.phase === "pick";
  const showSetup = setupOpen && editable;

  // Presentation clickers send PageDown / →, so the tutor can drive the
  // whole session without touching the laptop.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).tagName === "INPUT" || showSetup) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(event.key)) {
        event.preventDefault();
        send({ type: "next" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, showSetup]);

  const roundId = state.lastOutcome?.roundId;
  const combo = state.lastOutcome?.combo ?? false;
  useEffect(() => {
    if (combo) playUltimateReady();
  }, [roundId, combo]);
  useEffect(() => {
    if (state.phase !== "victory") return;
    playMatchWin();
    fireworks();
  }, [state.phase]);

  const outcome = state.lastOutcome;
  const hurt = (outcome?.damage ?? 0) > 0;
  const rage = isRageWave(state.wave, state.topicWaves);
  const multiplier = rage ? (state.questionIndex >= 8 ? 3 : state.questionIndex >= 5 ? 2 : 1) : 1;

  return (
    <main className={`${drawFontClass} bg-mathboss flex min-h-app flex-col overflow-x-clip px-4 py-4 text-white sm:px-8`}>
      {/* On a phone: back + room code on one row, the boss's HP bar on its own row below. */}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <DarkBack
            href="/math-quest/tutor"
            label="Trang gia sư"
            confirmText={live ? "Rời màn hình chiếu? Trận vẫn được giữ — mở lại bằng nút \"Mở lại phòng\" ở trang gia sư, các bạn không phải nhập mã lại." : null}
          />
          <div className="hidden font-draw-display text-2xl font-extrabold tracking-tight sm:block">🧮 Quái Máy Tính</div>
        </div>
        {FIGHT_PHASES.has(state.phase) && state.bossMaxHp > 0 && (
          <div className="order-last w-full sm:order-none sm:w-auto sm:max-w-xl sm:flex-1">
            <HpBar hp={state.bossHp} maxHp={state.bossMaxHp} />
          </div>
        )}
        <div className="shrink-0 text-right">
          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-300">Mã phòng</div>
          <div className="font-mono text-xl font-black tracking-[0.2em] text-amber-300 sm:text-2xl">{state.roomId}</div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-5 py-5">
        {showSetup ? (
          <BattleSetup
            config={state.config}
            onSave={(config) => {
              send({ type: "configure", config });
              setSetupOpen(false);
            }}
          />
        ) : (
          <>
        {state.phase === "pick" && <PickHeading state={state} />}
        {ARENA_PHASES.has(state.phase) && (
          <Arena
            players={state.players}
            phase={state.phase}
            shots={state.shots}
            startedAt={state.questionStartedAt}
            endsAt={state.questionEndsAt}
            rage={rage}
            bossHp={state.bossHp}
            bossMaxHp={state.bossMaxHp}
            shotDamage={DAMAGE_PER_CORRECT * multiplier}
            roundId={state.phase === "result" ? outcome?.roundId ?? null : null}
            roundDamage={state.phase === "result" ? outcome?.damage ?? 0 : 0}
            combo={state.phase === "result" && Boolean(outcome?.combo)}
            comboDamage={COMBO_BONUS * multiplier}
            speech={
              state.phase === "result" && outcome
                ? hurt ? (outcome.combo ? "Á á, COMBO!!" : lineFor(OUCH, outcome.roundId)) : lineFor(TAUNTS, outcome.roundId)
                : state.phase === "question" ? "Đỡ chiêu này!" : null
            }
          />
        )}
        <Stage state={state} send={send} />
          </>
        )}
      </section>

      {/* Kept clear of the site's floating sound buttons: room below them on a phone, beside them wider. */}
      <footer className="flex flex-wrap items-end justify-between gap-4 pb-14 sm:pb-0 sm:pr-28">
        <PlayerChips state={state} />
        <div className="flex flex-wrap gap-3">
          {editable && !showSetup && (
            <button
              onClick={() => setSetupOpen(true)}
              className="rounded-xl border-2 border-white/20 px-5 py-3 font-draw-display text-lg font-bold text-violet-100 transition hover:bg-white/10"
            >
              ⚙️ Nội dung trận
            </button>
          )}
          {rage && (state.phase === "question" || state.phase === "result") && (
            <button
              onClick={() => send({ type: "finish_boss" })}
              className="rounded-xl border-2 border-rose-400/60 px-5 py-3 font-draw-display text-lg font-bold text-rose-200 transition hover:bg-rose-500/20"
            >
              💥 Kết liễu
            </button>
          )}
          {!showSetup && <NextButton state={state} onNext={() => send({ type: "next" })} onReplay={() => send({ type: "play_again" })} />}
        </div>
      </footer>
    </main>
  );
}

function Stage({ state, send }: { state: PublicMathBossState; send: Send }) {
  switch (state.phase) {
    case "lobby":
      return <LobbyStage state={state} />;
    case "pick":
      return null;
    case "show":
      return <ShowStage key={state.showIndex} index={state.showIndex} revealed={state.showRevealed} />;
    case "intro":
      return isRageWave(state.wave, state.topicWaves) ? <RageStage state={state} /> : <TopicStage state={state} />;
    case "question":
      return <QuestionCards state={state} />;
    case "result":
      return <ResultCards state={state} />;
    case "victory":
      return <VictoryStage state={state} />;
    case "vote":
      return <VoteStage state={state} send={send} />;
    case "done":
      return <DoneStage state={state} />;
  }
}

function LobbyStage({ state }: { state: PublicMathBossState }) {
  const [host] = useState(() => (typeof window === "undefined" ? "" : window.location.host));
  return (
    <div className="text-center">
      <Boss mood="idle" screen={<span>HELLO</span>} />
      <h1 className="mt-6 font-draw-display text-3xl font-extrabold sm:mt-10 sm:text-5xl lg:text-6xl">Ai dám thách đấu Quái Máy Tính?</h1>
      <p className="mt-5 text-lg text-violet-100 sm:text-2xl">
        Mở điện thoại, vào <b className="text-cyan-300">{host}/math-boss</b> rồi nhập mã
      </p>
      <p className="mt-3 font-mono text-6xl font-black tracking-[0.3em] text-amber-300 sm:text-8xl">{state.roomId}</p>
    </div>
  );
}

function PickHeading({ state }: { state: PublicMathBossState }) {
  const ready = state.players.filter((player) => player.hero).length;
  return (
    <div className="text-center">
      <h2 className="font-draw-display text-3xl font-extrabold sm:text-5xl">Chọn nhân vật!</h2>
      <p className="mt-2 text-base text-violet-200 sm:text-xl">
        {WEAPONS.map((weapon) => `${weapon.icon} ${weapon.name}`).join("  hay  ")} — chọn trên điện thoại · {ready}/{state.players.length} đã chọn
      </p>
    </div>
  );
}

// The calculator grinds through the arithmetic; the tutor spots the hằng
// đẳng thức and answers first. Revealing shows exactly how.
function ShowStage({ index, revealed }: { index: number; revealed: boolean }) {
  const [startedAt] = useState(() => Date.now());
  const demo = DEMOS[index];
  return (
    <div className="grid w-full items-center gap-6 lg:grid-cols-[auto_1fr] lg:gap-12">
      <Boss
        mood={revealed ? "hit" : "idle"}
        speech={revealed ? "Ơ… ta còn chưa bấm xong!" : "Để ta bấm cho!"}
        screen={<TypingScreen text={demo.lcd} startedAt={startedAt} durationMs={SHOW_TYPING_MS} result={revealed ? formatNumber(demo.answer) : null} />}
      />
      <div className="text-center lg:text-left">
        <p className="text-lg font-bold uppercase tracking-[0.2em] text-amber-300">Màn thách đấu {index + 1}/{DEMOS.length}</p>
        <h2 className="mt-2 font-draw-display text-2xl font-extrabold sm:text-4xl">Ai tính nhanh hơn: thầy/cô hay Quái Máy Tính?</h2>
        <p className="mt-6 break-words font-mono text-3xl font-black text-cyan-200 sm:text-5xl lg:text-6xl"><MathText text={demo.prompt} /></p>
        {revealed && (
          <div className="animate-bounce-in mt-6">
            <p className="font-mono text-4xl font-black text-amber-300 sm:text-6xl">= {formatNumber(demo.answer)}</p>
            <ol className="mt-4 space-y-1.5 break-words font-mono text-lg text-violet-100 sm:text-2xl">
              {demo.steps.map((step, stepIndex) => (
                <li key={step}><span className="text-amber-300">{stepIndex + 1}.</span> <MathText text={step} /></li>
              ))}
            </ol>
            <p className="mt-4 text-base text-violet-200 sm:text-xl">Bí mật là… hằng đẳng thức! Máy tính đâu có biết 😎</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TopicStage({ state }: { state: PublicMathBossState }) {
  const grades = gradesOf(state.players);
  return (
    <div className="w-full">
      <p className="text-center text-lg font-bold uppercase tracking-[0.2em] text-amber-300">
        Đợt {state.wave}/{state.topicWaves + 1} · Ôn chiêu trước khi đánh boss
      </p>
      <div className={`mt-5 grid gap-6 ${grades.length > 1 ? "lg:grid-cols-2" : "mx-auto max-w-2xl"}`}>
        {grades.map((grade) => {
          const topics = state.config.topics[grade];
          // A grade with fewer dạng than waves spends the extra waves on mixed review.
          return state.wave <= topics.length ? (
            <TopicCard key={grade} topic={TOPIC_CATALOG[topics[state.wave - 1]]} />
          ) : (
            <MixedReviewCard key={grade} grade={grade} topics={topics} />
          );
        })}
      </div>
    </div>
  );
}

function MixedReviewCard({ grade, topics }: { grade: Grade; topics: PublicMathBossState["config"]["topics"][Grade] }) {
  return (
    <article className="rounded-2xl border-2 border-amber-300/70 bg-gradient-to-b from-violet-900/90 to-[#1a1240]/95 p-6 text-left">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">📜 Lớp {grade} · Ôn tổng hợp</p>
      <h2 className="mt-1 font-draw-display text-2xl font-extrabold sm:text-3xl">Trộn các dạng đã học</h2>
      <ul className="mt-3 space-y-1.5">
        {topics.map((id) => (
          <li key={id} className="rounded-lg bg-black/25 px-3 py-1.5 text-lg">{TOPIC_CATALOG[id].icon} {TOPIC_CATALOG[id].name}</li>
        ))}
      </ul>
    </article>
  );
}

function RageStage({ state }: { state: PublicMathBossState }) {
  return (
    <div className="text-center">
      <Boss mood="rage" speech="Ta sẽ tung đủ mọi chiêu!" screen={<span>ERROR!!</span>} />
      <h2 className="mt-6 font-draw-display text-4xl font-extrabold text-rose-300 sm:mt-10 sm:text-6xl">Quái Máy Tính nổi giận!</h2>
      <p className="mt-3 text-lg text-violet-100 sm:text-2xl">Đợt cuối: trộn cả 3 dạng. Hạ gục nó đi!</p>
      <div className="mt-6 flex flex-wrap justify-center gap-6">
        {gradesOf(state.players).map((grade) => (
          <ul key={grade} className="space-y-2 text-left">
            <li className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">Lớp {grade}</li>
            {state.config.topics[grade].map((id) => (
              <li key={id} className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-1.5 text-lg">
                {TOPIC_CATALOG[id].icon} {TOPIC_CATALOG[id].name}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

// One card per student under the battlefield: the boss's line with their
// name, their own question, and whether they've answered yet.
function QuestionCards({ state }: { state: PublicMathBossState }) {
  if (!state.questionStartedAt || !state.questionEndsAt) return null;
  const targets = state.players.filter((player) => state.questions[player.id]);
  return (
    <div className="w-full">
      <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-amber-300">
        Đợt {state.wave} · Lượt {state.questionIndex + 1}{isRageWave(state.wave, state.topicWaves) ? "" : `/${state.config.questionsPerWave}`}
      </p>
      <div className={`mt-3 grid gap-4 ${targets.length > 1 ? "md:grid-cols-2" : "mx-auto max-w-3xl"}`}>
        {targets.map((player) => {
          const question = state.questions[player.id];
          const shot = state.shots.find((candidate) => candidate.playerId === player.id);
          return (
            <article
              key={player.id}
              className={`rounded-2xl border-2 p-4 transition ${
                shot ? (shot.hit ? "border-emerald-400/60 bg-emerald-500/10" : "border-white/15 bg-white/5 opacity-70") : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-draw-display text-xl font-extrabold text-amber-300">🎯 {question.callout}</p>
                <span className="shrink-0 rounded-full bg-white/10 px-3 py-0.5 text-sm font-bold">Lớp {question.grade}</span>
              </div>
              <p className="mt-2 break-words font-mono text-2xl font-bold leading-snug sm:text-3xl"><MathText text={question.prompt} /></p>
              {question.kind === "choice" ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, index) => (
                    <p key={option} className="rounded-lg bg-black/25 px-3 py-1.5 font-mono text-lg">
                      <span className="mr-2 font-draw-display font-black text-amber-300">{LETTERS[index]}</span>
                      <MathText text={option} />
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-lg text-violet-200">Gõ đáp số trên điện thoại</p>
              )}
              <p className={`mt-3 text-lg font-bold ${shot ? (shot.hit ? "text-emerald-300" : "text-violet-300") : "text-violet-300"}`}>
                {shot ? (shot.hit ? "🎯 Trúng!" : "💨 Trượt mất rồi") : "Đang suy nghĩ…"}
              </p>
            </article>
          );
        })}
      </div>
      <div className="mx-auto mt-4 max-w-3xl">
        <TimeBar startedAt={state.questionStartedAt} endsAt={state.questionEndsAt} />
      </div>
    </div>
  );
}

function ResultCards({ state }: { state: PublicMathBossState }) {
  const outcome = state.lastOutcome;
  if (!outcome) return null;
  return (
    <div className="w-full">
      {(outcome.combo || outcome.multiplier > 1) && (
        <div className="mb-3 text-center">
          {outcome.combo && (
            <p className="animate-bounce-in inline-block rounded-full bg-amber-400 px-5 py-1.5 font-draw-display text-2xl font-black text-violet-950">
              ⚡ COMBO! Cả đội cùng trúng
            </p>
          )}
          {outcome.multiplier > 1 && <p className="mt-1 text-xl font-bold text-rose-300">Quái kiệt sức: sát thương ×{outcome.multiplier}</p>}
        </div>
      )}
      <div className={`grid gap-4 ${outcome.results.length > 1 ? "md:grid-cols-2" : "mx-auto max-w-3xl"}`}>
        {outcome.results.map((result) => {
          const player = state.players.find((candidate) => candidate.id === result.playerId);
          return (
            <article
              key={result.playerId}
              className={`animate-bounce-in rounded-2xl border-2 p-4 ${result.correct ? "border-emerald-400/60 bg-emerald-500/15" : "border-white/15 bg-white/5"}`}
            >
              <p className={`font-draw-display text-xl font-extrabold ${result.correct ? "text-emerald-300" : "text-violet-100"}`}>
                {result.correct ? `✓ ${player?.name ?? "?"} bắn trúng!` : `💭 ${player?.name ?? "?"} chưa trúng — xem cách làm nhé`}
              </p>
              <p className="mt-1.5 font-mono text-xl"><MathText text={result.question.prompt} /></p>
              <p className="mt-1.5 font-mono text-xl font-bold text-amber-300">→ <MathText text={result.question.answerText} /></p>
              <ol className="mt-2 space-y-0.5 font-mono text-base text-violet-100">
                {result.question.steps.map((step, index) => (
                  <li key={step}><span className="text-amber-300">{index + 1}.</span> <MathText text={step} /></li>
                ))}
              </ol>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function VictoryStage({ state }: { state: PublicMathBossState }) {
  return (
    <div className="text-center">
      <h2 className="font-draw-display text-4xl font-extrabold text-amber-300 sm:text-6xl">Hạ gục Quái Máy Tính! 🏆</h2>
      <p className="mt-2 text-lg text-violet-100 sm:text-2xl">
        Cả đội bắn trúng <b className="text-white">{state.teamCorrect}</b>/{state.teamAnswered} phát
      </p>
      <p className="mt-6 text-lg font-bold uppercase tracking-[0.2em] text-violet-200">Thẻ công thức đầu tiên của các bạn</p>
      <div className="mt-3 flex flex-wrap justify-center gap-8">
        {gradesOf(state.players).map((grade) => (
          <div key={grade}>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">Lớp {grade}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {state.config.topics[grade].map((id) => (
                <div key={id} className="animate-bounce-in w-44 rounded-2xl border-2 border-amber-300/70 bg-violet-900/70 px-4 py-3 shadow-[0_0_30px_-10px_rgba(252,211,77,0.6)]">
                  <div className="text-4xl">{TOPIC_CATALOG[id].icon}</div>
                  <div className="mt-1 font-draw-display text-lg font-extrabold leading-tight">{TOPIC_CATALOG[id].name}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VoteStage({ state, send }: { state: PublicMathBossState; send: Send }) {
  const nameOf = (id: string) => state.players.find((player) => player.id === id)?.name ?? "?";
  const ideas = Object.entries(state.teamNameIdeas);
  return (
    <div className="w-full">
      <h2 className="text-center font-draw-display text-3xl font-extrabold sm:text-5xl">Chọn thế giới cho Math Quest</h2>
      <p className="mt-2 text-center text-base text-violet-200 sm:text-xl">Bỏ phiếu trên điện thoại. Hòa phiếu thì thầy/cô bấm chọn.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {THEMES.map((theme) => {
          const voters = Object.entries(state.themeVotes).filter(([, vote]) => vote === theme.id).map(([id]) => nameOf(id));
          const chosen = state.chosenTheme === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => send({ type: "pick_theme", theme: theme.id })}
              className={`rounded-2xl border-2 p-6 text-left transition ${
                chosen ? "border-amber-300 bg-amber-300/15 shadow-[0_0_40px_-10px_rgba(252,211,77,0.7)]" : "border-white/10 bg-white/5 hover:border-white/30"
              }`}
            >
              <div className="text-6xl">{theme.icon}</div>
              <h3 className="mt-3 font-draw-display text-3xl font-extrabold">{theme.name}</h3>
              <p className="mt-1 text-violet-200">{theme.pitch}</p>
              <p className="mt-4 text-lg font-bold text-cyan-200">
                {voters.length} phiếu{voters.length ? `: ${voters.join(", ")}` : ""}
              </p>
              {chosen && <p className="mt-1 font-bold text-amber-300">✓ Đã chọn</p>}
            </button>
          );
        })}
      </div>
      <div className="mt-8">
        <h3 className="text-2xl font-bold">Tên đội</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          {ideas.length === 0 && <p className="text-lg text-violet-200">Chờ các bạn đặt tên trên điện thoại…</p>}
          {ideas.map(([playerId, idea]) => (
            <button
              key={playerId}
              onClick={() => send({ type: "pick_team_name", name: idea })}
              className={`rounded-xl border-2 px-5 py-3 text-lg font-bold transition sm:text-2xl ${
                state.chosenTeamName === idea ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-white/10 bg-white/5 hover:border-white/30"
              }`}
            >
              {idea} <span className="text-base font-medium text-violet-300">— {nameOf(playerId)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DoneStage({ state }: { state: PublicMathBossState }) {
  const theme = THEMES.find((option) => option.id === state.chosenTheme);
  return (
    <div className="text-center">
      <div className="animate-bounce-in text-7xl sm:text-9xl">{theme?.icon ?? "🏆"}</div>
      <p className="mt-4 text-xl font-bold uppercase tracking-[0.25em] text-amber-300">{theme?.name}</p>
      <h2 className="mt-2 break-words font-draw-display text-4xl font-extrabold sm:text-7xl">{state.chosenTeamName}</h2>
      <p className="mt-5 text-lg text-violet-100 sm:text-2xl">
        {state.players.map((player) => player.name).join(" & ")} — hẹn gặp lại ở Math Quest! ⚔️
      </p>
      <p className="mt-6 text-lg text-violet-200">Các bạn bấm “Ôn lại bài trong sổ tay” trên điện thoại để xem lại công thức.</p>
      <Link href="/math-quest/tutor" className="mt-4 inline-block rounded-xl border-2 border-white/20 px-5 py-2.5 font-bold text-violet-100 hover:bg-white/10">
        🧑‍🏫 Về trang gia sư
      </Link>
    </div>
  );
}

function PlayerChips({ state }: { state: PublicMathBossState }) {
  if (state.players.length === 0) return <p className="text-lg text-violet-300">Chưa có ai vào phòng…</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {state.players.map((player) => (
        <span
          key={player.id}
          className={`animate-bounce-in flex items-center gap-2 rounded-full border px-4 py-2 text-base font-bold sm:text-lg ${
            player.connected ? "border-white/15 bg-white/10" : "border-white/5 bg-white/5 text-white/40"
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${player.connected ? "bg-emerald-400" : "bg-slate-500"}`} />
          {player.name}
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-violet-200">Lớp {player.grade}</span>
        </span>
      ))}
    </div>
  );
}

function NextButton({ state, onNext, onReplay }: { state: PublicMathBossState; onNext: () => void; onReplay: () => void }) {
  const label = (() => {
    switch (state.phase) {
      case "lobby": return "Chọn nhân vật ▶";
      case "pick": return "Bắt đầu ▶";
      case "show":
        if (!state.showRevealed) return "Hiện đáp án";
        return state.showIndex < DEMOS.length - 1 ? "Màn tiếp →" : "Vào trận →";
      case "intro": return isRageWave(state.wave, state.topicWaves) ? "🔥 Chiến!" : "⚔️ Đánh boss!";
      case "question": return "Hết giờ ngay";
      case "result": return "Lượt tiếp →";
      case "victory": return "Chọn thế giới →";
      case "vote": return "Chốt ✓";
      case "done": return "Chơi lại";
    }
  })();
  const disabled = state.phase === "lobby" && state.players.length === 0;
  return (
    <button
      onClick={state.phase === "done" ? onReplay : onNext}
      disabled={disabled}
      className={`rounded-xl px-7 py-3 font-draw-display text-xl font-extrabold transition disabled:opacity-40 ${
        state.phase === "question" ? "border-2 border-white/20 text-violet-100 hover:bg-white/10" : "bg-amber-400 text-violet-950 shadow-[0_6px_0_#b45309] hover:brightness-105 active:translate-y-0.5 active:shadow-[0_3px_0_#b45309]"
      }`}
    >
      {label}
    </button>
  );
}
