import { GAMES_SEO, seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata(GAMES_SEO.soccer);

export default function SoccerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
