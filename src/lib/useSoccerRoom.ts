"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type { SoccerClientMessage, SoccerPublicState, SoccerServerMessage } from "@shared/soccerTypes";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

export interface SoccerRoomHandle {
  state: SoccerPublicState | null;
  connected: boolean;
  kicked: boolean;
  send: (msg: SoccerClientMessage) => void;
}

// Simpler than useTankRoom.ts on purpose: no roster split and no delta
// messages (see SoccerPublicState's doc — small enough state that every
// tick just sends the whole thing), so there's nothing to merge here.
export function useSoccerRoom(roomId: string, playerId: string, name: string): SoccerRoomHandle {
  const socketRef = useRef<PartySocket | null>(null);
  const [state, setState] = useState<SoccerPublicState | null>(null);
  const [connected, setConnected] = useState(false);
  const [kicked, setKicked] = useState(false);

  useEffect(() => {
    if (!roomId || !playerId) return;

    const socket = new PartySocket({ host: PARTYKIT_HOST, room: roomId, party: "soccer", id: playerId });
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: "join", playerId, name } satisfies SoccerClientMessage));
    });
    socket.addEventListener("close", () => setConnected(false));

    socket.addEventListener("message", (event) => {
      const msg: SoccerServerMessage = JSON.parse(event.data);
      if (msg.type === "state") setState(msg.state);
      else if (msg.type === "kicked") setKicked(true);
      else if (msg.type === "error") console.error("Soccer room error:", msg.message);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerId]);

  const send = useCallback((msg: SoccerClientMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  return { state, connected, kicked, send };
}
