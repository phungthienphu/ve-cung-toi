"use client";

import { useEffect, useState } from "react";
import type { BattleshipClientMessage, BattleshipPlayer, PrivateBattleshipState, PublicBattleshipState, PublicBoard } from "@shared/battleshipTypes";
import { BoardCanvas, type AimMarker } from "./BoardCanvas";
import { boardOwnerLabel, btnPrimary, card, playerName, shipsLeft } from "./ui";

interface BattlePanelProps {
  state: PublicBattleshipState;
  priv: PrivateBattleshipState | null;
  self: BattleshipPlayer;
  send: (message: BattleshipClientMessage) => void;
}

const MY_AIM = "#fde047";
const TEAM_AIM = "#67e8f9";

export function BattlePanel(props: BattlePanelProps) {
  if (props.state.config.mode === "solo") return <SoloBattle {...props} />;
  return <RoundBattle {...props} />;
}

function OwnBoard({ state, priv, title }: { state: PublicBattleshipState; priv: PrivateBattleshipState | null; title: string }) {
  const board = state.boards.find((candidate) => candidate.id === priv?.myBoardId);
  if (!board) return null;
  return (
    <section className={`${card} p-3`}>
      <div className="mb-2 flex items-center justify-between text-sm text-sky-50">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-sky-100/60">còn {shipsLeft(board)}/{board.shipsTotal} tàu</span>
      </div>
      <BoardCanvas
        size={board.size}
        boardId={board.id}
        hits={board.hits}
        misses={board.misses}
        ships={priv?.ships ?? []}
        sunk={board.sunk}
        flashes={state.lastShots}
        dimmed={!board.alive}
      />
    </section>
  );
}

// ---------- Solo: alternating turns ----------

function SoloBattle({ state, priv, self, send }: BattlePanelProps) {
  const enemy = state.boards.find((board) => board.id !== priv?.myBoardId);
  const myTurn = state.turnPlayerId === self.id;
  if (!enemy) return null;

  return (
    <div className="space-y-3">
      <TurnBanner active={myTurn}>
        {myTurn ? "🎯 Lượt của bạn — chọn một ô trên biển địch để khai hỏa" : `⏳ Lượt của ${playerName(state, state.turnPlayerId ?? "")}…`}
      </TurnBanner>
      <div className="grid gap-3 md:grid-cols-2">
        <section className={`${card} p-3 ${myTurn ? "ring-2 ring-amber-300/70" : ""}`}>
          <div className="mb-2 flex items-center justify-between text-sm text-sky-50">
            <h3 className="font-semibold">Biển địch — {boardOwnerLabel(state, enemy)}</h3>
            <span className="text-xs text-sky-100/60">còn {shipsLeft(enemy)}/{enemy.shipsTotal} tàu</span>
          </div>
          <BoardCanvas
            size={enemy.size}
            boardId={enemy.id}
            hits={enemy.hits}
            misses={enemy.misses}
            sunk={enemy.sunk}
            flashes={state.lastShots}
            interactive={myTurn}
            onCellClick={(cell) => send({ type: "shoot", cell })}
          />
        </section>
        <OwnBoard state={state} priv={priv} title="Hạm đội của bạn" />
      </div>
    </div>
  );
}

// ---------- Hỗn chiến / Đồng đội: simultaneous rounds ----------

