import type { Metadata } from "next";
import HillGame from "@/components/hill/HillGame";

export const metadata: Metadata = {
  title: "Con Đường Hoàng Kim — Lái thử",
  description: "Lái Jeep qua đồi chè, nhặt xu và giữ bình xăng. Bản chơi một mình chạy ngay trên trình duyệt.",
};
export default function HillPage() { return <HillGame />; }
