"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { makeRoomId } from "@/lib/player";

export default function WerewolfHomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const join = () => { const value = code.trim().toUpperCase(); if (value) router.push(`/werewolf/${value}`); };
  return (
    <main className="flex min-h-app items-center justify-center bg-gradient-to-b from-slate-950 via-violet-950 to-slate-900 px-4 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/70 p-7 shadow-2xl backdrop-blur sm:p-10">
        <div className="mb-6 text-5xl">🐺</div>
        <h1 className="text-3xl font-bold">Ma Sói Cùng Phòng</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">Mọi vai đều hành động trong đêm. Không còn bị lộ chỉ vì tiếng chuột hay bàn phím.</p>
        <button onClick={() => router.push(`/werewolf/${makeRoomId()}`)} className="mt-7 w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400">Tạo phòng mới</button>
        <div className="my-5 flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-white/10" />hoặc nhập mã phòng<span className="h-px flex-1 bg-white/10" /></div>
        <div className="flex gap-2">
          <input value={code} maxLength={8} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && join()} placeholder="MÃ PHÒNG" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono uppercase outline-none focus:border-violet-400" />
          <button onClick={join} className="rounded-xl border border-white/15 px-5 font-semibold hover:bg-white/10">Vào</button>
        </div>
        <p className="mt-6 text-xs leading-5 text-slate-500">Avatar tạo bởi <a className="underline" href="https://www.dicebear.com/styles/adventurer/" target="_blank" rel="noreferrer">DiceBear Adventurer</a> · artwork của Lisa Wischofsky · CC BY 4.0.</p>
        <Link href="/" className="mt-6 block text-center text-sm text-slate-400 hover:text-white">← Về trang chủ</Link>
      </section>
    </main>
  );
}

