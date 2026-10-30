import { NextResponse } from "next/server";
import type { OldMaidRoomListing } from "@shared/oldMaidTypes";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

// Same CORS-sidestepping proxy as /api/battleship-rooms — see tank-rooms' doc.
export async function GET() {
  try {
    const protocol = PARTYKIT_HOST.startsWith("127.0.0.1") || PARTYKIT_HOST.startsWith("localhost") ? "http" : "https";
    const res = await fetch(`${protocol}://${PARTYKIT_HOST}/parties/oldmaidlobby/main`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json([] satisfies OldMaidRoomListing[]);
    return NextResponse.json((await res.json()) as OldMaidRoomListing[]);
  } catch {
    return NextResponse.json([] satisfies OldMaidRoomListing[]);
  }
}
