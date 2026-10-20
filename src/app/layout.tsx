import type { Metadata } from "next";
import "./globals.css";
import SoundToggle from "@/components/SoundToggle";
import CelebrationBanner from "@/components/CelebrationBanner";
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
        {/* Keep Monetag's loader in the server-rendered head. Their verifier
            may look for the installation snippet, not only the resulting
            dynamically-created script element. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(s){s.dataset.zone='11920062';s.src='https://nap5k.com/tag.min.js'})([document.documentElement,document.body].filter(Boolean).pop().appendChild(document.createElement('script')))",
          }}
        />
      </head>
      <body className="min-h-app text-slate-900 antialiased">
        {children}
        <SoundToggle />
        {/* Occasion greeting: change the text and storageKey for the next holiday. */}
        <CelebrationBanner
          storageKey="celebration-2026-10-20"
          emoji="💐"
          title="Chúc mừng ngày Phụ nữ Việt Nam 20/10"
          description="Chúc các bạn nữ, các cô, các mẹ luôn xinh đẹp, rạng rỡ và được yêu thương thật nhiều. Hôm nay vào chơi thật vui nhé!"
          from="2026-10-19"
          until="2026-10-21"
        />
      </body>
    </html>
  );
}
