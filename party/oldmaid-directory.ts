// Same pattern as party/battleship-directory.ts — one shared "main" room keeping
// an in-memory registry of public Ai Là Heo rooms so /ai-la-heo can list
// joinable tables without a code. Not gameplay-critical, safe to lose on
// hibernation (rooms just re-report on their next state change).

import { Server } from "partyserver";
import type { Env } from "./env";
import type { OldMaidRoomListing } from "../shared/oldMaidTypes";

const STALE_MS = 10 * 60 * 1000;

interface StoredEntry extends OldMaidRoomListing {
  updatedAt: number;
}

export class OldMaidDirectory extends Server<Env> {
  rooms = new Map<string, StoredEntry>();

  async onRequest(req: Request): Promise<Response> {
    if (req.method === "POST") {
      const body = (await req.json()) as Partial<OldMaidRoomListing>;
      if (!body.roomId) return new Response("missing roomId", { status: 400 });
      // Private, empty or closed rooms drop out of the list.
      if (body.hidden) {
        this.rooms.delete(body.roomId);
        return new Response("ok");
      }
      this.rooms.set(body.roomId, {
        roomId: body.roomId,
        hostName: body.hostName ?? "",
        playerCount: body.playerCount ?? 0,
        maxPlayers: body.maxPlayers ?? 6,
        status: body.status ?? "lobby",
        updatedAt: Date.now(),
      });
      return new Response("ok");
    }

    const now = Date.now();
    const listing: OldMaidRoomListing[] = [];
    for (const [id, entry] of this.rooms) {
      if (now - entry.updatedAt > STALE_MS) {
        this.rooms.delete(id);
        continue;
      }
      listing.push({ roomId: entry.roomId, hostName: entry.hostName, playerCount: entry.playerCount, maxPlayers: entry.maxPlayers, status: entry.status });
    }
    // Rooms still waiting for players first.
    listing.sort((a, b) => (a.status === b.status ? b.playerCount - a.playerCount : a.status === "lobby" ? -1 : 1));
    return Response.json(listing);
  }
}
