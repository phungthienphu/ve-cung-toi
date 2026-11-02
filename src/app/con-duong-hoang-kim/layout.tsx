import { GAMES_SEO, seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata(GAMES_SEO.hill);

export default function HillLayout({ children }: { children: React.ReactNode }) {
  return children;
}
