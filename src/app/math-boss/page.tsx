"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { drawFontClass } from "@/lib/drawFonts";
import { playClick } from "@/lib/sound";

// Numbers only: students type the code on a phone keypad.
const makeCode = () => String(Math.floor(10000 + Math.random() * 90000));

export default function MathBossHomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const join = () => {
    const value = code.trim();
    if (value) router.push(`/math-boss/${value}`);
  };

  return (
    <main className={`${drawFontClass} bg-mathboss flex min-h-app items-center justify-center px-4 text-white`}>
      <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur">
        <div className="text-6xl">🧮</div>
        <h1 className="mt-2 font-draw-display text-4xl font-extrabold">Quái Máy Tính</h1>
        <p className="mt-2 text-sm text-violet-200">Học sinh: nhập mã phòng đang hiện trên màn hình lớn.</p>
        <div className="mt-5 flex gap-2">
          <input
            value={code}
            inputMode="numeric"
            maxLength={8}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            onKeyDown={(event) => event.key === "Enter" && join()}
            placeholder="Mã phòng"
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-violet-300/60 focus:border-amber-300"
          />
          <button onClick={join} disabled={!code} className="rounded-xl bg-amber-400 px-5 font-bold text-violet-950 disabled:opacity-40">
            Vào
          </button>
        </div>
        <div className="my-5 flex items-center gap-3 text-xs text-violet-300">
          <span className="h-px flex-1 bg-white/10" />gia sư<span className="h-px flex-1 bg-white/10" />
        </div>
        <button
          onClick={() => {
            playClick();
            router.push(`/math-boss/${makeCode()}?host=1`);
          }}
          className="w-full rounded-xl border-2 border-white/15 px-4 py-3 font-semibold text-violet-100 transition hover:border-amber-300 hover:text-white"
        >
          🖥️ Tạo phòng (màn hình chiếu)
        </button>
        <Link href="/math-quest" className="mt-5 block text-sm text-violet-300 hover:text-white">← Về Math Quest (sổ tay bài học)</Link>
      </section>
    </main>
  );
}
