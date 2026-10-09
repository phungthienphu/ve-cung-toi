"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type { Grade, MathBossClientMessage, MathBossServerMessage, PublicMathBossState } from "@shared/mathBossTypes";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

export function useMathBossRoom(roomId: string, playerId: string, name: string, grade: Grade, role: "host" | "player") {
  const socketRef = useRef<PartySocket | null>(null);
  // Only read when (re)joining; changing grade later goes through set_grade
  // rather than tearing down the socket.
  const gradeRef = useRef(grade);
  gradeRef.current = grade;
  const [state, setState] = useState<PublicMathBossState | null>(null);
  const [joinedAs, setJoinedAs] = useState<"host" | "player" | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roomId || !playerId) return;
    const socket = new PartySocket({ host: PARTYKIT_HOST, room: roomId, party: "mathboss", id: playerId });
    socketRef.current = socket;
    socket.addEventListener("open", () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: "join", playerId, name, grade: gradeRef.current, role } satisfies MathBossClientMessage));
    });
    socket.addEventListener("close", () => setConnected(false));
    socket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data) as MathBossServerMessage;
      if (msg.type === "state") setState(msg.state);
      else if (msg.type === "role") setJoinedAs(msg.role);
      else if (msg.type === "error") setError(msg.message);
    });
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId, playerId, name, role]);

  const send = useCallback((msg: MathBossClientMessage) => socketRef.current?.send(JSON.stringify(msg)), []);
  return { state, joinedAs, connected, error, clearError: () => setError(""), send };
}
