"use client";

import { useEffect, useState } from "react";
import type { BattleshipClientMessage, BattleshipPlayer, PrivateBattleshipState, PublicBattleshipState, PublicBoard } from "@shared/battleshipTypes";
import { BoardCanvas, type AimMarker } from "./BoardCanvas";
import { MAIN_BOARD_STYLE, boardOwnerLabel, btnPrimary, card, playerName, shipsLeft } from "./ui";

interface BattlePanelProps {
  state: PublicBattleshipState;
  priv: PrivateBattleshipState | null;
  self: BattleshipPlayer;
  send: (message: BattleshipClientMessage) => void;
  side: React.ReactNode;
}

const MY_AIM = "#fde047";

/** Your board id straight from the public state (your player id, or your
 * team's board). Never fall back to "some other board": if this were unknown
 * the enemy view could end up showing your own fleet. */
export function myBoardIdOf(state: PublicBattleshipState, self: BattleshipPlayer): string | null {
  if (state.config.mode === "team") return self.team ? `team-${self.team}` : null;
  return self.id;
}
const TEAM_AIM = "#67e8f9";

// Layout for every battle view: one big board you act on (left, sized to fit
// the screen height) and a right column with your own fleet, then the shared
// side panel (captains, log, chat).
export function BattlePanel(props: BattlePanelProps) {
  if (props.state.config.mode === "solo") return <SoloBattle {...props} />;
  return <RoundBattle {...props} />;
}

function Layout({ main, right, side }: { main: React.ReactNode; right: React.ReactNode; side: React.ReactNode }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">{main}</div>
      <aside className="space-y-3">
        {right}
        {side}
      </aside>
    </div>
  );
}

function FleetStatus({ board }: { board: PublicBoard }) {
  return (
    <span className="flex items-center gap-1" title={`còn ${shipsLeft(board)}/${board.shipsTotal} tàu`}>
      {Array.from({ length: board.shipsTotal }, (_, index) => (
        <span key={index} className={`h-2 w-4 rounded-sm ${index < shipsLeft(board) ? "bg-sky-300" : "bg-rose-400/40"}`} />
      ))}
    </span>
  );
}

