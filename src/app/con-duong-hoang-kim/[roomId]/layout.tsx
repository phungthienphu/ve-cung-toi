import type { Metadata } from "next";
import { GAMES_SEO, roomMetadata } from "@/lib/seo";

/** A shared race link previews as "Vào phòng ABC123 · Con Đường Hoàng Kim" with the cover art. */
export async function generateMetadata({ params }: { params: Promise<{ roomId: string }> }): Promise<Metadata> {
  const { roomId } = await params;
  return roomMetadata(GAMES_SEO.hill, roomId);
}

export default function HillRoomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
