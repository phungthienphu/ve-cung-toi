"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type { TankClientMessage, TankPublicState, TankServerMessage } from "@shared/tankTypes";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

export interface TankRoomHandle {
  state: TankPublicState | null;
  connected: boolean;
  kicked: boolean;
  send: (msg: TankClientMessage) => void;
}

export function useTankRoom(roomId: string, playerId: string, name: string, color: string): TankRoomHandle {
  const socketRef = useRef<PartySocket | null>(null);
  const [state, setState] = useState<TankPublicState | null>(null);
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
      if (msg.type === "state") setState(msg.state);
      else if (msg.type === "kicked") setKicked(true);
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
