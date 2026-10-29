import { GAMES_SEO, seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata(GAMES_SEO.cards);

export default function CardDrawLayout({ children }: { children: React.ReactNode }) {
  return children;
}
