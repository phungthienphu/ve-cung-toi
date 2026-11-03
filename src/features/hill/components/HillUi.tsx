"use client";

import { useEffect, useRef } from "react";
import { HILL_MAPS, HILL_VEHICLES, type HillMapId, type HillVehicleId } from "@shared/hill/types";
import { MapArt, VehicleArt } from "./HillArt";
import { MAP_INFO, VEHICLE_INFO, VEHICLE_STATS, formatNumber } from "./hillUiData";

// The game-menu building blocks shared by the solo garage and the race
// lobby: chunky buttons, segmented choices, the vehicle carousel with stat
// bars, and the map postcards. Phone first: big targets, horizontal swipes.

const VEHICLE_IDS: HillVehicleId[] = ["jeep", "beetle", "bus", "monster"];
const MAP_IDS = Object.keys(HILL_MAPS) as HillMapId[];

type Tone = "gold" | "glass" | "cyan";
const TONES: Record<Tone, string> = {
  gold: "border-amber-600 bg-amber-400 text-emerald-950 shadow-lg shadow-amber-900/30 hover:bg-amber-300",
  glass: "border-black/30 bg-white/10 text-white hover:bg-white/20",
  cyan: "border-cyan-800 bg-cyan-400 text-cyan-950 shadow-lg shadow-cyan-900/30 hover:bg-cyan-300",
};

