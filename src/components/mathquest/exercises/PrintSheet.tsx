"use client";

import type { ExerciseAnswer } from "@/lib/mathQuest/exerciseTypes";
import { MathRich } from "./MathRich";
import type { PrintMode } from "./ExerciseCards";

// What the printer gets: a worksheet for the kids (name line, problems with
// room to breathe), and/or the answer key on its own page. Hidden on screen;
// the rest of the page is hidden in print.

export interface PrintJob {
  mode: PrintMode;
  title: string;
  subtitle: string;
  items: { statement: string; answer?: ExerciseAnswer }[];
}

export function PrintSheet({ job }: { job: PrintJob }) {
  const sheet = job.mode !== "answers";
  const key = job.mode !== "sheet";
  return (
    <div className="hidden bg-white text-[13pt] leading-relaxed text-black print:block">
      <style>{"@page { size: A4; margin: 16mm 15mm; }"}</style>
      {sheet && (
        <section>
          <h1 className="text-center text-[17pt] font-bold uppercase">{job.title}</h1>
          <p className="mt-1 text-center italic">{job.subtitle}</p>
          <p className="mt-5">Họ và tên: ......................................................... Lớp: ............ Ngày: ....................</p>
          <ol className="mt-6 space-y-7">
            {job.items.map((item, index) => (
              <li key={index} className="break-inside-avoid">
                <b>Câu {index + 1}. </b>
                <MathRich text={item.statement} />
              </li>
            ))}
          </ol>
        </section>
      )}
      {key && (
        <section className={sheet ? "break-before-page" : ""}>
          <h1 className="text-center text-[17pt] font-bold uppercase">Đáp án — {job.title}</h1>
          <p className="mt-1 text-center italic">{job.subtitle}</p>
          <ol className="mt-6 space-y-5">
            {job.items.map((item, index) => (
              <li key={index} className="break-inside-avoid">
                <p>
                  <b>Câu {index + 1}. </b>
                  {sheet ? null : (
                    <span className="text-[11pt] text-gray-700">
                      <MathRich text={item.statement} />
                    </span>
                  )}
                </p>
                <p className="mt-1">
                  <b>Đáp số: </b>
                  <MathRich text={item.answer?.answer || "—"} />
                </p>
                {item.answer && item.answer.solution.length > 0 && (
                  <ol className="mt-1 list-decimal pl-6 text-[12pt]">
                    {item.answer.solution.map((step, stepIndex) => (
                      <li key={stepIndex}>
                        <MathRich text={step} />
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
