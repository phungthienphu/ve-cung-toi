import { GAMES_SEO, seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata(GAMES_SEO.draw);

export default function DrawGuessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