function RoundBattle({ state, priv, self, send }: BattlePanelProps) {
  const mode = state.config.mode;
  const myBoard = state.boards.find((board) => board.id === priv?.myBoardId);
  const alive = !!myBoard?.alive;
  const targets: PublicBoard[] = mode === "team"
    ? state.boards.filter((board) => board.team && board.team !== self.team)
    : state.boards.filter((board) => board.id !== priv?.myBoardId && board.alive);
  const [targetId, setTargetId] = useState<string | null>(null);

  // Follow your own aim; otherwise stay on the chosen tab while it's alive.
  useEffect(() => {
    if (priv?.aimBoardId) setTargetId(priv.aimBoardId);
  }, [priv?.aimBoardId]);
  const target = targets.find((board) => board.id === targetId) ?? targets[0];

  const revealing = !!state.revealUntil;
  const locked = !!priv?.locked;
  const canAim = alive && !locked && !revealing && !!priv?.shotsAllowed;
  const aimed = priv?.aimCells.length ?? 0;
  const shooters = state.players.filter((player) => {
    const board = state.boards.find((candidate) => (mode === "team" ? candidate.team === player.team : candidate.id === player.id));
    return board?.alive && player.connected;
  });

  const aims: AimMarker[] = [];
  if (target && priv?.aimBoardId === target.id) aims.push({ cells: priv.aimCells, color: MY_AIM, kind: "mine" });
  if (mode === "team") for (const teammate of priv?.teamAims ?? []) aims.push({ cells: teammate.cells, color: TEAM_AIM, kind: "team" });

  // Knocked out of hỗn chiến: watch every fleet.
  if (mode === "ffa" && !alive) return <SpectatorView state={state} priv={priv} />;

  return (
    <div className="space-y-3">
      <TurnBanner active={canAim}>
        {revealing
          ? `💥 Kết quả vòng ${state.round}`
          : locked
            ? `✓ Đã khai hỏa — chờ mọi người (${state.lockedPlayerIds.length}/${shooters.length})`
            : `🎯 Vòng ${state.round} — ${mode === "team" ? `bạn có ${priv?.shotsAllowed ?? 0} phát, chọn ô trên lưới đội địch` : "chọn một đối thủ và một ô"}`}
      </TurnBanner>

      {mode === "ffa" && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {targets.map((board) => {
            const count = state.aimCounts[board.id] ?? 0;
            const full = count >= state.aimCap && priv?.aimBoardId !== board.id;
            return (
              <button
                key={board.id}
                onClick={() => setTargetId(board.id)}
                className={`shrink-0 rounded-md border px-3 py-2 text-left text-xs transition ${
                  target?.id === board.id ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/10 text-sky-50 hover:bg-white/5"
                }`}
              >
                <div className="max-w-[120px] truncate font-semibold">{boardOwnerLabel(state, board)}</div>
                <div className="text-sky-100/60">
                  {shipsLeft(board)} tàu · {full ? "đủ phát" : `${count}/${state.aimCap} ngắm`}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {target && (
          <section className={`${card} p-3 ${canAim ? "ring-2 ring-amber-300/70" : ""}`}>
            <div className="mb-2 flex items-center justify-between text-sm text-sky-50">
              <h3 className="font-semibold">Biển địch — {boardOwnerLabel(state, target)}</h3>
              <span className="text-xs text-sky-100/60">còn {shipsLeft(target)}/{target.shipsTotal} tàu</span>
            </div>
            <BoardCanvas
              size={target.size}
              boardId={target.id}
              hits={target.hits}
              misses={target.misses}
              sunk={target.sunk}
              aims={aims}
              flashes={state.lastShots}
              interactive={canAim}
              onCellClick={(cell) => send({ type: "aim", boardId: target.id, cell })}
            />
            <button onClick={() => send({ type: "lock_aim" })} disabled={!canAim || aimed === 0} className={`${btnPrimary} mt-3 w-full py-3`}>
              {locked ? "✓ Đã khai hỏa" : `🔥 Khai hỏa${priv && priv.shotsAllowed > 1 ? ` (${aimed}/${priv.shotsAllowed})` : ""}`}
            </button>
            {mode === "team" && <p className="mt-2 text-xs text-sky-100/50">Chấm xanh ngọc là ô đồng đội đang ngắm. Chạm lại ô đã chọn để bỏ.</p>}
          </section>
        )}
        <OwnBoard state={state} priv={priv} title={mode === "team" ? "Hạm đội của đội" : "Hạm đội của bạn"} />
      </div>
    </div>
  );
}

function SpectatorView({ state, priv }: { state: PublicBattleshipState; priv: PrivateBattleshipState | null }) {
  return (
    <div className="space-y-3">
      <TurnBanner active={false}>💀 Hạm đội của bạn đã chìm — bạn đang xem trận (thấy vị trí mọi tàu).</TurnBanner>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.boards.map((board) => (
          <section key={board.id} className={`${card} p-2`}>
            <div className="mb-1 flex justify-between text-xs text-sky-50">
              <span className="truncate font-semibold">{boardOwnerLabel(state, board)}</span>
              <span className="text-sky-100/60">{board.alive ? `${shipsLeft(board)} tàu` : "đã chìm"}</span>
            </div>
            <BoardCanvas
              size={board.size}
              boardId={board.id}
              hits={board.hits}
              misses={board.misses}
              ships={priv?.spectatorFleets?.[board.id] ?? []}
              sunk={board.sunk}
              flashes={state.lastShots}
              dimmed={!board.alive}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

function TurnBanner({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-md border px-4 py-2.5 text-sm font-semibold ${active ? "border-amber-300/60 bg-amber-300/15 text-amber-100" : "border-white/10 bg-slate-900/60 text-sky-100"}`}>
      {children}
    </div>
  );
}
