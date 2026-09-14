import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ve-cung-toi.vercel.app";
const title = "Đại Chiến Bóng Đá";
const description = "Game đá bóng nhiều người chơi — Vẽ Cùng Tôi";

// Same reasoning as tank-game/layout.tsx: restate the full openGraph/twitter
// object rather than just overriding one field, since Next.js replaces a
// parent's object wholesale instead of deep-merging.
export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: `${siteUrl}/soccer`,
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

export default function SoccerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
