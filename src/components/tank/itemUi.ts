// One entry per pickup kind so the lobby's "item guide" (TankGameRoom.tsx)
// and the in-match item bar can both describe a pickup from the same place
// instead of each hand-rolling their own icon/label — same idea as
// ultimateUi.ts's ULTIMATE_UI table.

import type { ItemKind } from "@shared/tankTypes";

export interface ItemUi {
  icon: string;
  label: string;
  description: string;
}

export const ITEM_UI: Record<ItemKind, ItemUi> = {
  health: { icon: "❤️", label: "Bình máu", description: "Đi qua là hồi máu ngay, không cần bấm dùng." },
  trap: { icon: "🪤", label: "Bẫy", description: "Nhặt rồi đặt xuống đất — nổ khi kẻ địch giẫm phải." },
  blind: { icon: "😵", label: "Đạn gây mù", description: "Bắn trúng sẽ che khuất tầm nhìn của đối thủ một lúc." },
  fire: { icon: "🔥", label: "Đạn lửa", description: "Bắn trúng sẽ đốt cháy, gây sát thương theo thời gian." },
  emp: { icon: "⚡", label: "Đạn tê liệt", description: "Bắn trúng sẽ khiến đối thủ bị tịt nòng (không bắn được) trong 3 giây." },
  shield: { icon: "🛡️", label: "Khiên", description: "Dựng khiên đứng yên, chặn vài phát đạn — chỉ rớt ra khi giết quái, không xuất hiện tự nhiên trên map." },
};
