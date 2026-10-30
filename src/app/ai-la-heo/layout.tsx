import { GAMES_SEO, seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata(GAMES_SEO.oldmaid);

export default function OldMaidLayout({ children }: { children: React.ReactNode }) {
  return children;
}
