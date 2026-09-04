"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type {
  ChatEntry,
  ClientMessage,
  Player,
  PublicRoomState,
  RoomConfig,
  ServerMessage,
  StrokePoint,
  StrokeSegment,
} from "@shared/types";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

export interface GameRoomHandle {
  state: PublicRoomState | null;
  chat: ChatEntry[];
  myWord: string | null;
  wordChoices: { choices: string[]; deadline: number } | null;
  connected: boolean;
  kicked: boolean;
  finalPlayers: Player[] | null;
  lastRoundResult: { word: string; scores: { playerId: string; delta: number }[] } | null;
  strokeEvents: { kind: "stroke" | "point" | "end" | "clear"; segment?: StrokeSegment; strokeId?: string; point?: StrokePoint }[];
  send: (msg: ClientMessage) => void;
  clearStrokeEvents: () => void;
}

export function useGameRoom(roomId: string, playerId: string, name: string): GameRoomHandle {
  const socketRef = useRef<PartySocket | null>(null);
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [myWord, setMyWord] = useState<string | null>(null);
  const [wordChoices, setWordChoices] = useState<{ choices: string[]; deadline: number } | null>(null);
  const [connected, setConnected] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [finalPlayers, setFinalPlayers] = useState<Player[] | null>(null);
  const [lastRoundResult, setLastRoundResult] = useState<{ word: string; scores: { playerId: string; delta: number }[] } | null>(null);
  const [strokeEvents, setStrokeEvents] = useState<GameRoomHandle["strokeEvents"]>([]);

  useEffect(() => {
    if (!roomId || !playerId) return;

    const socket = new PartySocket({ host: PARTYKIT_HOST, room: roomId, id: playerId });
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: "join", playerId, name } satisfies ClientMessage));
    });
    socket.addEventListener("close", () => setConnected(false));

    socket.addEventListener("message", (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      switch (msg.type) {
        case "state":
          setState(msg.state);
          // word_choices is a private, drawer-only message sent right before this
          // broadcast — only clear it once we're actually past the choosing phase.
          if (msg.state.status !== "choosing") setWordChoices(null);
          break;
        case "your_word":
          setMyWord(msg.word);
          break;
        case "word_choices":
          setWordChoices({ choices: msg.choices, deadline: msg.deadline });
          break;
        case "chat_message":
          setChat((prev) => [...prev.slice(-199), msg.entry]);
          break;
        case "stroke":
          setStrokeEvents((prev) => [...prev, { kind: "stroke", segment: msg.segment }]);
          break;
        case "stroke_point":
          setStrokeEvents((prev) => [...prev, { kind: "point", strokeId: msg.strokeId, point: msg.point }]);
          break;
        case "stroke_end":
          setStrokeEvents((prev) => [...prev, { kind: "end", strokeId: msg.strokeId }]);
          break;
        case "clear_canvas":
          setStrokeEvents((prev) => [...prev, { kind: "clear" }]);
          break;
        case "round_result":
          setLastRoundResult({ word: msg.word, scores: msg.scores });
          setMyWord(null);
          break;
        case "game_result":
          setFinalPlayers(msg.players);
          break;
        case "kicked":
          setKicked(true);
          break;
        case "error":
          console.error("Room error:", msg.message);
          break;
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerId]);

  const send = useCallback((msg: ClientMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  const clearStrokeEvents = useCallback(() => setStrokeEvents([]), []);

  return { state, chat, myWord, wordChoices, connected, kicked, finalPlayers, lastRoundResult, strokeEvents, send, clearStrokeEvents };
}

export type { RoomConfig };
