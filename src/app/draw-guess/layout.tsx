import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ve-cung-toi.vercel.app";
const title = "Vẽ Cùng Tôi";
const description = "Game vẽ - đoán chữ nhiều người chơi";

// Overrides the root layout's (now generic, game-picker) OG/Twitter metadata
// for every route under /draw-guess — this is the metadata the root page
// itself used to carry back when it was the drawing game's home. See
// tank-game/layout.tsx's doc for why this restates the full object rather
// than only the image.
export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: `${siteUrl}/draw-guess`,
    siteName: title,
    images: [{ url: "/OG.png", width: 1024, height: 1536, alt: title }],
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/OG.png"],
  },
};

export default function DrawGuessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
