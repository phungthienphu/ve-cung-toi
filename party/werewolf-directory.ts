// Same pattern as party/soccer-directory.ts — one shared "main" room keeping an
// in-memory registry of open werewolf lobbies so the home screen can list
// joinable rooms without a code. Not gameplay-critical, safe to lose on
// hibernation (rooms just re-report on their next state change).

import type * as Party from "partykit/server";
import type { WerewolfRoomListing } from "../shared/werewolfTypes";

const STALE_MS = 10 * 60 * 1000;

interface StoredEntry extends WerewolfRoomListing {
  updatedAt: number;
}

export default class WerewolfDirectory implements Party.Server {
  rooms = new Map<string, StoredEntry>();

  constructor(readonly party: Party.Party) {}

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === "POST") {
      const body = (await req.json()) as Partial<StoredEntry>;
      if (!body.roomId) return new Response("missing roomId", { status: 400 });
      this.rooms.set(body.roomId, {
        roomId: body.roomId,
        hostName: body.hostName ?? "",
        playerCount: body.playerCount ?? 0,
        maxPlayers: body.maxPlayers ?? 12,
        status: body.status ?? "lobby",
        updatedAt: Date.now(),
      });
      return new Response("ok");
    }

    const now = Date.now();
    const listing: WerewolfRoomListing[] = [];
    for (const [id, entry] of this.rooms) {
      if (now - entry.updatedAt > STALE_MS) {
        this.rooms.delete(id);
        continue;
      }
      // Empty rooms are gone. Rooms already mid-game stay listed (marked as
      // playing) — the room itself turns latecomers away.
      if (entry.playerCount <= 0) continue;
      listing.push({ roomId: entry.roomId, hostName: entry.hostName, playerCount: entry.playerCount, maxPlayers: entry.maxPlayers, status: entry.status });
    }
    return new Response(JSON.stringify(listing), { headers: { "content-type": "application/json" } });
  }
}
