import Link from "next/link";
import { HILL_MAPS, HILL_VEHICLES, type HillMapId, type HillVehicleId, type HillWallet, type HillBoard } from "@shared/hillTypes";

interface Props {
  map: HillMapId; vehicle: HillVehicleId; daily: boolean; day: string; wallet: HillWallet; board: HillBoard | null;
  name: string; busy: boolean; onName: (name: string) => void;
  onMap: (map: HillMapId) => void; onVehicle: (vehicle: HillVehicleId) => void;
  onDaily: (daily: boolean) => void; onBuy: (vehicle: HillVehicleId) => void;
}
export default function HillSelection(p: Props) {
  return <div className="text-left">
    <Link href="/con-duong-hoang-kim/friends" className="mb-4 block rounded-xl bg-amber-300 px-4 py-3 text-center font-bold text-emerald-950">🏁 Đua cùng bạn · 2–6 người</Link>
    <div className="mb-4 flex items-center justify-between gap-2"><label className="text-xs text-emerald-100">Tên trên bảng xếp hạng<input maxLength={24} value={p.name} onChange={e => p.onName(e.target.value)} placeholder="Tên của bạn" className="mt-1 block w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-base text-white outline-none focus:border-amber-300" /></label><span className="shrink-0 text-sm font-bold text-amber-200">● {p.wallet.coins} xu</span></div>
    <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Chế độ chơi">
      <button aria-pressed={!p.daily} onClick={() => p.onDaily(false)} className={`rounded-xl px-2 py-2 text-sm ${!p.daily ? "bg-amber-300 text-emerald-950" : "bg-white/10"}`}>🏆 Phá kỷ lục</button>
      <button aria-pressed={p.daily} onClick={() => p.onDaily(true)} className={`rounded-xl px-2 py-2 text-sm ${p.daily ? "bg-amber-300 text-emerald-950" : "bg-white/10"}`}>🗓️ Đường hôm nay</button>
    </div>
    {p.daily && <p className="mb-3 text-xs text-emerald-200">{p.day} · cùng đường cho mọi người · giờ Việt Nam</p>}
    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-200">Chọn bản đồ</p>
    <div className="grid grid-cols-2 gap-2">{(Object.keys(HILL_MAPS) as HillMapId[]).map(id => <button key={id} aria-pressed={p.map === id} onClick={() => p.onMap(id)} className={`rounded-xl border p-3 text-left ${p.map === id ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/5"}`}><span className="text-sm font-bold">{HILL_MAPS[id].icon} {HILL_MAPS[id].name}</span><span className="mt-1 block text-xs text-emerald-100/80">{HILL_MAPS[id].description}</span></button>)}</div>
    <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-emerald-200">Chọn xe</p>
    <div className="grid grid-cols-2 gap-2">{(Object.keys(HILL_VEHICLES) as HillVehicleId[]).map(id => {
      const car = HILL_VEHICLES[id], unlocked = p.wallet.unlocked.includes(id);
      return <div key={id} className={`rounded-xl border p-3 ${p.vehicle === id ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/5"}`}>
        <button disabled={!unlocked} onClick={() => p.onVehicle(id)} aria-pressed={p.vehicle === id} className="w-full text-left disabled:opacity-60"><span className="text-sm font-bold">{car.icon} {car.name}</span><span className="mt-1 block text-xs text-emerald-100/80">{car.description}</span></button>
        {!unlocked && <button disabled={p.busy || p.wallet.coins < car.price} onClick={() => p.onBuy(id)} className="mt-2 w-full rounded-lg bg-amber-300 py-2 text-xs font-bold text-emerald-950 disabled:bg-white/10 disabled:text-white/50">Mở · {car.price} xu</button>}
      </div>;
    })}</div>
    <div className="my-4 rounded-xl bg-black/15 p-3"><p className="mb-2 text-sm font-bold">{p.daily ? "Đường hôm nay" : "Kỷ lục bản đồ"}</p>{p.board ? p.board.leaders.length ? <ol className="space-y-1 text-xs">{p.board.leaders.map(entry => <li key={entry.playerId} className="flex justify-between gap-3"><span>#{entry.rank} {entry.name}</span><span className="tabular-nums text-amber-200">{entry.distance} m</span></li>)}</ol> : <p className="text-xs text-emerald-200">Chưa có lượt chạy. Cắm cờ đầu tiên nhé!</p> : <p className="text-xs text-emerald-200">Bảng xếp hạng đang chờ kết nối.</p>}</div>
  </div>;
}
