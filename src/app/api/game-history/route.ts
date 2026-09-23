import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import GameHistory from "@/lib/models/GameHistory";

const VALID_GAME_TYPES = ["draw", "tank", "soccer", "werewolf"] as const;
type GameType = (typeof VALID_GAME_TYPES)[number];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      gameType,
      roomId,
      players,
      rounds,
      mode,
      winnerName,
      winningTeam,
      teamScores,
      detail,
      playedAt,
    } = body as {
      gameType?: GameType;
      roomId: string;
      players: { name: string; score: number }[];
      rounds?: number;
      mode?: string;
      winnerName?: string | null;
      winningTeam?: string | null;
      teamScores?: { A: number; B: number };
      detail?: unknown;
      playedAt: string;
    };

    if (!roomId || !Array.isArray(players)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await dbConnect();
    await GameHistory.create({
      gameType: gameType && VALID_GAME_TYPES.includes(gameType) ? gameType : "draw",
      roomId,
      players,
      rounds,
      mode,
      winnerName,
      winningTeam,
      teamScores,
      detail,
      playedAt: new Date(playedAt),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Persistence is best-effort; never let this block a game loop.
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
  }
}

export async function GET(req: Request) {
  try {
    const gameType = new URL(req.url).searchParams.get("gameType");
    await dbConnect();
    // Old drawing-game docs predate the `gameType` field entirely, so
    // filtering for "draw" also has to match docs missing it outright —
    // the schema's `default: "draw"` only backfills on read of a fetched
    // doc, not on a query against the raw collection.
    const filter = gameType && (VALID_GAME_TYPES as readonly string[]).includes(gameType) ? { $or: [{ gameType }, ...(gameType === "draw" ? [{ gameType: { $exists: false } }] : [])] } : {};
    const recent = await GameHistory.find(filter).sort({ createdAt: -1 }).limit(30).lean();
    return NextResponse.json({ history: recent });
  } catch {
    return NextResponse.json({ history: [] });
  }
}
