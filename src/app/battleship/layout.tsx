import { GAMES_SEO, seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata(GAMES_SEO.battleship);

export default function BattleshipLayout({ children }: { children: React.ReactNode }) {
  return children;
}
