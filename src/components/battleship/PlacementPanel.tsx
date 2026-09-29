"use client";

import { useEffect, useRef, useState } from "react";
import {
  SHIP_LABEL,
  SHIP_SIZE,
  boardSizeFor,
  canPlace,
  cellXY,
  shipCells,
  type BattleshipClientMessage,
  type BattleshipPlayer,
  type PrivateBattleshipState,
  type PublicBattleshipState,
  type ShipPlacement,
} from "@shared/battleshipTypes";
import { BoardCanvas } from "./BoardCanvas";
import { MAIN_BOARD_STYLE, btnGhost, btnPrimary, card } from "./ui";

interface PlacementPanelProps {
  state: PublicBattleshipState;
  priv: PrivateBattleshipState | null;
  self: BattleshipPlayer;
  send: (message: BattleshipClientMessage) => void;
  side: React.ReactNode;
}

function clampShip(ship: ShipPlacement, size: number): ShipPlacement {
  const length = SHIP_SIZE[ship.kind];
  return {
    ...ship,
    x: Math.max(0, Math.min(ship.x, ship.vertical ? size - 1 : size - length)),
    y: Math.max(0, Math.min(ship.y, ship.vertical ? size - length : size - 1)),
  };
}

// Drag a ship to move it (a green/red ghost shows whether it fits), tap a ship
// to select it and tap it again — or press "Xoay" — to turn it. Tapping an
// empty cell while a ship is selected also moves it there. Every valid change
// is sent straight to the server, which is what teammates see in đồng đội mode.
export function PlacementPanel({ state, priv, self, send, side }: PlacementPanelProps) {
  const size = boardSizeFor(state.config.mode);
  const [ships, setShips] = useState<ShipPlacement[]>(priv?.ships ?? []);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const serverShips = priv?.ships;
  useEffect(() => {
    if (serverShips) setShips(serverShips);
  }, [serverShips]);

  const commit = (next: ShipPlacement[]) => {
    setShips(next);
    send({ type: "place_ships", ships: next });
  };

  const tryPlace = (index: number, candidate: ShipPlacement, failText: string) => {
    const others = ships.filter((_, i) => i !== index);
    if (!canPlace(candidate, others, size, state.config.noTouching)) {
      setMessage(failText);
      return false;
    }
    setMessage("");
    commit(ships.map((ship, i) => (i === index ? candidate : ship)));
    return true;
  };

  // Drag state: which ship, which of its cells was grabbed, where it'd land.
  const drag = useRef<{ index: number; grab: number; startCell: number; moved: boolean } | null>(null);
  const [ghost, setGhostState] = useState<{ index: number; ship: ShipPlacement; valid: boolean } | null>(null);
  // Mirrored in a ref: a fast drop can arrive before the re-render that would
  // hand onUp the latest ghost.
  const ghostRef = useRef(ghost);
  const setGhost = (next: typeof ghost) => {
    ghostRef.current = next;
    setGhostState(next);
  };

  const candidateAt = (index: number, grab: number, cell: number): ShipPlacement => {
    const ship = ships[index];
    const { x, y } = cellXY(cell, size);
    return clampShip({ ...ship, x: ship.vertical ? x : x - grab, y: ship.vertical ? y - grab : y }, size);
  };

  const onDown = (cell: number) => {
    if (self.ready) return;
    const index = ships.findIndex((ship) => shipCells(ship, size).includes(cell));
    if (index < 0) return;
    const grab = shipCells(ships[index], size).indexOf(cell);
    drag.current = { index, grab, startCell: cell, moved: false };
  };

  const onMove = (cell: number | null) => {
    const current = drag.current;
    if (!current || cell === null) return;
    if (cell !== current.startCell) current.moved = true;
    if (!current.moved) return;
    const candidate = candidateAt(current.index, current.grab, cell);
    const others = ships.filter((_, i) => i !== current.index);
    setGhost({ index: current.index, ship: candidate, valid: canPlace(candidate, others, size, state.config.noTouching) });
  };

  const onUp = (cell: number | null) => {
    const current = drag.current;
    drag.current = null;
    const dropped = ghostRef.current;
    setGhost(null);
    if (self.ready) return;

    if (current?.moved) {
      if (dropped?.valid) {
        setMessage("");
        commit(ships.map((ship, i) => (i === current.index ? dropped.ship : ship)));
        setSelected(current.index);
      } else {
        setMessage(state.config.noTouching ? "Không đặt được ở đó (chồng hoặc sát tàu khác)." : "Không đặt được ở đó (chồng tàu khác).");
      }
      return;
    }
    if (cell === null) return;

    // A tap (no drag).
    const index = ships.findIndex((ship) => shipCells(ship, size).includes(cell));
    if (index >= 0) {
      if (index === selected) rotate();
      else {
        setSelected(index);
        setMessage("Kéo để di chuyển · chạm lần nữa để xoay.");
      }
      return;
    }
    if (selected !== null) {
      const { x, y } = cellXY(cell, size);
      if (tryPlace(selected, clampShip({ ...ships[selected], x, y }, size), "Không đặt được ở đó.")) setSelected(null);
    }
  };

  const rotate = () => {
    if (selected === null) return;
    const ship = ships[selected];
    tryPlace(selected, clampShip({ ...ship, vertical: !ship.vertical }, size), "Không đủ chỗ để xoay tàu này ở đây.");
  };

  const waiting = state.players.filter((player) => !player.isBot && player.connected);
  const readyCount = waiting.filter((player) => player.ready).length;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className={`${card} p-3 sm:p-4`}>
        <div className="mb-2 flex items-center justify-between gap-2 text-sky-50">
          <h2 className="font-bold">Xếp hạm đội {state.config.mode === "team" ? "của đội" : "của bạn"}</h2>
          <span className="text-xs text-sky-100/60">Sẵn sàng {readyCount}/{waiting.length}</span>
        </div>
        <div className="mx-auto" style={MAIN_BOARD_STYLE}>
          <BoardCanvas
            size={size}
            hits={[]}
            misses={[]}
            ships={ships}
            selectedShip={selected}
            interactive={!self.ready}
            onCellDown={onDown}
            onCellMove={onMove}
            onCellUp={onUp}
            ghost={ghost}
            hiddenShip={ghost?.index ?? null}
          />
        </div>
        <p className="mt-2 min-h-5 text-center text-xs text-amber-200">{message || (selected === null && !self.ready ? "Kéo tàu để di chuyển · chạm tàu để chọn, chạm lần nữa để xoay." : "")}</p>
      </section>

      <aside className="space-y-3">
        <div className={`${card} p-3`}>
          <p className="mb-2 text-xs text-sky-100/60">Chọn tàu:</p>
          <ul className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
            {ships.map((ship, index) => (
              <li key={`${ship.kind}-${index}`}>
                <button
                  disabled={self.ready}
                  onClick={() => setSelected(selected === index ? null : index)}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                    selected === index ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/10 text-sky-50 enabled:hover:bg-white/5"
                  }`}
                >
                  <span>{SHIP_LABEL[ship.kind]}</span>
                  <span className="text-xs text-sky-100/60">{SHIP_SIZE[ship.kind]} ô</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={rotate} disabled={selected === null || self.ready} className={btnGhost}>↻ Xoay</button>
            <button onClick={() => { setSelected(null); send({ type: "random_ships" }); }} disabled={self.ready} className={btnGhost}>🎲 Ngẫu nhiên</button>
          </div>
        </div>

        <button onClick={() => { setSelected(null); send({ type: "set_ready", ready: !self.ready }); }} className={`${self.ready ? btnGhost : btnPrimary} w-full py-3`}>
          {self.ready ? "✓ Đã xếp xong (bấm để sửa)" : "Xếp xong, sẵn sàng!"}
        </button>
        <p className="text-xs leading-5 text-sky-100/50">
          {state.config.mode === "team" ? "Cả đội dùng chung hạm đội, ai cũng chỉnh được. " : ""}
          {state.config.noTouching ? "Tàu không được đặt sát nhau (kể cả chéo). " : ""}
          Hết giờ thì giữ nguyên cách xếp hiện tại.
        </p>
        {side}
      </aside>
    </div>
  );
}
