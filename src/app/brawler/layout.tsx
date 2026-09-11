import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ve-cung-toi.vercel.app";
const title = "Đại Chiến Tí Hon";
const description = "Game đối kháng nhiều người chơi — Vẽ Cùng Tôi";

// Overrides the root layout's OG/Twitter metadata (which advertises the
// drawing game) for every route under /brawler — see tank-game/layout.tsx's
// doc for why this restates the full openGraph/twitter object rather than
// only the image.
export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: `${siteUrl}/brawler`,
    siteName: title,
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function BrawlerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
