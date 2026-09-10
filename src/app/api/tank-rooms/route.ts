import { NextResponse } from "next/server";
import type { TankRoomListing } from "@shared/tankTypes";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

// Proxied server-side (rather than the browser hitting PartyKit directly)
// purely to sidestep CORS — the tank-directory party has no reason to know
// about allowed origins, and this keeps that concern in one place.
export async function GET() {
  try {
    const protocol = PARTYKIT_HOST.startsWith("127.0.0.1") || PARTYKIT_HOST.startsWith("localhost") ? "http" : "https";
    const res = await fetch(`${protocol}://${PARTYKIT_HOST}/parties/tanklobby/main`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json([] satisfies TankRoomListing[]);
    const rooms = (await res.json()) as TankRoomListing[];
    return NextResponse.json(rooms);
  } catch {
    return NextResponse.json([] satisfies TankRoomListing[]);
  }
}
