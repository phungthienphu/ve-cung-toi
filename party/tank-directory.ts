// A single shared room (always addressed as "main") that just keeps an
// in-memory registry of currently-open tank lobbies, so the tank-game home
// screen can list joinable rooms without anyone needing to already know a
// room code. Tank rooms (tank-server.ts) push their own state here on every
// change that could affect the listing (join/leave/mode/status); this party
// never talks back to them.
//
// Not itself gameplay-critical: if this room ever hibernates and loses its
// in-memory map, the list just goes temporarily empty until the next report
// comes in — nothing about an actual match depends on it.

import type * as Party from "partykit/server";
import type { TankRoomListing } from "../shared/tankTypes";

// Safety-net only — normal removal happens by a room reporting playerCount:
// 0 or a non-"lobby" status, which the GET listing already filters out. This
// just guards against a report being missed entirely (e.g. the tank room's
// process was killed before it could report the room emptying out).
const STALE_MS = 10 * 60 * 1000;

interface StoredEntry extends TankRoomListing {
  updatedAt: number;
}

export default class TankDirectory implements Party.Server {
  rooms = new Map<string, StoredEntry>();

  constructor(readonly party: Party.Party) {}

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === "POST") {
      const body = (await req.json()) as Partial<TankRoomListing> & { roomId?: string };
      if (!body.roomId) return new Response("missing roomId", { status: 400 });
      this.rooms.set(body.roomId, {
        roomId: body.roomId,
        playerCount: body.playerCount ?? 0,
        mode: body.mode ?? "ffa",
        status: body.status ?? "lobby",
        updatedAt: Date.now(),
      });
      return new Response("ok");
    }

    const now = Date.now();
    const listing: TankRoomListing[] = [];
    for (const [id, entry] of this.rooms) {
      if (now - entry.updatedAt > STALE_MS) {
        this.rooms.delete(id);
        continue;
      }
      // Only rooms someone can cleanly join from scratch — a room mid-match
      // or with nobody left in it doesn't belong in a "join a game" list.
      if (entry.status !== "lobby" || entry.playerCount <= 0) continue;
      listing.push({ roomId: entry.roomId, playerCount: entry.playerCount, mode: entry.mode, status: entry.status });
    }
    return new Response(JSON.stringify(listing), { headers: { "content-type": "application/json" } });
  }
}
