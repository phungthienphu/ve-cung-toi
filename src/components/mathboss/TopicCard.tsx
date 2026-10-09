import type { TopicInfo } from "@shared/mathBossTypes";
import { MathText } from "./MathText";

/** The formula card for one dạng toán: what to remember, the rule in words, and a worked example. */
export function TopicCard({ topic, size = "lg" }: { topic: TopicInfo; size?: "lg" | "sm" }) {
  const lg = size === "lg";
  return (
    <article className={`animate-bounce-in rounded-2xl border-2 border-amber-300/70 bg-gradient-to-b from-violet-900/90 to-[#1a1240]/95 text-left shadow-[0_0_40px_-10px_rgba(252,211,77,0.55)] ${lg ? "p-6" : "p-4"}`}>
      <p className={`font-bold uppercase tracking-[0.2em] text-amber-300 ${lg ? "text-sm" : "text-[11px]"}`}>📜 Lớp {topic.grade} · Thẻ công thức</p>
      <h2 className={`mt-1 font-draw-display font-extrabold leading-tight text-white ${lg ? "text-3xl sm:text-4xl" : "text-xl"}`}>
        {topic.icon} {topic.name}
      </h2>
      <div className={`mt-3 space-y-1 font-mono font-bold text-amber-200 ${lg ? "text-2xl" : "text-base"}`}>
        {topic.formulas.map((formula) => (
          <p key={formula}><MathText text={formula} /></p>
        ))}
      </div>
      <p className={`mt-3 text-violet-100 ${lg ? "text-lg" : "text-sm"}`}>{topic.rule}</p>
      <div className={`mt-4 rounded-xl bg-black/30 ${lg ? "p-4" : "p-3"}`}>
        <p className={`font-semibold text-cyan-200 ${lg ? "text-xl" : "text-sm"}`}>Ví dụ: <MathText text={topic.example.prompt} /></p>
        <ol className={`mt-2 space-y-1 font-mono text-white ${lg ? "text-xl" : "text-sm"}`}>
          {topic.example.steps.map((step) => (
            <li key={step}><MathText text={step} /></li>
          ))}
        </ol>
      </div>
    </article>
  );
}
