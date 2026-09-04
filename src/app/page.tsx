"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStoredName, makeRoomId, setStoredName } from "@/lib/player";
import { playClick } from "@/lib/sound";

const DOODLES: { emoji: string; className: string; delay: string }[] = [
  { emoji: "🎨", className: "left-[6%] top-[12%] text-5xl rotate-[-12deg]", delay: "0s" },
  { emoji: "✏️", className: "right-[8%] top-[18%] text-4xl rotate-[14deg]", delay: "1.5s" },
  { emoji: "🌈", className: "left-[10%] bottom-[16%] text-5xl rotate-[8deg]", delay: "3s" },
  { emoji: "⭐", className: "right-[10%] bottom-[22%] text-3xl rotate-[-8deg]", delay: "2s" },
  { emoji: "🖍️", className: "left-[45%] top-[6%] text-3xl rotate-[6deg]", delay: "4s" },
  { emoji: "🐱", className: "right-[20%] top-[8%] text-3xl rotate-[-4deg]", delay: "2.5s" },
];

const STEPS = [
  { icon: "🚪", title: "Tạo phòng & mời bạn", desc: "Gửi mã hoặc link phòng cho bạn bè, không cần đăng ký." },
  { icon: "🖌️", title: "Vẽ hoặc đoán chữ", desc: "Tới lượt thì vẽ, không tới lượt thì gõ đoán trong khung chat." },
  { icon: "🏆", title: "Ai nhanh hơn thắng nhiều điểm", desc: "Đoán càng sớm càng nhiều điểm, cuối ván có bảng xếp hạng." },
];

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    setName(getStoredName());
  }, []);

  function persistName() {
    const trimmed = name.trim().slice(0, 20);
    if (trimmed) setStoredName(trimmed);
    return trimmed;
  }

  function handleCreate() {
    playClick();
    const trimmed = persistName();
    if (!trimmed) return alert("Nhập tên của bạn trước đã!");
    router.push(`/room/${makeRoomId()}`);
  }

  function handleJoin() {
    playClick();
    const trimmed = persistName();
    if (!trimmed) return alert("Nhập tên của bạn trước đã!");
    const code = joinCode.trim().toUpperCase();
    if (!code) return alert("Nhập mã phòng!");
    router.push(`/room/${code}`);
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Playful animated background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float-blob absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand-200/50 blur-3xl" />
        <div className="animate-float-blob absolute -right-24 top-40 h-80 w-80 rounded-full bg-pink-200/50 blur-3xl [animation-delay:4s]" />
        <div className="animate-float-blob absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-yellow-200/50 blur-3xl [animation-delay:8s]" />
      </div>

      {/* Floating doodles */}
      <div className="pointer-events-none absolute inset-0 hidden md:block">
        {DOODLES.map((d, i) => (
          <span
            key={i}
            className={`animate-float-blob absolute select-none opacity-70 ${d.className}`}
            style={{ animationDelay: d.delay, animationDuration: "10s" }}
          >
            {d.emoji}
          </span>
        ))}
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-4 py-16">
        <div className="animate-pop-in text-center">
          <span className="mb-3 inline-block rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-600 shadow-sm">
            🎉 Miễn phí · Không cần tài khoản
          </span>
          <h1 className="text-5xl font-black tracking-tight text-slate-800">
            <span className="bg-gradient-to-r from-brand-500 via-pink-500 to-yellow-500 bg-clip-text text-transparent">
              Vẽ Cùng Tôi
            </span>{" "}
            🎨
          </h1>
          <p className="mt-3 text-base text-slate-500">Vẽ &amp; đoán chữ cùng bạn bè, ngay trên trình duyệt!</p>
        </div>

        <div className="w-full rounded-3xl border-4 border-white bg-white/90 p-6 shadow-xl shadow-brand-100 backdrop-blur">
          <label className="mb-1 block text-sm font-medium text-slate-600">Tên hiển thị của bạn</label>
          <input
            className="mb-5 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="Ví dụ: Phú"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <button
            onClick={handleCreate}
            className="mb-4 w-full rounded-xl bg-brand-500 px-4 py-3 font-semibold text-white shadow-md shadow-brand-200 transition hover:scale-[1.02] hover:bg-brand-600 active:scale-[0.98]"
          >
            🎉 Tạo phòng mới
          </button>

          <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            hoặc vào phòng có sẵn
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 uppercase outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="Mã phòng"
              maxLength={8}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
            <button
              onClick={handleJoin}
              className="rounded-xl bg-slate-800 px-5 py-2.5 font-semibold text-white transition hover:scale-[1.02] hover:bg-slate-900 active:scale-[0.98]"
            >
              Vào 🚀
            </button>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.title} className="rounded-2xl bg-white/70 p-3 text-center shadow-sm backdrop-blur">
              <div className="text-2xl">{s.icon}</div>
              <div className="mt-1 text-xs font-semibold text-slate-700">{s.title}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{s.desc}</div>
            </div>
          ))}
        </div>

        <p className="max-w-sm text-center text-xs text-slate-400">
          Tối đa 8 người / phòng. Gửi mã phòng hoặc link cho bạn bè để cùng chơi.
        </p>

        <Link
          href="/leaderboard"
          className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-brand-600 shadow-sm transition hover:scale-105 hover:bg-white"
        >
          🏆 Xem bảng xếp hạng
        </Link>
      </div>
    </main>
  );
}
