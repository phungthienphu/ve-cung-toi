import type { Metadata } from "next";
import "./globals.css";
import SoundToggle from "@/components/SoundToggle";
import { GAMES_SEO, SITE_NAME, SITE_URL, seoMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...seoMetadata(GAMES_SEO.home),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-app text-slate-900 antialiased">
        {children}
        <SoundToggle />
      </body>
    </html>
  );
}
