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
    // Monetag's tag stamps attributes (e.g. data-fp) on <html> before React
    // hydrates; that mismatch is expected and harmless.
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Monetag In-Page Push. A plain tag (not next/script) so it is in the
            server-rendered <head>, where Monetag's installation check reads
            it; next/script only leaves a preload there and injects the real
            tag later. async keeps it from blocking the page. */}
        <script src="https://nap5k.com/tag.min.js" data-zone="11920062" async />
      </head>
      <body className="min-h-app text-slate-900 antialiased">
        {children}
        <SoundToggle />
      </body>
    </html>
  );
}
