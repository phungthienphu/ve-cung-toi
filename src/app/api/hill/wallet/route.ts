import { NextResponse } from "next/server";
import { HILL_VEHICLES, isHillVehicle } from "@shared/hillTypes";
import { dbConnect } from "@/lib/mongodb";
import { HillWallet } from "@/lib/models/Hill";
import { ensureHillWallet, validHillPlayer } from "@/lib/hillServer";

export async function GET(req: Request) {
  const playerId = new URL(req.url).searchParams.get("playerId");
  if (!validHillPlayer(playerId)) return NextResponse.json({ error: "Mã máy không hợp lệ" }, { status: 400 });
  try {
    await dbConnect();
    const wallet = await ensureHillWallet(playerId);
    return NextResponse.json({ coins: wallet!.coins, unlocked: wallet!.unlocked });
  } catch { return NextResponse.json({ error: "Chưa kết nối được ví xu" }, { status: 503 }); }
}
export async function POST(req: Request) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 }); }
  if (!validHillPlayer(body?.playerId) || !isHillVehicle(body?.vehicle)) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const playerId: string = body.playerId;
  const vehicle = body.vehicle as keyof typeof HILL_VEHICLES;
  try {
    await dbConnect(); await ensureHillWallet(playerId);
    const bought = await HillWallet.findOneAndUpdate({ playerId, coins: { $gte: HILL_VEHICLES[vehicle].price }, unlocked: { $ne: vehicle } },
      { $inc: { coins: -HILL_VEHICLES[vehicle].price }, $addToSet: { unlocked: vehicle } }, { new: true }).lean();
    const wallet = bought ?? await HillWallet.findOne({ playerId }).orFail().lean();
    if (!wallet.unlocked.includes(vehicle)) return NextResponse.json({ error: "Chưa đủ xu mở xe" }, { status: 409 });
    return NextResponse.json({ coins: wallet.coins, unlocked: wallet.unlocked });
  } catch { return NextResponse.json({ error: "Chưa mở được xe, thử lại sau" }, { status: 503 }); }
}
