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
      } else if (msg.type === "state_delta") {
        setState((prev) => {
          // A delta only ever follows a "state" this connection already
          // received (see TankServerMessage's doc) — if that hasn't
          // happened yet there's nothing to patch, so just drop it; the
          // next full state (already on its way) will catch it up.
          if (!prev) return prev;
          const roster = rosterRef.current;
          const players = new Map(prev.players.map((p) => [p.id, p]));
          for (const id of msg.delta.removedPlayerIds) players.delete(id);
          for (const patch of msg.delta.players) {
            const existing = players.get(patch.id);
            players.set(patch.id, {
              ...(existing ?? (roster.get(patch.id) as ClientTankPlayer)),
              ...patch,
            });
          }
          const monsters = new Map(prev.monsters.map((m) => [m.id, m]));
          for (const id of msg.delta.removedMonsterIds) monsters.delete(id);
          for (const patch of msg.delta.monsters) {
            monsters.set(patch.id, { ...monsters.get(patch.id), ...patch } as TankPublicState["monsters"][number]);
          }
          return {
            ...prev,
            players: [...players.values()],
            monsters: [...monsters.values()],
            bullets: msg.delta.bullets,
            pickups: msg.delta.pickups,
            traps: msg.delta.traps,
            crates: msg.delta.crates,
            airstrikes: msg.delta.airstrikes,
            redBarrages: msg.delta.redBarrages,
            impacts: msg.delta.impacts,
            kills: msg.delta.kills,
            timeOfDay: msg.delta.timeOfDay,
            teamScores: msg.delta.teamScores,
            winnerId: msg.delta.winnerId,
            winningTeam: msg.delta.winningTeam,
            matchEndsAt: msg.delta.matchEndsAt,
            serverNow: msg.delta.serverNow,
          };
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
