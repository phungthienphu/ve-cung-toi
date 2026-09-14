// Same pattern as party/tank-directory.ts — a single shared "main" room that
// keeps an in-memory registry of open soccer lobbies so the home screen can
// list joinable rooms without a room code. See that file's doc for the full
// reasoning (not gameplay-critical, safe to lose on hibernation).

import type * as Party from "partykit/server";
import type { SoccerRoomListing } from "../shared/soccerTypes";

const STALE_MS = 10 * 60 * 1000;

interface StoredEntry extends SoccerRoomListing {
  updatedAt: number;
}

export default class SoccerDirectory implements Party.Server {
  rooms = new Map<string, StoredEntry>();

  constructor(readonly party: Party.Party) {}

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === "POST") {
      const body = (await req.json()) as Partial<SoccerRoomListing> & { roomId?: string };
      if (!body.roomId) return new Response("missing roomId", { status: 400 });
      this.rooms.set(body.roomId, {
        roomId: body.roomId,
        playerCount: body.playerCount ?? 0,
        teamSize: body.teamSize ?? 2,
        status: body.status ?? "lobby",
        updatedAt: Date.now(),
      });
      return new Response("ok");
    }

    const now = Date.now();
    const listing: SoccerRoomListing[] = [];
    for (const [id, entry] of this.rooms) {
      if (now - entry.updatedAt > STALE_MS) {
        this.rooms.delete(id);
        continue;
      }
      if (entry.status !== "lobby" || entry.playerCount <= 0) continue;
      listing.push({ roomId: entry.roomId, playerCount: entry.playerCount, teamSize: entry.teamSize, status: entry.status });
    }
    return new Response(JSON.stringify(listing), { headers: { "content-type": "application/json" } });
  }
}
