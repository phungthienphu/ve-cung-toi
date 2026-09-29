"use client";

import Link from "next/link";
import type { BattleshipClientMessage, BattleshipPlayer, PublicBattleshipState } from "@shared/battleshipTypes";
import { BoardCanvas } from "./BoardCanvas";
import { boardOwnerLabel, btnGhost, btnPrimary, card, playerName } from "./ui";

export function EndPanel({ state, self, send }: { state: PublicBattleshipState; self: BattleshipPlayer; send: (message: BattleshipClientMessage) => void }) {
  const won = state.winnerIds.includes(self.id);
  const title = state.winnerTeam
    ? `🏆 Đội ${state.winnerTeam === "A" ? "Xanh" : "Đỏ"} chiến thắng!`
    : state.winnerIds.length
      ? `🏆 ${state.winnerIds.map((id) => playerName(state, id)).join(", ")} chiến thắng!`
      : "🤝 Hòa — cả hai hạm đội cùng chìm!";
  const rows = [...state.players].sort((a, b) => {
    const pa = state.standings.find((row) => row.playerId === a.id)?.place ?? 99;
    const pb = state.standings.find((row) => row.playerId === b.id)?.place ?? 99;
    return pa - pb || b.sinks - a.sinks;
  });

  return (
    <div className="space-y-4">
      <section className={`${card} p-5 text-center ${won ? "border-amber-300/50" : ""}`}>
        <h2 className="text-2xl font-extrabold text-sky-50">{title}</h2>
        <p className="mt-1 text-sm text-sky-100/60">{won ? "Hạm đội của bạn làm chủ vùng biển này ⚓" : "Hẹn phục thù ở ván sau!"}</p>
      </section>

      <section className={`${card} overflow-x-auto p-4`}>
        <table className="w-full text-left text-sm text-sky-50">
          <thead className="text-xs text-sky-100/50">
            <tr>
              <th className="py-1 pr-3">Hạng</th>
              <th className="py-1 pr-3">Thuyền trưởng</th>
              <th className="py-1 pr-3 text-right">Phát bắn</th>
              <th className="py-1 pr-3 text-right">Trúng</th>
              <th className="py-1 text-right">Đánh chìm</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((player) => (
              <tr key={player.id} className="border-t border-white/5">
                <td className="py-1.5 pr-3">{state.standings.find((row) => row.playerId === player.id)?.place ?? "—"}</td>
                <td className="py-1.5 pr-3 font-medium">
                  {player.name}
                  {player.team && state.config.mode === "team" ? <span className="text-sky-100/50"> · {player.team === "A" ? "Xanh" : "Đỏ"}</span> : null}
                </td>
                <td className="py-1.5 pr-3 text-right">{player.shots}</td>
                <td className="py-1.5 pr-3 text-right">{player.shots ? `${Math.round((player.hits / player.shots) * 100)}%` : "—"}</td>
                <td className="py-1.5 text-right font-semibold text-amber-200">{player.sinks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.boards.map((board) => (
          <div key={board.id} className={`${card} p-2`}>
            <p className="mb-1 truncate text-xs font-semibold text-sky-50">{boardOwnerLabel(state, board)}</p>
            <BoardCanvas size={board.size} hits={board.hits} misses={board.misses} ships={state.revealedFleets?.[board.id] ?? []} sunk={board.sunk} />
          </div>
        ))}
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        {self.isHost ? (
          <button onClick={() => send({ type: "play_again" })} className={`${btnPrimary} py-3`}>Chơi ván mới</button>
        ) : (
          <p className="self-center text-center text-sm text-sky-100/60">Chờ chủ phòng mở ván mới…</p>
        )}
        <Link href="/battleship" className={`${btnGhost} py-3 text-center`}>Về sảnh Hải Chiến</Link>
      </div>
    </div>
  );
}
