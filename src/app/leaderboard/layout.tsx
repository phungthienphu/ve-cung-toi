import { GAMES_SEO, seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata(GAMES_SEO.leaderboard);

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
