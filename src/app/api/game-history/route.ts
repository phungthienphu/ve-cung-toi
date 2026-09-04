import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import GameHistory from "@/lib/models/GameHistory";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roomId, players, rounds, playedAt } = body as {
      roomId: string;
      players: { name: string; score: number }[];
      rounds: number;
      playedAt: string;
    };

    if (!roomId || !Array.isArray(players)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await dbConnect();
    await GameHistory.create({ roomId, players, rounds, playedAt: new Date(playedAt) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Persistence is best-effort; never let this block the game loop.
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
  }
}

export async function GET() {
  try {
    await dbConnect();
    const recent = await GameHistory.find({}).sort({ createdAt: -1 }).limit(20).lean();
    return NextResponse.json({ history: recent });
  } catch {
    return NextResponse.json({ history: [] });
  }
}