/** A thick, pressable game button: it sinks into its own shadow when pressed. */
export function GameButton({
  tone = "gold",
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      {...props}
      className={`hk-button rounded-2xl border-b-[5px] font-draw-display font-extrabold transition active:translate-y-[3px] active:border-b-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0 disabled:active:border-b-[5px] ${TONES[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function CoinPill({ coins, className = "" }: { coins: number; className?: string }) {
  return (
    <span className={`hk-coins inline-flex items-center gap-1.5 rounded-full bg-black/45 py-1 pl-1 pr-3 font-draw-display text-base font-extrabold text-amber-200 backdrop-blur ${className}`}>
      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-amber-600 bg-amber-300 text-xs text-amber-800">₫</span>
      {formatNumber(coins)}
    </span>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="hk-segmented flex gap-1 rounded-2xl bg-black/30 p-1">
      {options.map((option) => (
        <button
          key={String(option.value)}
          role="radio"
          aria-checked={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`min-w-0 flex-1 rounded-xl px-2 py-2 text-sm font-bold transition disabled:cursor-not-allowed ${
            option.value === value ? "bg-amber-400 text-emerald-950 shadow" : "text-emerald-50/75 enabled:hover:bg-white/10"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Five-segment bars, like a kart game's stat card. */
export function StatBars({ vehicle, className = "" }: { vehicle: HillVehicleId; className?: string }) {
  const stats = VEHICLE_INFO[vehicle].stats;
  return (
    <dl className={`hk-stats grid grid-cols-2 gap-x-4 gap-y-1.5 ${className}`}>
      {VEHICLE_STATS.map((stat) => (
        <div key={stat.key} className="min-w-0">
          <dt className="truncate text-[11px] font-bold uppercase tracking-wide text-emerald-100/70">{stat.label}</dt>
          <dd className="mt-0.5 flex gap-0.5" aria-label={`${stat.label}: ${stats[stat.key]}/5`}>
            {[1, 2, 3, 4, 5].map((step) => (
              <span key={step} className={`h-2 flex-1 rounded-sm transition-colors duration-300 ${step <= stats[stat.key] ? "bg-amber-300" : "bg-white/15"}`} />
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Swipeable row of vehicle cards; the chosen one scrolls into view. */
export function VehiclePicker({
  value,
  onChange,
  isLocked = () => false,
  only,
  disabled,
}: {
  value: HillVehicleId;
  onChange: (vehicle: HillVehicleId) => void;
  isLocked?: (vehicle: HillVehicleId) => boolean;
  /** The room forces one vehicle: show just that one. */
  only?: HillVehicleId;
  disabled?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Only the row scrolls (scrollIntoView could also scroll the page).
    const box = row.current;
    const card = box?.querySelector<HTMLElement>(`[data-vehicle="${value}"]`);
    if (box && card) box.scrollTo({ left: card.offsetLeft - (box.clientWidth - card.clientWidth) / 2, behavior: "smooth" });
  }, [value]);
  return (
    <div ref={row} className="hk-vehicle-list relative -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {(only ? [only] : VEHICLE_IDS).map((id) => {
        const locked = isLocked(id);
        const active = id === value;
        return (
          <button
            key={id}
            data-vehicle={id}
            onClick={() => onChange(id)}
            disabled={disabled}
            aria-pressed={active}
            className={`relative flex w-[7.25rem] shrink-0 snap-center flex-col items-center rounded-2xl border-2 px-1.5 pb-2 pt-1.5 transition disabled:cursor-not-allowed ${
              active ? "border-amber-300 bg-amber-300/15 shadow-[0_0_0_3px_rgba(252,211,77,0.18)]" : "border-white/10 bg-white/[0.06] enabled:hover:border-white/30"
            }`}
          >
            <VehicleArt vehicle={id} width={100} height={52} locked={locked} />
            <span className="mt-1 w-full truncate text-center text-sm font-bold">{HILL_VEHICLES[id].name}</span>
            {locked ? (
              <span className="mt-0.5 rounded-full bg-black/40 px-2 text-[11px] font-bold text-amber-200">🔒 {formatNumber(HILL_VEHICLES[id].price)} xu</span>
            ) : (
              <span className={`mt-0.5 text-[11px] font-semibold ${active ? "text-amber-200" : "text-emerald-100/50"}`}>{active ? "✓ Đang chọn" : VEHICLE_INFO[id].tagline.split(",")[0]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Map postcards. `bests`: your record on each, shown as a flag. */
export function MapPicker({
  value,
  onChange,
  bests,
  random = false,
  disabled,
}: {
  value: HillMapId | "random";
  onChange: (map: HillMapId | "random") => void;
  bests?: Partial<Record<HillMapId, number>>;
  random?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="hk-map-list grid grid-cols-2 gap-2">
      {MAP_IDS.map((id) => {
        const active = id === value;
        const info = MAP_INFO[id];
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            disabled={disabled}
            aria-pressed={active}
            className={`group relative overflow-hidden rounded-2xl border-2 text-left transition disabled:cursor-not-allowed ${
              active ? "border-amber-300 shadow-[0_0_0_3px_rgba(252,211,77,0.18)]" : "border-white/10 enabled:hover:border-white/30"
            }`}
          >
            <MapArt map={id} width={180} height={84} className="block h-[84px] w-full object-cover" />
            {bests?.[id] ? (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">🚩 {formatNumber(bests[id]!)} m</span>
            ) : null}
            {active && <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-300 text-sm font-black text-emerald-950">✓</span>}
            <span className="block bg-emerald-950/90 px-2.5 py-2">
              <span className="flex items-center justify-between gap-1">
                <span className="truncate text-sm font-bold">{HILL_MAPS[id].icon} {HILL_MAPS[id].name}</span>
                <span className="shrink-0 text-[10px] tracking-tighter text-amber-300" aria-label={`Độ khó ${info.difficulty}/3`}>
                  {"●".repeat(info.difficulty)}
                  <span className="text-white/20">{"●".repeat(3 - info.difficulty)}</span>
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-emerald-100/65">{info.traits.join(" · ")}</span>
            </span>
          </button>
        );
      })}
      {random && (
        <button
          onClick={() => onChange("random")}
          disabled={disabled}
          aria-pressed={value === "random"}
          className={`col-span-2 rounded-2xl border-2 px-3 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed ${
            value === "random" ? "border-amber-300 bg-amber-300/15" : "border-dashed border-white/20 enabled:hover:border-white/40"
          }`}
        >
          🎲 Ngẫu nhiên mỗi ván
        </button>
      )}
    </div>
  );
}

/** A bottom sheet on phones, a centred card on wider screens. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl border border-white/15 bg-emerald-950 text-white shadow-2xl sm:rounded-3xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <h2 className="font-draw-display text-xl font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg hover:bg-white/20">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
