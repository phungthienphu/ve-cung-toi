import { GameGate } from '@/features/community/GameGate';
import { GAMES_SEO, seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata(GAMES_SEO.werewolf);

export default function WerewolfLayout({ children }: { children: React.ReactNode }) {
  return <GameGate id="werewolf">{children}</GameGate>;
}