function OwnBoard({ state, priv, self, title }: { state: PublicBattleshipState; priv: PrivateBattleshipState | null; self: BattleshipPlayer; title: string }) {
  const board = state.boards.find((candidate) => candidate.id === myBoardIdOf(state, self));
  if (!board) return null;
  return (
    <section className={`${card} p-3`}>
      <div className="mb-2 flex items-center justify-between gap-2 text-sm text-sky-50">
        <h3 className="font-semibold">{title}</h3>
        <FleetStatus board={board} />
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

function MainBoard({
  state,
  board,
  active,
  aims,
  footer,
  onCell,
}: {
  state: PublicBattleshipState;
  board: PublicBoard;
  active: boolean;
  aims?: AimMarker[];
  footer?: React.ReactNode;
  onCell: (cell: number) => void;
}) {
  return (
    <section className={`${card} p-3 sm:p-4 ${active ? "ring-2 ring-amber-300/70" : ""}`}>
      <div className="mx-auto" style={MAIN_BOARD_STYLE}>
        <div className="mb-2 flex items-center justify-between gap-2 text-sky-50">
          <h3 className="truncate font-bold">🎯 Biển địch — {boardOwnerLabel(state, board)}</h3>
          <FleetStatus board={board} />
        </div>
        <BoardCanvas
          size={board.size}
          boardId={board.id}
          hits={board.hits}
          misses={board.misses}
          sunk={board.sunk}
          aims={aims}
          flashes={state.lastShots}
          interactive={active}
          onCellClick={onCell}
        />
        {footer}
      </div>
    </section>
  );
}

// ---------- Solo: alternating turns ----------

function SoloBattle({ state, priv, self, send, side }: BattlePanelProps) {
  const myId = myBoardIdOf(state, self);
  const enemy = state.boards.find((board) => board.id !== myId);
  const mine = state.boards.find((board) => board.id === myId);
  const myTurn = state.turnPlayerId === self.id;
  if (!enemy) return null;

  return (
    <Layout
      main={
        <>
          <TurnBanner active={myTurn}>
            <span>{myTurn ? "🎯 Lượt của bạn — chạm một ô trên biển địch để khai hỏa" : `⏳ Lượt của ${playerName(state, state.turnPlayerId ?? "")}…`}</span>
            {mine && (
              <span className="hidden shrink-0 text-xs font-normal text-sky-100/70 sm:inline">
                Bạn {shipsLeft(mine)} tàu · Đối thủ {shipsLeft(enemy)} tàu
              </span>
            )}
          </TurnBanner>
          <MainBoard state={state} board={enemy} active={myTurn} onCell={(cell) => send({ type: "shoot", cell })} />
        </>
      }
      right={<OwnBoard state={state} priv={priv} self={self} title="Hạm đội của bạn" />}
      side={side}
    />
  );
}

// ---------- Hỗn chiến / Đồng đội: simultaneous rounds ----------

function RoundBattle({ state, priv, self, send, side }: BattlePanelProps) {
  const mode = state.config.mode;
  const myId = myBoardIdOf(state, self);
  const myBoard = state.boards.find((board) => board.id === myId);
  const alive = !!myBoard?.alive;
  const targets: PublicBoard[] = mode === "team"
    ? state.boards.filter((board) => board.team && board.team !== self.team)
    : state.boards.filter((board) => board.id !== myId && board.alive);
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

  if (mode === "ffa" && !alive) return <SpectatorView state={state} priv={priv} side={side} />;

  return (
    <Layout
      main={
        <>
          <TurnBanner active={canAim}>
            <span>
              {revealing
                ? `💥 Kết quả vòng ${state.round}`
                : locked
                  ? `✓ Đã khai hỏa — chờ mọi người (${state.lockedPlayerIds.length}/${shooters.length})`
                  : `🎯 Vòng ${state.round} — ${mode === "team" ? `bạn có ${priv?.shotsAllowed ?? 0} phát, chọn ô trên lưới đội địch` : "chọn một đối thủ và một ô"}`}
            </span>
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
                      target?.id === board.id ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/10 bg-slate-900/60 text-sky-50 hover:bg-white/5"
                    }`}
                  >
                    <div className="max-w-[130px] truncate font-semibold">{boardOwnerLabel(state, board)}</div>
                    <div className="mt-1 flex items-center gap-2 text-sky-100/60">
                      <FleetStatus board={board} />
                      <span>{full ? "đủ phát" : `${count}/${state.aimCap}`}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {target && (
            <MainBoard
              state={state}
              board={target}
              active={canAim}
              aims={aims}
              onCell={(cell) => send({ type: "aim", boardId: target.id, cell })}
              footer={
                <>
                  <button onClick={() => send({ type: "lock_aim" })} disabled={!canAim || aimed === 0} className={`${btnPrimary} mt-3 w-full py-3`}>
                    {locked ? "✓ Đã khai hỏa" : `🔥 Khai hỏa${priv && priv.shotsAllowed > 1 ? ` (${aimed}/${priv.shotsAllowed})` : ""}`}
                  </button>
                  {mode === "team" && <p className="mt-2 text-center text-xs text-sky-100/50">Chấm xanh ngọc là ô đồng đội đang ngắm. Chạm lại ô đã chọn để bỏ.</p>}
                </>
              }
            />
          )}
        </>
      }
      right={<OwnBoard state={state} priv={priv} self={self} title={mode === "team" ? "Hạm đội của đội" : "Hạm đội của bạn"} />}
      side={side}
    />
  );
}

function SpectatorView({ state, priv, side }: { state: PublicBattleshipState; priv: PrivateBattleshipState | null; side: React.ReactNode }) {
  return (
    <Layout
      main={
        <>
          <TurnBanner active={false}>💀 Hạm đội của bạn đã chìm — bạn đang xem trận (thấy vị trí mọi tàu).</TurnBanner>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {state.boards.map((board) => (
              <section key={board.id} className={`${card} p-2`}>
                <div className="mb-1 flex justify-between gap-2 text-xs text-sky-50">
                  <span className="truncate font-semibold">{boardOwnerLabel(state, board)}</span>
                  {board.alive ? <FleetStatus board={board} /> : <span className="text-rose-300">đã chìm</span>}
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
        </>
      }
      right={null}
      side={side}
    />
  );
}

function TurnBanner({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-md border px-4 py-2.5 text-sm font-semibold ${active ? "border-amber-300/60 bg-amber-300/15 text-amber-100" : "border-white/10 bg-slate-900/60 text-sky-100"}`}>
      {children}
    </div>
  );
}
