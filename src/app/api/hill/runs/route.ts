import { NextResponse } from "next/server";
import { isHillMap } from "@shared/hill/types";
import { dbConnect } from "@/server/db/mongodb";
import { HillRun, HillWallet } from "@/server/models/Hill";
import { currentHillDay, ensureHillWallet, hillBoard, parseHillRun, validHillPlayer } from "@/features/hill/server/runs";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const map = q.get("map"), playerId = q.get("playerId") ?? "";
  const day = q.get("day") || null;
  if (!isHillMap(map) || (playerId && !validHillPlayer(playerId)) || (day && !/^\d{4}-\d{2}-\d{2}$/.test(day))) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  try { await dbConnect(); return NextResponse.json(await hillBoard(map, day, playerId)); }
  catch { return NextResponse.json({ error: "Chưa tải được bảng xếp hạng" }, { status: 503 }); }
}
export async function POST(req: Request) {
  let data;
  try { data = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 }); }
  const run = parseHillRun(data);
  if (!run) return NextResponse.json({ error: "Lượt chạy không hợp lệ" }, { status: 400 });
  try {
    await dbConnect();
    const wallet = await ensureHillWallet(run.playerId);
    if (!wallet!.unlocked.includes(run.vehicle)) return NextResponse.json({ error: "Xe chưa được mở" }, { status: 403 });
    let stored = await HillRun.findOne({ runId: run.runId }).lean();
    // Closed daily boards accept no new runs. Previously accepted runs can retry wallet credit.
    if (!stored && run.day && run.day !== currentHillDay()) return NextResponse.json({ error: "Đường ngày này đã khóa sổ" }, { status: 409 });
    if (!stored) {
      try { stored = await HillRun.findOneAndUpdate({ runId: run.runId }, { $setOnInsert: run }, { upsert: true, new: true }).lean(); }
      catch (error) { if ((error as { code?: number }).code !== 11000) throw error; stored = await HillRun.findOne({ runId: run.runId }).lean(); }
    }
    if (!stored || stored.playerId !== run.playerId) return NextResponse.json({ error: "Mã lượt chạy không hợp lệ" }, { status: 409 });
    await HillWallet.updateOne({ playerId: run.playerId, creditedRuns: { $ne: run.runId } }, { $inc: { coins: stored.coins }, $addToSet: { creditedRuns: run.runId } });
    const updated = await HillWallet.findOne({ playerId: run.playerId }).orFail().lean();
    return NextResponse.json({ wallet: { coins: updated.coins, unlocked: updated.unlocked }, board: await hillBoard(stored.map, stored.day ?? null, stored.playerId) });
  } catch { return NextResponse.json({ error: "Chưa lưu được lượt chạy, bạn có thể thử lại" }, { status: 503 }); }
}
