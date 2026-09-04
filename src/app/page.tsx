"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredName, makeRoomId, setStoredName } from "@/lib/player";

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
    const trimmed = persistName();
    if (!trimmed) return alert("Nhập tên của bạn trước đã!");
    router.push(`/room/${makeRoomId()}`);
  }

  function handleJoin() {
    const trimmed = persistName();
    if (!trimmed) return alert("Nhập tên của bạn trước đã!");
    const code = joinCode.trim().toUpperCase();
    if (!code) return alert("Nhập mã phòng!");
    router.push(`/room/${code}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tight text-brand-600">🎨 Vẽ Cùng Tôi</h1>
        <p className="mt-2 text-slate-500">Vẽ &amp; đoán chữ cùng bạn bè — không cần tài khoản!</p>
      </div>

      <div className="w-full rounded-2xl bg-white p-6 shadow-lg shadow-brand-100">
        <label className="mb-1 block text-sm font-medium text-slate-600">Tên hiển thị</label>
        <input
          className="mb-5 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          placeholder="Ví dụ: Phú"
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          onClick={handleCreate}
          className="mb-4 w-full rounded-xl bg-brand-500 px-4 py-3 font-semibold text-white shadow-md shadow-brand-200 transition hover:bg-brand-600 active:scale-[0.99]"
        >
          Tạo phòng mới
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
            className="rounded-xl bg-slate-800 px-5 py-2.5 font-semibold text-white transition hover:bg-slate-900 active:scale-[0.99]"
          >
            Vào
          </button>
        </div>
      </div>

      <p className="max-w-sm text-center text-xs text-slate-400">
        Tối đa 8 người / phòng. Gửi mã phòng hoặc link cho bạn bè để cùng chơi.
      </p>
    </main>
  );
}
