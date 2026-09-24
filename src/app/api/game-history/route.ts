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

// Old drawing-game docs predate the `gameType` field entirely, so filtering
// for "draw" also has to match docs missing it outright — the schema's
// `default: "draw"` only backfills on read of a fetched doc, not on a query
// against the raw collection.
function filterFor(gameType: string | null | undefined) {
  return gameType && (VALID_GAME_TYPES as readonly string[]).includes(gameType)
    ? { $or: [{ gameType }, ...(gameType === "draw" ? [{ gameType: { $exists: false } }] : [])] }
    : {};
}

// Deleting history is destructive and there are no accounts, so it sits
// behind one shared password checked here on the server (never shipped to the
// client). Override it with HISTORY_DELETE_PASSWORD in the environment.
const DELETE_PASSWORD = process.env.HISTORY_DELETE_PASSWORD || "555555";

function passwordMatches(input: unknown): boolean {
  if (typeof input !== "string" || input.length !== DELETE_PASSWORD.length) return false;
  let diff = 0;
  for (let i = 0; i < input.length; i++) diff |= input.charCodeAt(i) ^ DELETE_PASSWORD.charCodeAt(i);
  return diff === 0;
}

export async function DELETE(req: Request) {
  try {
    const { password, id, gameType } = (await req.json()) as { password?: string; id?: string; gameType?: string };
    if (!passwordMatches(password)) {
      // A short pause makes guessing the password by hand pointless.
      await new Promise((resolve) => setTimeout(resolve, 600));
      return NextResponse.json({ error: "Sai mật khẩu" }, { status: 403 });
    }
    await dbConnect();
    if (id) {
      const result = await GameHistory.deleteOne({ _id: id });
      return NextResponse.json({ ok: true, deleted: result.deletedCount });
    }
    if (gameType && (VALID_GAME_TYPES as readonly string[]).includes(gameType)) {
      const result = await GameHistory.deleteMany(filterFor(gameType));
      return NextResponse.json({ ok: true, deleted: result.deletedCount });
    }
    return NextResponse.json({ error: "Thiếu id hoặc gameType" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const gameType = new URL(req.url).searchParams.get("gameType");
    await dbConnect();
    const filter = filterFor(gameType);
    const recent = await GameHistory.find(filter).sort({ createdAt: -1 }).limit(30).lean();
    return NextResponse.json({ history: recent });
  } catch {
    return NextResponse.json({ history: [] });
  }
}
