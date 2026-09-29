import { GAMES_SEO, seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata(GAMES_SEO.werewolf);

export default function WerewolfLayout({ children }: { children: React.ReactNode }) {
  return children;
}
