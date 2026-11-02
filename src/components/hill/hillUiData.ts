import type { HillMapId, HillVehicleId } from "@shared/hillTypes";

// What the menus say about each vehicle and map. The 1–5 ratings follow the
// tuned physics in HILL_VEHICLES (see the figures there): each car is best at
// one thing, and none is best at everything. Change both together.

export const VEHICLE_STATS = [
  { key: "speed", label: "Tốc độ" },
  { key: "climb", label: "Leo dốc" },
  { key: "stable", label: "Khó lật" },
  { key: "fuel", label: "Tiết kiệm xăng" },
  { key: "power", label: "Húc mạnh" },
] as const;
export type VehicleStatKey = (typeof VEHICLE_STATS)[number]["key"];

export const VEHICLE_INFO: Record<HillVehicleId, { stats: Record<VehicleStatKey, number>; tagline: string; tip: string; bestOn: HillMapId[] }> = {
  jeep: { stats: { speed: 3, climb: 3, stable: 3, fuel: 3, power: 3 }, tagline: "Toàn diện, không điểm yếu", tip: "Đường nào cũng đi được. Hợp để tập lái và cắm lá cờ kỷ lục đầu tiên.", bestOn: [] },
  beetle: { stats: { speed: 5, climb: 2, stable: 1, fuel: 5, power: 1 }, tagline: "Nhanh nhất, tiết kiệm xăng nhất", tip: "Vua đường thoải: mỗi can xăng đi xa nhất. Leo dốc gắt yếu và dễ lật, nhấn phanh khi sắp đáp.", bestOn: ["tea", "moon"] },
  monster: { stats: { speed: 2, climb: 5, stable: 4, fuel: 1, power: 4 }, tagline: "Vua leo dốc, bánh vượt đá", tip: "Dốc dựng và bậc đá không làm khó được nó. Ăn xăng như uống nước: đừng bỏ can xăng nào.", bestOn: ["mountain"] },
  bus: { stats: { speed: 2, climb: 2, stable: 5, fuel: 3, power: 5 }, tagline: "Khó lật nhất, ủi văng xe khác", tip: "Đáp đất lệch vẫn đứng vững, hợp đường nhiều ụ. Khi đua, húc nhẹ cũng làm đối thủ bay.", bestOn: ["sand"] },
};

export const MAP_INFO: Record<HillMapId, { difficulty: 1 | 2 | 3; traits: string[] }> = {
  tea: { difficulty: 1, traits: ["🌱 Hợp người mới"] },
  sand: { difficulty: 2, traits: ["🧈 Trơn trượt", "⛽ Hao xăng"] },
  mountain: { difficulty: 3, traits: ["⛰️ Dốc gắt", "🪨 Bậc đá"] },
  moon: { difficulty: 2, traits: ["🪶 Trọng lực thấp", "🚀 Bay rất xa"] },
};

/** "1200" → "1.200": Vietnamese thousands. */
export const formatNumber = (value: number) => Math.floor(value).toLocaleString("vi-VN");
