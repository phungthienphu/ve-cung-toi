import { NextResponse } from "next/server";
import type { DrawRoomListing } from "@shared/types";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

// Proxied server-side (rather than the browser hitting PartyKit directly)
// purely to sidestep CORS — same pattern as /api/tank-rooms and
// /api/soccer-rooms.
export async function GET() {
  try {
    const protocol = PARTYKIT_HOST.startsWith("127.0.0.1") || PARTYKIT_HOST.startsWith("localhost") ? "http" : "https";
    const res = await fetch(`${protocol}://${PARTYKIT_HOST}/parties/drawlobby/main`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json([] satisfies DrawRoomListing[]);
    const rooms = (await res.json()) as DrawRoomListing[];
    return NextResponse.json(rooms);
  } catch {
    return NextResponse.json([] satisfies DrawRoomListing[]);
  }
}
