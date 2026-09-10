"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type { PlayerRosterEntry, TankClientMessage, TankPublicState, TankServerMessage } from "@shared/tankTypes";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

// The server no longer sends name/color/team on the per-tick "state" message
// (see PublicTankPlayer) — they arrive separately, only when they actually
// change, on a "roster" message instead. This merges the two back together
// so every other client file can keep reading player.name/.color/.team
// exactly as before, without knowing this split exists.
export type ClientTankPlayer = TankPublicState["players"][number] & PlayerRosterEntry;
export interface ClientTankPublicState extends Omit<TankPublicState, "players"> {
  players: ClientTankPlayer[];
}

export interface TankRoomHandle {
  state: ClientTankPublicState | null;
  connected: boolean;
  kicked: boolean;
  send: (msg: TankClientMessage) => void;
}

export function useTankRoom(roomId: string, playerId: string, name: string, color: string): TankRoomHandle {
  const socketRef = useRef<PartySocket | null>(null);
  const rosterRef = useRef<Map<string, PlayerRosterEntry>>(new Map());
  const [state, setState] = useState<ClientTankPublicState | null>(null);
  const [connected, setConnected] = useState(false);
  const [kicked, setKicked] = useState(false);

  useEffect(() => {
    if (!roomId || !playerId) return;

    const socket = new PartySocket({ host: PARTYKIT_HOST, room: roomId, party: "tanks", id: playerId });
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: "join", playerId, name, color } satisfies TankClientMessage));
    });
    socket.addEventListener("close", () => setConnected(false));

    socket.addEventListener("message", (event) => {
      const msg: TankServerMessage = JSON.parse(event.data);
      if (msg.type === "state") {
        const roster = rosterRef.current;
        setState({
          ...msg.state,
          players: msg.state.players.map((p) => ({
            ...p,
            ...(roster.get(p.id) ?? { id: p.id, name: "?", color: "#94a3b8", team: "A" as const }),
          })),
        });
      } else if (msg.type === "roster") {
        rosterRef.current = new Map(msg.players.map((p) => [p.id, p]));
      } else if (msg.type === "kicked") setKicked(true);
      else if (msg.type === "error") console.error("Tank room error:", msg.message);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerId]);

  const send = useCallback((msg: TankClientMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  return { state, connected, kicked, send };
}
