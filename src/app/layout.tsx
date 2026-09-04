import type { Metadata } from "next";
import "./globals.css";
import SoundToggle from "@/components/SoundToggle";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ve-cung-toi.vercel.app";
const title = "Vẽ Cùng Tôi";
const description = "Game vẽ - đoán chữ nhiều người chơi";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    url: siteUrl,
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-dvh text-slate-900 antialiased">
        {children}
        <SoundToggle />
      </body>
    </html>
  );
}
