"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { WerewolfTeam } from "@shared/werewolfTypes";
import { WerewolfHistoryDetail, type WerewolfHistoryDetailData } from "@/components/werewolf/WerewolfHistoryDetail";

// No login means no stable per-account identity to rank against — two
// different people typing "An" look identical to the old aggregate
// leaderboard, which quietly merged their scores into one row. A per-match
// history (what actually happened, when) doesn't have that problem: every
// entry is its own game, nothing to conflate.
type GameType = "draw" | "tank" | "soccer" | "werewolf";

const TABS: { id: GameType; label: string; emptyText: string }[] = [
  { id: "draw", label: "🎨 Vẽ Cùng Tôi", emptyText: "Chưa có ván vẽ nào được lưu lại." },
  { id: "tank", label: "🎯 Tank", emptyText: "Chưa có trận tank nào được lưu lại." },
  { id: "soccer", label: "⚽ Bóng đá", emptyText: "Chưa có trận bóng nào được lưu lại." },
  { id: "werewolf", label: "🐺 Ma Sói", emptyText: "Chưa có ván Ma Sói nào được lưu lại." },
];

interface DrawDetail {
  name: string;
  score: number;
}
interface TankDetail {
  name: string;
  color: string;
  team: string;
  score: number;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
}
interface SoccerDetail {
  name: string;
  team: "A" | "B";
  goals: number;
  shots: number;
  tacklesWon: number;
  fouls: number;
  cardStatus: "none" | "yellow" | "red";
}

interface HistoryEntry {
  _id: string;
  gameType: GameType;
  roomId: string;
  players: { name: string; score: number }[];
  rounds?: number;
  mode?: string;
  winnerName?: string | null;
  winningTeam?: "A" | "B" | WerewolfTeam | null;
  teamScores?: { A: number; B: number };
  detail?: TankDetail[] | SoccerDetail[] | DrawDetail[] | WerewolfHistoryDetailData;
  playedAt: string;
}

function summarize(e: HistoryEntry): string {
  if (e.gameType === "draw") {
    const top = [...e.players].sort((a, b) => b.score - a.score)[0];
    return top ? `${top.name} dẫn đầu — ${top.score}đ (${e.players.length} người, ${e.rounds ?? "?"} vòng)` : "Không có dữ liệu";
  }
  if (e.gameType === "tank") {
    if (e.mode === "team") {
      const a = e.teamScores?.A ?? 0;
      const b = e.teamScores?.B ?? 0;
      return e.winningTeam ? `Đội ${e.winningTeam === "A" ? "Xanh" : "Đỏ"} thắng — ${a} - ${b}` : `Hòa — ${a} - ${b}`;
    }
    return e.winnerName ? `${e.winnerName} thắng` : `Đấu tự do — hòa điểm (${e.players.length} người)`;
  }
  if (e.gameType === "werewolf") {
    const winner = e.winningTeam === "village" ? "Phe Dân" : "Phe Sói";
    const detail = e.detail as WerewolfHistoryDetailData | undefined;
    return `${winner} chiến thắng · ${detail?.daysPlayed ?? "?"} ngày · ${e.players.length} người`;
  }
  // soccer
  const a = e.teamScores?.A ?? 0;
  const b = e.teamScores?.B ?? 0;
  return e.winningTeam ? `Đội ${e.winningTeam === "A" ? "Xanh" : "Đỏ"} thắng ${a} - ${b}` : `Hòa ${a} - ${b}`;
}

