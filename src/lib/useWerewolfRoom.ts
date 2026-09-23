"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type { PrivateWerewolfState, PublicWerewolfState, WerewolfClientMessage, WerewolfServerMessage } from "@shared/werewolfTypes";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

export function useWerewolfRoom(roomId: string, playerId: string, name: string) {
  const socketRef = useRef<PartySocket | null>(null);
  const [state, setState] = useState<PublicWerewolfState | null>(null);
  const [privateState, setPrivateState] = useState<PrivateWerewolfState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roomId || !playerId) return;
    const socket = new PartySocket({ host: PARTYKIT_HOST, room: roomId, party: "werewolf", id: playerId });
    socketRef.current = socket;
    socket.addEventListener("open", () => { setConnected(true); socket.send(JSON.stringify({ type: "join", playerId, name } satisfies WerewolfClientMessage)); });
    socket.addEventListener("close", () => setConnected(false));
    socket.addEventListener("message", event => {
      const msg = JSON.parse(event.data) as WerewolfServerMessage;
      if (msg.type === "state") setState(msg.state);
      else if (msg.type === "private_state") setPrivateState(msg.state);
      else if (msg.type === "error") setError(msg.message);
    });
    return () => { socket.close(); socketRef.current = null; };
  }, [roomId, playerId, name]);

  const send = useCallback((msg: WerewolfClientMessage) => socketRef.current?.send(JSON.stringify(msg)), []);
  return { state, privateState, connected, error, clearError: () => setError(""), send };
}

