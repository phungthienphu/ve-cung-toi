import type { Metadata } from "next";
import HillGame from "@/components/hill/HillGame";

export const metadata: Metadata = {
  title: "Con Đường Hoàng Kim — Đua xe địa hình",
  description: "Chọn xe, chinh phục bốn bản đồ và phá kỷ lục đường hôm nay.",
};
export default function HillPage() { return <HillGame />; }