function DetailTable({ entry }: { entry: HistoryEntry }) {
  if (entry.gameType === "werewolf") {
    const detail = entry.detail as WerewolfHistoryDetailData | undefined;
    if (!detail?.players.length) return <SimpleScoreList players={entry.players} />;
    return <WerewolfHistoryDetail detail={detail} winner={entry.winningTeam as WerewolfTeam | null | undefined} />;
  }
  if (entry.gameType === "tank") {
    const rows = (entry.detail as TankDetail[] | undefined) ?? [];
    if (rows.length === 0) return <SimpleScoreList players={entry.players} />;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="py-1 pr-3">Người chơi</th>
              {entry.mode === "team" && <th className="py-1 pr-3">Đội</th>}
              <th className="py-1 pr-3 text-right">Điểm</th>
              <th className="py-1 pr-3 text-right">Chết</th>
              <th className="py-1 pr-3 text-right">ST gây</th>
              <th className="py-1 pr-3 text-right">ST nhận</th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => b.score - a.score)
              .map((p) => (
                <tr key={p.name} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3 font-medium">{p.name}</td>
                  {entry.mode === "team" && (
                    <td className="py-1.5 pr-3">
                      <span className={p.team === "A" ? "text-blue-600" : "text-red-600"}>{p.team === "A" ? "Xanh" : "Đỏ"}</span>
                    </td>
                  )}
                  <td className="py-1.5 pr-3 text-right font-semibold text-brand-600">{p.score}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-500">{p.deaths}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-500">{p.damageDealt}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-500">{p.damageTaken}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (entry.gameType === "soccer") {
    const rows = (entry.detail as SoccerDetail[] | undefined) ?? [];
    if (rows.length === 0) return <SimpleScoreList players={entry.players} />;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="py-1 pr-3">Cầu thủ</th>
              <th className="py-1 pr-3">Đội</th>
              <th className="py-1 pr-3 text-right">Bàn</th>
              <th className="py-1 pr-3 text-right">Dứt điểm</th>
              <th className="py-1 pr-3 text-right">Tắc bóng</th>
              <th className="py-1 pr-3 text-right">Lỗi</th>
              <th className="py-1 pr-3 text-right">Thẻ</th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => b.goals - a.goals)
              .map((p) => (
                <tr key={p.name} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3 font-medium">{p.name}</td>
                  <td className="py-1.5 pr-3">
                    <span className={p.team === "A" ? "text-blue-600" : "text-red-600"}>{p.team === "A" ? "Xanh" : "Đỏ"}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right font-semibold text-brand-600">{p.goals}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-500">{p.shots}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-500">{p.tacklesWon}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-500">{p.fouls}</td>
                  <td className="py-1.5 pr-3 text-right">{p.cardStatus === "red" ? "🟥" : p.cardStatus === "yellow" ? "🟨" : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <SimpleScoreList players={entry.players} />;
}

function SimpleScoreList({ players }: { players: { name: string; score: number }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {[...players]
        .sort((a, b) => b.score - a.score)
        .map((p) => (
          <span key={p.name}>
            <span className="font-medium">{p.name}</span> <span className="text-brand-600">{p.score}đ</span>
          </span>
        ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<GameType>("draw");
  const [cache, setCache] = useState<Partial<Record<GameType, HistoryEntry[]>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("game") as GameType | null;
    if (requested && TABS.some((tab) => tab.id === requested)) setActiveTab(requested);
  }, []);

  useEffect(() => {
    if (cache[activeTab]) return;
    setLoading(true);
    setError(false);
    fetch(`/api/game-history?gameType=${activeTab}`)
      .then((res) => res.json())
      .then((data) => setCache((prev) => ({ ...prev, [activeTab]: data.history ?? [] })))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const history = cache[activeTab];
  const tab = TABS.find((t) => t.id === activeTab)!;

  return (
    <main className="min-h-app bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Match archive</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white">Lịch sử trận đấu</h1>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Về trang chủ
          </Link>
        </div>
        <p className="mb-7 max-w-3xl text-sm leading-6 text-slate-400">
          Không có tài khoản nên không thể xếp hạng chính xác theo người chơi (trùng tên sẽ lẫn lộn) — thay vào đó, đây là lịch sử các
          trận gần nhất của từng game.
        </p>

        <div className="no-scrollbar mb-7 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id);
                setExpandedId(null);
              }}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === t.id ? "bg-violet-500 text-white shadow-lg" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="rounded-xl bg-red-500/10 p-4 text-red-300">Không tải được dữ liệu. Kiểm tra kết nối MongoDB.</p>}
        {!error && loading && !history && <p className="text-slate-400">Đang tải...</p>}
        {!error && history && history.length === 0 && <p className="text-slate-400">{tab.emptyText}</p>}

        {history && history.length > 0 && (
          <div className="space-y-2">
            {history.map((entry) => {
              const expanded = expandedId === entry._id;
              return (
                <div key={entry._id} className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-black/20">
                  <button
                    onClick={() => setExpandedId(expanded ? null : entry._id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">{summarize(entry)}</div>
                      <div className="mt-0.5 flex gap-2 text-xs text-slate-400">
                        <span>Phòng {entry.roomId}</span>
                        <span>·</span>
                        <span>{new Date(entry.playedAt).toLocaleString("vi-VN")}</span>
                        {entry.mode && (
                          <>
                            <span>·</span>
                            <span>{entry.mode}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-slate-300">{expanded ? "▲" : "▼"}</span>
                  </button>
                  {expanded && (
                    <div className="border-t border-slate-100 px-4 py-3">
                      <DetailTable entry={entry} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
