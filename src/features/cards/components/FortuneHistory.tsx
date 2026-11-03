"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { cardInfo } from "./deck";
import { TOPICS } from "./fortune";

// The admin's book of every reading given (/api/fortune/history), opened
// from the fortune table's header. Locked behind the Math Quest tutor
// password; the server keeps the session in a cookie.

interface HistoryItem {
  id: string;
  createdAt: string;
  name: string;
  question: string;
  topic: string;
  cards: number[];
  text: string;
  source: "ai" | "offline";
  status: "done" | "interrupted" | "refused";
  reason: string;
  model: string;
  visitor: string;
}

interface HistoryPage {
  items: HistoryItem[];
  nextCursor: string | null;
  total: number;
  today: number;
}

type View = { kind: "loading" } | { kind: "login"; error: string } | { kind: "error"; message: string } | { kind: "list" };

const OFFLINE_REASONS: Record<string, string> = {
  rate_limited: "hết lượt giờ",
  daily_limit: "hết lượt ngày",
  no_ai: "chưa có AI",
  ai_error: "AI lỗi",
};

function SourceBadge({ item }: { item: HistoryItem }) {
  if (item.status === "interrupted") return <Badge className="bg-amber-200 text-amber-900">⚠️ Bị ngắt</Badge>;
  if (item.status === "refused") return <Badge className="bg-stone-300 text-stone-800">🚫 AI từ chối</Badge>;
  if (item.source === "ai") return <Badge className="bg-[#5a0a18] text-[#f5e9cb]">✨ AI{item.model ? ` · ${item.model}` : ""}</Badge>;
  return <Badge className="bg-[#5a0a18]/15 text-[#5a0a18]">Đọc nhanh{OFFLINE_REASONS[item.reason] ? ` · ${OFFLINE_REASONS[item.reason]}` : ""}</Badge>;
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${className}`}>{children}</span>;
}

export function FortuneHistoryModal({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, today: 0 });
  const [query, setQuery] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  // Only the latest request may update the list (typing fires several).
  const latest = useRef(0);

  const load = useCallback(async (search: string, before: string | null) => {
    const request = ++latest.current;
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (before) params.set("before", before);
      const response = await fetch(`/api/fortune/history?${params}`, { cache: "no-store" });
      if (request !== latest.current) return;
      if (response.status === 401) {
        setView({ kind: "login", error: "" });
        return;
      }
      const data = (await response.json().catch(() => null)) as (HistoryPage & { error?: string }) | null;
      if (!response.ok || !data) {
        setView({ kind: "error", message: data?.error ?? "Không tải được lịch sử." });
        return;
      }
      setItems((current) => (before ? [...current, ...data.items] : data.items));
      setCursor(data.nextCursor);
      setStats({ total: data.total, today: data.today });
      setView({ kind: "list" });
    } catch {
      if (request === latest.current) setView({ kind: "error", message: "Mất kết nối, thử lại sau nhé." });
    } finally {
      if (request === latest.current) setBusy(false);
    }
  }, []);

  // First load, then search as you type.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(query.trim(), null), query ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/fortune/history/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) {
      setPassword("");
      void load(query.trim(), null);
      return;
    }
    const data = (await response?.json().catch(() => null)) as { error?: string } | null;
    setView({ kind: "login", error: data?.error ?? "Không mở khóa được, thử lại sau nhé." });
  }

  async function lock() {
    await fetch("/api/fortune/history/session", { method: "DELETE" }).catch(() => null);
    setItems([]);
    setView({ kind: "login", error: "" });
  }

  async function remove(item: HistoryItem) {
    if (!window.confirm(`Xóa quẻ của ${item.name || "ẩn danh"} khỏi lịch sử?`)) return;
    const response = await fetch(`/api/fortune/history?id=${item.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) return;
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setStats((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
  }

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lịch sử quẻ"
        onClick={(event) => event.stopPropagation()}
        className="md-scroll pc-pop flex max-h-full w-full max-w-3xl flex-col overflow-hidden"
        style={{ height: view.kind === "list" ? "88vh" : undefined }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#5a0a18]/20 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 className="font-seance text-2xl font-bold leading-tight text-[#5a0a18] sm:text-3xl">📜 Sổ quẻ</h2>
            {view.kind === "list" && (
              <p className="text-xs font-semibold text-[#5a0a18]/60">
                {stats.total} quẻ{query.trim() ? " khớp" : ""} · hôm nay {stats.today}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {view.kind === "list" && (
              <button type="button" onClick={lock} className="rounded-xl px-3 py-1.5 text-sm font-bold text-[#5a0a18]/70 transition hover:bg-[#5a0a18]/10 hover:text-[#5a0a18]">
                🔒 Khóa
              </button>
            )}
            <button
              type="button"
              aria-label="Đóng"
              onClick={onClose}
              className="rounded-full px-2.5 py-1 text-lg leading-none text-[#5a0a18]/60 transition hover:bg-[#5a0a18]/10 hover:text-[#5a0a18]"
            >
              ✕
            </button>
          </div>
        </div>

        {view.kind === "loading" && <p className="animate-pulse px-6 py-16 text-center font-seance text-xl text-[#5a0a18]/70">🕯️ Đang mở sổ…</p>}

        {view.kind === "error" && <p className="px-6 py-16 text-center text-[#5a0a18]">{view.message}</p>}

        {view.kind === "login" && (
          <form onSubmit={unlock} className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="text-5xl">🔒</span>
            <p className="font-seance text-xl text-[#5a0a18]">Sổ quẻ chỉ dành cho admin</p>
            <div className="flex w-full max-w-sm gap-2">
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mật khẩu admin"
                aria-label="Mật khẩu admin"
                className="min-w-0 flex-1 rounded-xl border border-[#5a0a18]/30 bg-white/70 px-4 py-2.5 font-semibold text-[#2a070d] outline-none focus:border-[#5a0a18] focus:shadow-[0_0_0_3px_rgba(90,10,24,0.15)]"
              />
              <button
                type="submit"
                disabled={busy || !password}
                className="rounded-xl bg-[#5a0a18] px-4 py-2.5 font-seance text-lg font-bold text-[#f5e9cb] transition hover:brightness-125 disabled:opacity-50"
              >
                Mở khóa
              </button>
            </div>
            {view.error && <p className="text-sm font-semibold text-[#b91c1c]">{view.error}</p>}
          </form>
        )}

        {view.kind === "list" && (
          <>
            <div className="border-b border-[#5a0a18]/15 px-4 py-2.5 sm:px-6">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="🔍 Tìm theo tên, câu hỏi hoặc lời phán…"
                aria-label="Tìm trong sổ quẻ"
                className="w-full rounded-xl border border-[#5a0a18]/25 bg-white/60 px-4 py-2 text-sm font-semibold text-[#2a070d] outline-none focus:border-[#5a0a18]"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
              {items.length === 0 && !busy && (
                <p className="py-12 text-center font-seance text-lg text-[#5a0a18]/60">{query.trim() ? "Không tìm thấy quẻ nào." : "Chưa có quẻ nào được lưu."}</p>
              )}
              <ul className="flex flex-col gap-3">
                {items.map((item) => {
                  const topic = item.topic !== "any" ? TOPICS.find((entry) => entry.id === item.topic) : undefined;
                  const long = item.text.length > 180;
                  const open = expanded.has(item.id);
                  return (
                    <li key={item.id} className="rounded-2xl border border-[#5a0a18]/15 bg-white/45 p-3.5 sm:p-4">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5a0a18]/70">
                        <span className="font-bold">{new Date(item.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>
                        <SourceBadge item={item} />
                        <span title="Mã người chơi (từ IP đã mã hoá)" className="font-mono">
                          #{item.visitor}
                        </span>
                        <button
                          type="button"
                          onClick={() => remove(item)}
                          aria-label="Xóa quẻ này"
                          className="ml-auto rounded-lg px-2 py-0.5 text-sm transition hover:bg-[#b91c1c]/10 hover:text-[#b91c1c]"
                        >
                          🗑
                        </button>
                      </div>
                      <p className="mt-1.5 font-bold text-[#2a070d]">
                        {item.name || <span className="font-semibold italic text-[#5a0a18]/60">Ẩn danh</span>}
                        {item.question ? (
                          <span className="font-semibold italic text-[#2a070d]/75"> — “{item.question}”</span>
                        ) : (
                          topic && (
                            <span className="font-semibold text-[#2a070d]/70">
                              {" "}
                              — {topic.emoji} {topic.label}
                            </span>
                          )
                        )}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.cards.map((id) => {
                          const info = cardInfo(id);
                          return (
                            <span
                              key={id}
                              title={info.name}
                              className={`rounded-md border border-[#5a0a18]/20 bg-white/80 px-1.5 py-0.5 text-xs font-extrabold ${info.suit.red ? "text-[#c8192c]" : "text-[#1e1b2e]"}`}
                            >
                              {info.rank}
                              {info.suit.symbol}
                            </span>
                          );
                        })}
                      </div>
                      <p className={`mt-2 whitespace-pre-line font-seance text-[17px] leading-snug text-[#2a070d] ${long && !open ? "line-clamp-3" : ""}`}>{item.text}</p>
                      {long && (
                        <button type="button" onClick={() => toggle(item.id)} className="mt-1 text-xs font-bold text-[#5a0a18]/70 underline-offset-2 hover:underline">
                          {open ? "Thu gọn" : "Xem thêm"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {cursor && (
                <div className="flex justify-center py-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => load(query.trim(), cursor)}
                    className="rounded-xl border border-[#5a0a18]/30 px-5 py-2 text-sm font-bold text-[#5a0a18] transition hover:bg-[#5a0a18]/10 disabled:opacity-50"
                  >
                    {busy ? "Đang tải…" : "Tải thêm"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
