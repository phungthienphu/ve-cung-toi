import { GameGate } from '@/features/community/GameGate';
import { GAMES_SEO, seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata(GAMES_SEO.soccer);

export default function SoccerLayout({ children }: { children: React.ReactNode }) {
  return <GameGate id="soccer">{children}</GameGate>;
}
