// One entry per skin so the ultimate's icon/tooltip/color stays a single
// table edit away instead of a growing pile of `isBlue`/`isDark`-style
// booleans scattered across every screen that needs to describe it — the
// in-game "R" button (TankGameRoom.tsx) and the tank-select screen
// (tank-game/[roomId]/page.tsx) both read from this one table.

import type { TankSkin } from "@shared/tankTypes";

export interface UltimateUi {
  icon: string;
  label: string;
  activeClasses: string;
  barClass: string;
}

export const ULTIMATE_UI: Record<TankSkin, UltimateUi> = {
  blue: {
    icon: "🔥",
    label: "Xả đạn liên hoàn (R) — bắn nhanh trong 2s",
    activeClasses: "border-cyan-400 bg-cyan-50 text-cyan-700 hover:bg-cyan-100",
    barClass: "bg-cyan-500",
  },
  dark: {
    icon: "🎯",
    label: "Bắn tỉa (R để bật ngắm, bắn 1 viên đạn sát thương lên kẻ địch ... hoặc đồng đội)",
    activeClasses: "border-red-400 bg-red-50 text-red-700 hover:bg-red-100",
    barClass: "bg-red-500",
  },
  green: {
    icon: "✳️",
    label: "Vòng đạn tỏa (R) — bắn 3 đợt đạn tỏa tròn quanh xe gây sát thương diện rộng.",
    activeClasses: "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    barClass: "bg-emerald-500",
  },
  red: {
    icon: "💣",
    label: "Ném bom (R để ngắm điểm bằng chuột trên bản đồ) — rải nhiều đợt mìn xuống vị trí được chọn, gây sát thương diện rộng",
    activeClasses: "border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100",
    barClass: "bg-orange-500",
  },
  sand: {
    icon: "🌪️",
    label: "Sóng cát (R) — đẩy lùi + choáng 1s kẻ địch phía trước",
    activeClasses: "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100",
    barClass: "bg-amber-500",
  },
  bigRed: {
    icon: "🪝",
    label: "Móc câu (R) — kéo địch gần nhất trên đường ngắm lại gần gây choáng",
    activeClasses: "border-rose-400 bg-rose-50 text-rose-700 hover:bg-rose-100",
    barClass: "bg-rose-500",
  },
  darkLarge: {
    icon: "🛡️",
    label: "Khiên chắn di động (R) — miễn sát thương cho bản thân và đồng đội gần trong 8s",
    activeClasses: "border-violet-400 bg-violet-50 text-violet-700 hover:bg-violet-100",
    barClass: "bg-violet-500",
  },
  huge: {
    icon: "🚀",
    label: "Lao thẳng (R) — lao nhanh xuyên qua tank khác theo hướng ngắm, hất văng ai ở gần",
    activeClasses: "border-stone-400 bg-stone-50 text-stone-700 hover:bg-stone-100",
    barClass: "bg-stone-500",
  },
};
