import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ve-cung-toi.vercel.app";
const title = "Đại Chiến Xe Tăng";
const description = "Game bắn tank nhiều người chơi — Vẽ Cùng Tôi";

// Overrides the root layout's OG/Twitter metadata (which advertises the
// drawing game) for every route under /tank-game — Next.js replaces a
// parent's `openGraph`/`twitter` object wholesale when a nested layout
// defines its own, rather than deep-merging individual fields, so this
// needs to restate the full object rather than just the image.
export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: `${siteUrl}/tank-game`,
    siteName: title,
    images: [{ url: "/tank/tank-bg.png", width: 1672, height: 941, alt: title }],
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/tank/tank-bg.png"],
  },
};

export default function TankGameLayout({ children }: { children: React.ReactNode }) {
  return children;
}
