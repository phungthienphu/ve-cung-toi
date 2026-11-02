"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HILL_MAPS, HILL_VEHICLES, type HillBoard, type HillMapId, type HillVehicleId, type HillWallet } from "@shared/hillTypes";
import { BOT_LEVELS, type HillBotSetup } from "./HillBotRace";
import { HillFriendsPanel } from "./HillFriendsPanel";
import { CoinPill, GameButton, MapPicker, Segmented, Sheet, StatBars, VehiclePicker } from "./HillUi";
import { VEHICLE_INFO, formatNumber } from "./hillUiData";

// The game's main menu, laid over the live game canvas: the scene behind is
// the selected map with the selected car parked on it (HillGame zooms in
// while this is open), so every pick is previewed for real. The four modes
// sit side by side as equals; the panel below changes with the mode. Phones
// in portrait get a bottom panel, landscape and desktop a side panel — the
// car stays in view either way.

export type HillMode = "record" | "daily" | "bots" | "friends";

const MODES: { id: HillMode; icon: string; label: string; detail: string }[] = [
  { id: "record", icon: "🏆", label: "Phá kỷ lục", detail: "Đi xa nhất có thể" },
  { id: "daily", icon: "🗓️", label: "Đường hôm nay", detail: "Cả trang chung 1 đường" },
  { id: "bots", icon: "🤖", label: "Đua với bot", detail: "1–5 đối thủ máy" },
  { id: "friends", icon: "👥", label: "Đua cùng bạn", detail: "2–6 người online" },
];

interface Props {
  mode: HillMode;
  map: HillMapId;
  vehicle: HillVehicleId;
  botSetup: HillBotSetup;
  wallet: HillWallet;
  board: HillBoard | null;
  best: number;
  bests: Partial<Record<HillMapId, number>>;
  name: string;
  busy: boolean;
  saveStatus: string;
  muted: boolean;
  onName: (name: string) => void;
  onMap: (map: HillMapId) => void;
  onVehicle: (vehicle: HillVehicleId) => void;
  onMode: (mode: HillMode) => void;
  onBotSetup: (patch: Partial<HillBotSetup>) => void;
  onBuy: (vehicle: HillVehicleId) => void;
  onStart: () => void;
  onStartBots: () => void;
  onSync: () => void;
  onMute: () => void;
}

const DAY_MS = 86_400_000;
const VIETNAM_OFFSET_MS = 7 * 3_600_000;

/** Time left before the daily road changes (midnight, Vietnam time), as "05:12:33". */
function useDailyCountdown(active: boolean) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const ms = DAY_MS - ((Date.now() + VIETNAM_OFFSET_MS) % DAY_MS);
      const total = Math.floor(ms / 1000);
      setLeft([Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map((part) => String(part).padStart(2, "0")).join(":"));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return left;
}

