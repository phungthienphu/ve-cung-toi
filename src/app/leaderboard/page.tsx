"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface GameHistoryEntry {
  _id: string;
  roomId: string;
  players: { name: string; score: number }[];
  rounds: number;
  playedAt: string;
  createdAt: string;
}

interface AggregateRow {
  name: string;
  totalScore: number;
  games: number;
  wins: number;
}

function aggregate(history: GameHistoryEntry[]): AggregateRow[] {
  const byName = new Map<string, AggregateRow>();
  for (const game of history) {
    if (game.players.length === 0) continue;
    const topScore = Math.max(...game.players.map((p) => p.score));
    for (const p of game.players) {
      const row = byName.get(p.name) ?? { name: p.name, totalScore: 0, games: 0, wins: 0 };
      row.totalScore += p.score;
      row.games += 1;
      if (p.score === topScore) row.wins += 1;
      byName.set(p.name, row);
    }
  }
  return [...byName.values()].sort((a, b) => b.totalScore - a.totalScore);
}

export default function LeaderboardPage() {
  const [history, setHistory] = useState<GameHistoryEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/game-history")
      .then((res) => res.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => setError(true));
  }, []);

  const rows = history ? aggregate(history) : [];

  return (
    <main className="bg-game-scene min-h-app">
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bảng xếp hạng</h1>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-brand-500 hover:text-brand-600"
        >
          Về trang chủ
        </Link>
      </div>
      <p className="mb-6 text-sm text-slate-400">
        Tổng hợp theo tên hiển thị từ {history?.length ?? 0} ván chơi gần nhất (chơi ẩn danh nên trùng tên sẽ được gộp chung).
      </p>

      {error && <p className="text-red-500">Không tải được dữ liệu. Kiểm tra kết nối MongoDB.</p>}
      {!error && !history && <p className="text-slate-400">Đang tải...</p>}
      {!error && history && history.length === 0 && (
        <p className="text-slate-400">Chưa có ván chơi nào được lưu lại. Chơi xong một ván để thấy dữ liệu ở đây!</p>
      )}

      {rows.length > 0 && (
        <div className="mb-10 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Tên</th>
                <th className="px-4 py-3 text-right">Tổng điểm</th>
                <th className="px-4 py-3 text-right">Số ván</th>
                <th className="px-4 py-3 text-right">Thắng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.name} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {i === 0 && "🥇 "}
                    {i === 1 && "🥈 "}
                    {i === 2 && "🥉 "}
                    {row.name}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-brand-600">{row.totalScore}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{row.games}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{row.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history && history.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-bold">Ván chơi gần đây</h2>
          <div className="space-y-3">
            {history.map((game) => (
              <div key={game._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                  <span>Phòng {game.roomId}</span>
                  <span>{new Date(game.playedAt).toLocaleString("vi-VN")}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {[...game.players]
                    .sort((a, b) => b.score - a.score)
                    .map((p) => (
                      <span key={p.name}>
                        <span className="font-medium">{p.name}</span>{" "}
                        <span className="text-brand-600">{p.score}đ</span>
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
    </main>
  );
}
