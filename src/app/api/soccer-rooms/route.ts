import { NextResponse } from "next/server";
import type { SoccerRoomListing } from "@shared/soccerTypes";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

// Same CORS-sidestepping proxy as /api/tank-rooms — see that route's doc.
export async function GET() {
  try {
    const protocol = PARTYKIT_HOST.startsWith("127.0.0.1") || PARTYKIT_HOST.startsWith("localhost") ? "http" : "https";
    const res = await fetch(`${protocol}://${PARTYKIT_HOST}/parties/soccerlobby/main`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json([] satisfies SoccerRoomListing[]);
    const rooms = (await res.json()) as SoccerRoomListing[];
    return NextResponse.json(rooms);
  } catch {
    return NextResponse.json([] satisfies SoccerRoomListing[]);
  }
}
