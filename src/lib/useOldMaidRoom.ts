"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type { Emote, OldMaidClientMessage, OldMaidEvent, OldMaidHandCard, OldMaidServerMessage, PublicOldMaidState } from "@shared/oldMaidTypes";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

export interface LoggedEvent {
  seq: number;
  at: number;
  event: OldMaidEvent;
}

export interface LiveEmote {
  seq: number;
  at: number;
  playerId: string;
  emote: Emote;
}

export interface OldMaidHand {
  round: number;
  cards: OldMaidHandCard[];
  /** The card you just drew, to point it out in your hand. */
  drawnId?: string;
}

/** The Ai Là Heo room connection: public state, your own hand, and the live stream of table events. */
export function useOldMaidRoom(roomId: string, playerId: string, name: string) {
  const socketRef = useRef<PartySocket | null>(null);
  const seqRef = useRef(0);
  const [state, setState] = useState<PublicOldMaidState | null>(null);
  const [hand, setHand] = useState<OldMaidHand>({ round: 0, cards: [] });
  const [events, setEvents] = useState<LoggedEvent[]>([]);
  const [hover, setHover] = useState<{ drawerId: string; slot: number | null } | null>(null);
  const [emotes, setEmotes] = useState<LiveEmote[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roomId || !playerId) return;
    const socket = new PartySocket({ host: PARTYKIT_HOST, room: roomId, party: "oldmaid", id: playerId });
    socketRef.current = socket;
    socket.addEventListener("open", () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: "join", playerId, name } satisfies OldMaidClientMessage));
    });
    socket.addEventListener("close", () => setConnected(false));
    socket.addEventListener("message", (message) => {
      let msg: OldMaidServerMessage;
      try {
        msg = JSON.parse(message.data) as OldMaidServerMessage;
      } catch {
        return;
      }
      const now = Date.now();
      if (msg.type === "state") {
        setState(msg.state);
        // A new turn starts with nobody pointing at anything.
        if (!msg.state.turn) setHover(null);
        else setHover((current) => (current && current.drawerId === msg.state.turn?.drawerId ? current : null));
      } else if (msg.type === "hand") setHand({ round: msg.round, cards: msg.cards, drawnId: msg.drawnId });
      else if (msg.type === "event") {
        const entry = { seq: ++seqRef.current, at: now, event: msg.event };
        setEvents((current) => [...current.slice(-29), entry]);
      } else if (msg.type === "hover") setHover({ drawerId: msg.drawerId, slot: msg.slot });
      else if (msg.type === "emote") {
        const entry = { seq: ++seqRef.current, at: now, playerId: msg.playerId, emote: msg.emote };
        setEmotes((current) => [...current.filter((item) => now - item.at < 4000).slice(-19), entry]);
      } else if (msg.type === "error") setError(msg.message);
    });
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId, playerId, name]);

  const send = useCallback((msg: OldMaidClientMessage) => socketRef.current?.send(JSON.stringify(msg)), []);

  // Pointing at cards fires constantly: send at most ~15 times a second, and never the same slot twice.
  const lastHoverSent = useRef<{ slot: number | null; at: number }>({ slot: null, at: 0 });
  const pendingHover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendHover = useCallback(
    (slot: number | null) => {
      if (pendingHover.current) clearTimeout(pendingHover.current);
      const fire = () => {
        if (lastHoverSent.current.slot === slot) return;
        lastHoverSent.current = { slot, at: Date.now() };
        send({ type: "hover", slot });
      };
      const wait = 65 - (Date.now() - lastHoverSent.current.at);
      if (wait <= 0) fire();
      else pendingHover.current = setTimeout(fire, wait);
    },
    [send],
  );
  useEffect(() => {
    // New turn: forget what was last sent so the first point of the turn always goes out.
    lastHoverSent.current = { slot: null, at: 0 };
  }, [state?.turn?.drawerId, state?.turn?.endsAt]);

  const clearError = useCallback(() => setError(""), []);
  return { state, hand, events, hover, emotes, connected, error, clearError, send, sendHover };
}
