import type { Metadata } from "next";
import Script from "next/script";
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
        {/* Monetag tag — same as their snippet (a script with data-zone), loaded
            after the page is interactive so it never delays a game. */}
        <Script src="https://nap5k.com/tag.min.js" data-zone="11920062" strategy="afterInteractive" />
      </body>
    </html>
  );
}
