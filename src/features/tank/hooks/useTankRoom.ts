"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import { TICK_MS, type PlayerRosterEntry, type TankClientMessage, type TankPublicState, type TankServerMessage } from "@shared/tank/types";

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
  send: (msg: TankClientMessage) => number;
}

export function useTankRoom(roomId: string, playerId: string, name: string, color: string): TankRoomHandle {
  const inputSequence = useRef(0);
  const transport = useRef<((message: string) => void) | null>(null);
  const rosterRef = useRef<Map<string, PlayerRosterEntry>>(new Map());
  const [state, setState] = useState<ClientTankPublicState | null>(null);
  const [connected, setConnected] = useState(false);
  const [kicked, setKicked] = useState(false);

  useEffect(() => {
    if (!roomId || !playerId) return;

    let cancelled = false;
    inputSequence.current = 0;
    rosterRef.current.clear();
    const receive = (message: string) => {
      const msg: TankServerMessage = JSON.parse(message);
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
    };

    if (roomId === 'local') {
      let dispose = () => {};
      void import('@shared/tank/engine').then(({ TankEngine }) => {
        if (cancelled) return;
        let clock = Date.now(), last = performance.now(), accumulated = 0, raf = 0;
        const engine = new TankEngine({ name: 'local', automatic: false, now: () => clock, emit: receive });
        const peer = { id: playerId, send: receive, close: () => {} };
        transport.current = message => engine.onMessage(peer, message);
        engine.onMessage(peer, JSON.stringify({ type: 'join', playerId, name, color }));
        engine.onMessage(peer, JSON.stringify({ type: 'set_mode', mode: 'practice' }));
        setConnected(true);
        const loop = (now: number) => {
          accumulated = Math.min(150, accumulated + now - last); last = now;
          while (accumulated >= TICK_MS) { accumulated -= TICK_MS; clock += TICK_MS; engine.step(); }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        dispose = () => { cancelAnimationFrame(raf); engine.dispose(); };
      });
      return () => { cancelled = true; transport.current = null; dispose(); };
    }
    const socket = new PartySocket({ host: PARTYKIT_HOST, room: roomId, party: 'tanks', id: playerId });
    transport.current = message => { if (socket.readyState === WebSocket.OPEN) socket.send(message); };
    socket.addEventListener('open', () => {
      inputSequence.current = 0; setConnected(true);
      socket.send(JSON.stringify({ type: 'join', playerId, name, color } satisfies TankClientMessage));
    });
    socket.addEventListener('close', () => setConnected(false));
    socket.addEventListener('message', event => receive(event.data));
    return () => { cancelled = true; transport.current = null; socket.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerId]);

  const send = useCallback((msg: TankClientMessage) => {
    const seq = msg.type === 'input' ? ++inputSequence.current : 0;
    transport.current?.(JSON.stringify(msg.type === 'input' ? { ...msg, seq } : msg));
    return seq;
  }, []);

  return { state, connected, kicked, send };
}
