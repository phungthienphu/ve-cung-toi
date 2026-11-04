import { GameGate } from '@/features/community/GameGate';
import { GAMES_SEO, seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata(GAMES_SEO.tank);

export default function TankGameLayout({ children }: { children: React.ReactNode }) {
  return <GameGate id="tank">{children}</GameGate>;
}