export default function HillGarage(p: Props) {
  const [tab, setTab] = useState<"vehicle" | "map" | "rivals">("vehicle");
  const [boardOpen, setBoardOpen] = useState(false);
  const daily = p.mode === "daily";
  const racing = p.mode === "bots";
  const countdown = useDailyCountdown(daily);
  const car = HILL_VEHICLES[p.vehicle];
  const info = VEHICLE_INFO[p.vehicle];
  // Races (bots, friends) lend every car; records need it unlocked.
  const isLocked = (id: HillVehicleId) => !racing && !p.wallet.unlocked.includes(id);
  const locked = isLocked(p.vehicle);
  const shownTab = tab === "rivals" && !racing ? "vehicle" : tab;
  const missing = Math.max(0, car.price - p.wallet.coins);
  const rank = p.board?.personal?.rank;

  return (
    <div className="absolute inset-0 flex flex-col landscape:flex-row">
      {/* The showroom: the canvas behind shows through. */}
      <div className="pointer-events-none relative min-h-0 flex-1">
        <div className="pointer-events-auto flex items-center gap-2 px-3 pb-2" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
          <Link href="/" aria-label="Về trang chủ" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/45 text-xl font-bold backdrop-blur hover:bg-black/60">
            ‹
          </Link>
          <button onClick={() => setBoardOpen(true)} className="min-w-0 truncate rounded-full bg-black/45 px-3 py-2 text-sm font-bold backdrop-blur hover:bg-black/60">
            👤 {p.name.trim() || "Đặt tên tài xế"} <span className="text-white/50">✎</span>
          </button>
          <span className="ml-auto" />
          <CoinPill coins={p.wallet.coins} />
          <button onClick={p.onMute} aria-label={p.muted ? "Bật âm thanh" : "Tắt âm thanh"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/45 backdrop-blur hover:bg-black/60">
            {p.muted ? "🔇" : "🔊"}
          </button>
        </div>
        <div className="pointer-events-auto mx-auto grid w-[min(96%,30rem)] grid-cols-4 gap-1.5 px-1" role="tablist" aria-label="Chế độ chơi">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              role="tab"
              aria-selected={p.mode === mode.id}
              onClick={() => p.onMode(mode.id)}
              className={`flex min-w-0 flex-col items-center rounded-2xl px-1 pb-1.5 pt-1 text-center transition active:translate-y-[2px] ${
                p.mode === mode.id ? "border-b-4 border-amber-600 bg-amber-400 text-emerald-950 shadow-lg" : "border-b-4 border-black/30 bg-black/45 text-white backdrop-blur hover:bg-black/60"
              }`}
            >
              <span className="text-xl leading-tight">{mode.icon}</span>
              <span className="text-[11px] font-extrabold leading-tight sm:text-xs">{mode.label}</span>
              <span className={`hidden text-[10px] leading-tight sm:block ${p.mode === mode.id ? "text-emerald-950/70" : "text-white/55"}`}>{mode.detail}</span>
            </button>
          ))}
        </div>
        {daily && (
          <p className="mt-1.5 text-center text-xs font-semibold text-white drop-shadow">
            Cả trang chạy chung một đường · đổi đường sau <span className="font-mono tabular-nums">{countdown}</span>
          </p>
        )}
        {(p.mode === "record" || daily) && <button
          onClick={() => setBoardOpen(true)}
          className="pointer-events-auto absolute bottom-3 left-3 rounded-2xl bg-black/50 px-3.5 py-2 text-left backdrop-blur transition hover:bg-black/65"
        >
          <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-200">🚩 {daily ? "Hôm nay" : "Kỷ lục"} · {HILL_MAPS[p.map].name}</span>
          <span className="block font-draw-display text-2xl font-extrabold leading-tight">{p.best ? `${formatNumber(p.best)} m` : "Chưa có"}</span>
          <span className="block text-[11px] text-white/70">{rank ? `Hạng #${rank} · ` : ""}Xem bảng xếp hạng ›</span>
        </button>}
      </div>

      {/* The panel: pick a car or a road, then go. */}
      <section className="pointer-events-auto flex max-h-[64%] flex-col rounded-t-[28px] border-t border-white/15 bg-emerald-950/95 shadow-[0_-12px_40px_rgba(0,0,0,0.35)] backdrop-blur landscape:max-h-none landscape:w-[min(46%,26rem)] landscape:rounded-l-[28px] landscape:rounded-tr-none landscape:border-l landscape:border-t-0">
        {p.mode === "friends" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
            <h2 className="font-draw-display text-2xl font-extrabold leading-none">👥 Đua cùng bạn bè</h2>
            <p className="mb-3 mt-1 text-xs text-emerald-100/65">Xuất phát chồng tháp, xe va chạm thật. Chọn xe trong phòng: được đi cả 4 xe.</p>
            <HillFriendsPanel name={p.name} onName={p.onName} />
          </div>
        ) : (
          <>
            <div className="px-4 pt-3">
              <Segmented
                label="Chọn"
                value={shownTab}
                onChange={setTab}
                options={[
                  { value: "vehicle", label: "🚙 Xe" },
                  { value: "map", label: "🗺️ Đường" },
                  ...(racing ? [{ value: "rivals" as const, label: "🤖 Đối thủ" }] : []),
                ]}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {shownTab === "vehicle" && (
                <>
                  <div className="flex items-end justify-between gap-2">
                    <h2 className="font-draw-display text-2xl font-extrabold leading-none">{car.name}</h2>
                    <span className="truncate text-xs font-semibold text-amber-200">{info.tagline}</span>
                  </div>
                  <StatBars vehicle={p.vehicle} className="mt-3" />
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-bold text-emerald-100/70">Hợp nhất:</span>
                    {info.bestOn.length ? (
                      info.bestOn.map((id) => (
                        <button
                          key={id}
                          onClick={() => p.onMap(id)}
                          className={`rounded-full px-2 py-0.5 font-bold transition ${id === p.map ? "bg-amber-300 text-emerald-950" : "bg-white/10 hover:bg-white/20"}`}
                        >
                          {HILL_MAPS[id].icon} {HILL_MAPS[id].name}
                        </button>
                      ))
                    ) : (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 font-bold">🗺️ Mọi đường</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-snug text-emerald-100/70">💡 {info.tip}</p>
                  <div className="mt-3">
                    <VehiclePicker value={p.vehicle} onChange={p.onVehicle} isLocked={isLocked} />
                  </div>
                  {racing && <p className="mt-1 text-[11px] text-emerald-100/55">Đua với bot được đi cả 4 xe, chưa mở khoá cũng được.</p>}
                </>
              )}
              {shownTab === "map" && (
                <MapPicker
                  value={racing && p.botSetup.randomMap ? "random" : p.map}
                  onChange={(map) => {
                    if (map === "random") p.onBotSetup({ randomMap: true });
                    else {
                      p.onMap(map);
                      if (racing) p.onBotSetup({ randomMap: false });
                    }
                  }}
                  bests={racing ? undefined : p.bests}
                  random={racing}
                />
              )}
              {shownTab === "rivals" && (
                <div className="space-y-3">
                  <Field label="Số bot">
                    <Segmented label="Số bot" value={p.botSetup.bots} onChange={(bots) => p.onBotSetup({ bots })} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
                  </Field>
                  <Field label="Độ khó">
                    <Segmented label="Độ khó" value={p.botSetup.level} onChange={(level) => p.onBotSetup({ level })} options={BOT_LEVELS} />
                  </Field>
                  <Field label="Thể thức">
                    <Segmented
                      label="Thể thức"
                      value={p.botSetup.mode}
                      onChange={(mode) => p.onBotSetup({ mode })}
                      options={[
                        { value: "race", label: "🏁 Về đích" },
                        { value: "distance", label: "⛽ Đi xa nhất" },
                      ]}
                    />
                  </Field>
                  {p.botSetup.mode === "race" && (
                    <Field label="Độ dài">
                      <Segmented
                        label="Độ dài"
                        value={p.botSetup.length}
                        onChange={(length) => p.onBotSetup({ length })}
                        options={[
                          { value: 600, label: "600 m" },
                          { value: 1200, label: "1.200 m" },
                          { value: 2000, label: "2.000 m" },
                        ]}
                      />
                    </Field>
                  )}
                  <Field label="Va chạm">
                    <Segmented
                      label="Va chạm"
                      value={p.botSetup.collisions ? "solid" : "ghost"}
                      onChange={(value) => p.onBotSetup({ collisions: value === "solid" })}
                      options={[
                        { value: "solid", label: "💥 Xe đặc" },
                        { value: "ghost", label: "👻 Xe ma" },
                      ]}
                    />
                  </Field>
                  <p className="text-[11px] leading-snug text-emerald-100/55">Bot lái bằng đúng luật vật lý như bạn: biết nhảy qua xe chắn đường, bật lật khi chổng vó. Bot Khó còn rình giẫm đầu bạn.</p>
                </div>
              )}
            </div>
            <div className="border-t border-white/10 px-4 pt-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
              {racing ? (
                <GameButton onClick={p.onStartBots} className="w-full py-2.5 text-2xl tracking-wide">
                  ĐUA ▶
                  <span className="block font-draw-body text-xs font-bold opacity-75">
                    {p.botSetup.bots} bot {BOT_LEVELS.find((level) => level.value === p.botSetup.level)?.label.split(" ")[1]} · {p.botSetup.randomMap ? "🎲 đường ngẫu nhiên" : HILL_MAPS[p.map].name} ·{" "}
                    {p.botSetup.mode === "race" ? `${formatNumber(p.botSetup.length)} m` : "đi xa nhất"}
                  </span>
                </GameButton>
              ) : locked ? (
                <GameButton onClick={() => p.onBuy(p.vehicle)} disabled={p.busy || missing > 0} className="w-full py-2.5 text-lg">
                  🔓 Mở khoá · {formatNumber(car.price)} xu
                  <span className="block font-draw-body text-xs font-bold opacity-80">{missing > 0 ? `Còn thiếu ${formatNumber(missing)} xu — chạy thêm để kiếm` : "Mở rồi lái luôn"}</span>
                </GameButton>
              ) : (
                <GameButton onClick={p.onStart} className="w-full py-2.5 text-2xl tracking-wide">
                  CHẠY ▶
                  <span className="block font-draw-body text-xs font-bold opacity-75">
                    {car.name} · {HILL_MAPS[p.map].name}
                    {daily ? " · đường hôm nay" : ""}
                  </span>
                </GameButton>
              )}
            </div>
          </>
        )}
      </section>

      {boardOpen && (
        <Sheet title={daily ? "🗓️ Đường hôm nay" : `🏆 Kỷ lục · ${HILL_MAPS[p.map].name}`} onClose={() => setBoardOpen(false)}>
          <label className="block text-xs font-bold uppercase tracking-wider text-emerald-100/70">
            Tên trên bảng xếp hạng
            <input
              value={p.name}
              maxLength={24}
              onChange={(event) => p.onName(event.target.value)}
              placeholder="Tên của bạn"
              className="mt-1.5 block w-full rounded-xl border-2 border-white/15 bg-white/10 px-3 py-2.5 text-base font-semibold normal-case tracking-normal text-white outline-none focus:border-amber-300"
            />
          </label>
          <BoardList board={p.board} />
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-emerald-100/70">
            <span className="min-w-0">{p.saveStatus}</span>
            <button onClick={p.onSync} disabled={p.busy} className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 font-bold text-white hover:bg-white/20 disabled:opacity-50">
              {p.busy ? "Đang đồng bộ…" : "↻ Đồng bộ"}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function BoardList({ board }: { board: HillBoard | null }) {
  if (!board) return <p className="mt-4 rounded-2xl bg-white/5 p-4 text-center text-sm text-emerald-100/70">Đang tải bảng xếp hạng…</p>;
  if (board.leaders.length === 0) return <p className="mt-4 rounded-2xl bg-white/5 p-4 text-center text-sm text-emerald-100/70">Chưa ai chạy đường này. Cắm lá cờ đầu tiên nhé! 🚩</p>;
  const personal = board.personal;
  const listed = personal && board.leaders.some((entry) => entry.playerId === personal.playerId);
  return (
    <ol className="mt-4 space-y-1.5">
      {board.leaders.map((entry) => (
        <li
          key={entry.playerId}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 ${entry.playerId === personal?.playerId ? "bg-amber-300/20 ring-1 ring-amber-300/60" : "bg-white/5"}`}
        >
          <span className="w-7 text-center font-draw-display text-lg font-extrabold">{MEDALS[entry.rank - 1] ?? entry.rank}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{entry.name}</span>
          <span className="font-draw-display font-extrabold tabular-nums text-amber-200">{formatNumber(entry.distance)} m</span>
        </li>
      ))}
      {personal && !listed && (
        <li className="flex items-center gap-3 rounded-xl bg-amber-300/20 px-3 py-2 ring-1 ring-amber-300/60">
          <span className="w-7 text-center font-draw-display font-extrabold">#{personal.rank}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{personal.name} (bạn)</span>
          <span className="font-draw-display font-extrabold tabular-nums text-amber-200">{formatNumber(personal.distance)} m</span>
        </li>
      )}
    </ol>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-100/60">{label}</p>
      {children}
    </div>
  );
}
