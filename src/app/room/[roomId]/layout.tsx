import type { Metadata } from "next";
import { GAMES_SEO, roomMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ roomId: string }> }): Promise<Metadata> {
  const { roomId } = await params;
  return roomMetadata(GAMES_SEO.draw, roomId);
}

export default function DrawRoomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
