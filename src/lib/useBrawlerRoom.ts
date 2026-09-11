"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type { BrawlerClientMessage, BrawlerPublicState, BrawlerServerMessage } from "@shared/brawlerTypes";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

export interface BrawlerRoomHandle {
  state: BrawlerPublicState | null;
  connected: boolean;
  kicked: boolean;
  send: (msg: BrawlerClientMessage) => void;
}

export function useBrawlerRoom(roomId: string, playerId: string, name: string): BrawlerRoomHandle {
  const socketRef = useRef<PartySocket | null>(null);
  const [state, setState] = useState<BrawlerPublicState | null>(null);
  const [connected, setConnected] = useState(false);
  const [kicked, setKicked] = useState(false);

  useEffect(() => {
    if (!roomId || !playerId) return;

    const socket = new PartySocket({ host: PARTYKIT_HOST, room: roomId, party: "brawler", id: playerId });
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: "join", playerId, name } satisfies BrawlerClientMessage));
    });
    socket.addEventListener("close", () => setConnected(false));

    socket.addEventListener("message", (event) => {
      const msg: BrawlerServerMessage = JSON.parse(event.data);
      if (msg.type === "state") setState(msg.state);
      else if (msg.type === "kicked") setKicked(true);
      else if (msg.type === "error") console.error("Brawler room error:", msg.message);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerId]);

  const send = useCallback((msg: BrawlerClientMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  return { state, connected, kicked, send };
}
