import { withTransactionRetry } from '@/server/db/transaction';
import { PlayerAccessError, requirePlayerAccess } from '@/features/account/server/access';
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
    await requirePlayerAccess(run.playerId);
    const wallet = await ensureHillWallet(run.playerId);
    if (!wallet!.unlocked.includes(run.vehicle)) return NextResponse.json({ error: "Xe chưa được mở" }, { status: 403 });
    await withTransactionRetry(async session => {
      let stored = await HillRun.findOne({ runId: run.runId }).session(session).lean();
      if (!stored && run.day && run.day !== currentHillDay()) throw new PlayerAccessError("Đường ngày này đã khóa sổ", 409);
      if (!stored) stored = await HillRun.findOneAndUpdate({ runId: run.runId }, { $setOnInsert: run }, { upsert: true, new: true, session }).lean();
      if (!stored || stored.playerId !== run.playerId) throw new PlayerAccessError("Mã lượt chạy không hợp lệ", 409);
      // Read/write the source wallet in the same transaction as the run: a
      // concurrent guest merge must include this credit or force a retry.
      const active = await HillWallet.findOne({ playerId: run.playerId, mergedTo: null }).session(session).lean();
      if (!active) throw new PlayerAccessError("Tiến độ đã chuyển vào tài khoản. Hãy tải lại trang.", 409);
      await HillWallet.updateOne({ playerId: run.playerId, mergedTo: null, creditedRuns: { $ne: run.runId } }, { $inc: { coins: stored.coins }, $addToSet: { creditedRuns: run.runId } }, { session });
    });
    const updated = await HillWallet.findOne({ playerId: run.playerId }).orFail().lean();
    return NextResponse.json({ wallet: { coins: updated.coins, unlocked: updated.unlocked }, board: await hillBoard(run.map, run.day ?? null, run.playerId) });
  } catch (error) { if (error instanceof PlayerAccessError) return NextResponse.json({ error: error.message }, { status: error.status }); return NextResponse.json({ error: "Chưa lưu được lượt chạy, bạn có thể thử lại" }, { status: 503 }); }
}
