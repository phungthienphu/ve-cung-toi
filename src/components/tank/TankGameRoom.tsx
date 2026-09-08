"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTankRoom } from "@/lib/useTankRoom";
import { playClick } from "@/lib/sound";
import { fireworks } from "@/lib/confetti";
import { DEFAULT_MAP_ID, KILL_TARGET, MAX_ULTIMATE_ENERGY, MIN_TANK_PLAYERS, TANK_MAPS, type ItemKind } from "@shared/tankTypes";
import TankCanvas from "./TankCanvas";

interface Props {
  roomId: string;
  playerId: string;
  name: string;
  color: string;
}

export default function TankGameRoom({ roomId, playerId, name, color }: Props) {
  const router = useRouter();
  const { state, connected, kicked, send } = useTankRoom(roomId, playerId, name, color);
  const [mapId, setMapId] = useState(DEFAULT_MAP_ID);

  useEffect(() => {
    if (kicked) router.push("/tank-game");
  }, [kicked, router]);

  useEffect(() => {
    if (state?.status === "ended") fireworks();
  }, [state?.status]);

  if (!state) {
    return (
      <div className="flex min-h-app items-center justify-center text-slate-400">
        {connected ? "Đang tải phòng..." : "Đang kết nối..."}
      </div>
    );
  }

  const self = state.players.find((p) => p.id === playerId);
  const isHost = state.hostId === playerId;
  const connectedCount = state.players.filter((p) => p.connected).length;

  function handleLeave() {
    if (!confirm("Rời khỏi phòng?")) return;
    playClick();
    send({ type: "leave_room" });
    router.push("/tank-game");
  }

  if (state.status === "lobby") {
    return (
      <main className="flex min-h-app items-center justify-center bg-tank-scene px-4 py-10">
        <div className="w-full max-w-md min-w-0 rounded-xl border border-cream-200 bg-white p-6 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight text-ink">Phòng chờ</h2>
            <span className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">
              Mã: {roomId}
            </span>
          </div>

          <div className="mb-5 space-y-1.5">
            {state.players.map((p) => (
              <div
                key={p.id}
                className={`flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${!p.connected ? "opacity-40" : ""}`}
              >
                <span className="h-4 w-4 shrink-0 rounded" style={{ backgroundColor: p.color }} />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                {p.isHost && <span className="shrink-0">👑</span>}
              </div>
            ))}
          </div>

          {isHost && (
            <div className="mb-5">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Bản đồ</label>
              <div className="flex flex-wrap gap-2">
                {TANK_MAPS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMapId(m.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                      mapId === m.id
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-300 text-slate-700 hover:border-slate-500"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isHost ? (
              <button
                onClick={() => {
                  playClick();
                  send({ type: "start_game", mapId });
                }}
                disabled={connectedCount < MIN_TANK_PLAYERS}
                className="min-w-0 flex-1 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {connectedCount < MIN_TANK_PLAYERS ? `Cần ít nhất ${MIN_TANK_PLAYERS} người` : "Bắt đầu chiến đấu"}
              </button>
            ) : (
              <p className="min-w-0 flex-1 py-2.5 text-center text-sm text-slate-500">Đang chờ chủ phòng bắt đầu...</p>
            )}
            <button
              onClick={handleLeave}
              className="shrink-0 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:border-red-400 hover:bg-red-50"
            >
              Rời phòng
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (state.status === "ended") {
    const ranking = [...state.players].sort((a, b) => b.score - a.score);
    const winner = state.players.find((p) => p.id === state.winnerId);
    return (
      <main className="flex min-h-app items-center justify-center bg-tank-scene px-4 py-10">
        <div className="w-full max-w-md min-w-0 rounded-xl border border-cream-200 bg-white p-6 text-center shadow-xl">
          <h2 className="mb-1 truncate text-2xl font-bold text-ink">🏆 {winner?.name ?? "?"} thắng!</h2>
          <p className="mb-6 text-sm text-ink/50">Đạt {KILL_TARGET} điểm tiêu diệt trước tiên.</p>

          <div className="mb-6 space-y-1.5 text-left">
            {ranking.map((p, i) => (
              <div key={p.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-slate-400">#{i + 1}</span>
                  <span className="h-4 w-4 shrink-0 rounded" style={{ backgroundColor: p.color }} />
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                </span>
                <span className="shrink-0 font-semibold text-slate-700">{p.score} điểm</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {isHost && (
              <button
                onClick={() => {
                  playClick();
                  send({ type: "play_again" });
                }}
                className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                Chơi lại
              </button>
            )}
            <Link
              href="/tank-game"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-app bg-tank-scene">
      <div className="mx-auto flex max-w-4xl min-w-0 flex-col gap-3 px-3 py-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xl">
          <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm">
            {state.players.map((p) => (
              <span key={p.id} className="flex min-w-0 items-center gap-1.5 font-medium">
                <span className="h-3 w-3 shrink-0 rounded" style={{ backgroundColor: p.color }} />
                <span className="max-w-[8rem] truncate">{p.name}</span>: {p.score}
              </span>
            ))}
          </div>
          <button
            onClick={handleLeave}
            className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:border-red-400 hover:bg-red-50"
          >
            Rời phòng
          </button>
        </div>

        {self && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-xl">
            <span className="shrink-0 text-xs font-medium text-slate-500">Vật phẩm:</span>
            {[0, 1, 2].map((i) => {
              const kind = self.items[i] as ItemKind | undefined;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!kind}
                  onClick={() => kind && send({ type: "use_item", kind })}
                  title={kind ? `Bấm hoặc nhấn ${i + 1} để dùng` : "Trống"}
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-base transition ${
                    kind ? "border-slate-300 bg-slate-50 hover:bg-slate-100" : "border-dashed border-slate-200 text-slate-300"
                  }`}
                >
                  {kind === "trap" ? "🪤" : kind === "blind" ? "😵" : kind === "shield" ? "🛡️" : kind === "fire" ? "🔥" : "—"}
                  {kind && (
                    <span className="absolute -bottom-1 -right-1 rounded bg-slate-800 px-1 text-[9px] font-bold text-white">
                      {i + 1}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="mx-1 h-7 w-px shrink-0 bg-slate-200" />
            <button
              type="button"
              disabled={self.ultimateEnergy < MAX_ULTIMATE_ENERGY}
              onClick={() => send({ type: "shoot", big: true })}
              title="Đạn to (R) — sát thương gấp đôi, cần đầy năng lượng"
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-base transition ${
                self.ultimateEnergy >= MAX_ULTIMATE_ENERGY
                  ? "border-red-400 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-slate-200 text-slate-300"
              }`}
            >
              💥
              <span className="h-1.5 w-8 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full bg-red-500 transition-[width]"
                  style={{ width: `${Math.max(0, Math.min(100, (self.ultimateEnergy / MAX_ULTIMATE_ENERGY) * 100))}%` }}
                />
              </span>
              <span className="text-[10px] font-bold">R</span>
            </button>
          </div>
        )}
        {self?.blindedUntil && self.blindedUntil > state.serverNow && (
          <div className="rounded-lg bg-purple-100 px-3 py-1.5 text-center text-xs font-medium text-purple-700 shadow-xl">
            😵 Bạn đang bị làm mù, chỉ thấy khu vực quanh xe!
          </div>
        )}
        {self && self.shieldHitsLeft > 0 && (
          <div className="rounded-lg bg-blue-100 px-3 py-1.5 text-center text-xs font-medium text-blue-700 shadow-xl">
            🛡️ Khiên đang bật ({self.shieldHitsLeft} phát chịu được) — không thể di chuyển!
          </div>
        )}
        {self && self.fireShotsLeft > 0 && (
          <div className="rounded-lg bg-orange-100 px-3 py-1.5 text-center text-xs font-medium text-orange-700 shadow-xl">
            🔥 Đạn lửa: còn {self.fireShotsLeft} viên — trúng đích sẽ gây bỏng theo thời gian
          </div>
        )}
        {self && self.burningUntil && self.burningUntil > state.serverNow && (
          <div className="rounded-lg bg-red-100 px-3 py-1.5 text-center text-xs font-medium text-red-700 shadow-xl">
            🔥 Bạn đang bị bỏng! Chạy vào vũng nước để dập lửa.
          </div>
        )}

        <TankCanvas state={state} selfId={playerId} send={send} />

        <p className="text-center text-xs text-ink/40">
          Di chuyển: mũi tên / WASD · Bắn: phím cách · Dùng vật phẩm: 1/2/3 · Đạn to: R · Giữ Shift để tăng tốc
          {self && !self.alive && " · Bạn vừa bị bắn, hồi sinh sau ít giây..."}
        </p>
      </div>
    </div>
  );
}
