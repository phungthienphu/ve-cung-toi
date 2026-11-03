import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import SoundToggle from "@/components/SoundToggle";
import CelebrationBanner from "@/features/draw/components/CelebrationBanner";
import { GAMES_SEO, SITE_NAME, SITE_URL, seoMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...seoMetadata(GAMES_SEO.home),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
};

/** Monetag ads — paused for now. Set back to true to bring them back. */
const ADS_ENABLED = false;

/**
 * Cloudflare Web Analytics for ve-cung-toi.vercel.app: page views and visits,
 * no cookies (so no consent banner). The site token is public — it ships in
 * the page anyway. NEXT_PUBLIC_CF_ANALYTICS_TOKEN overrides it (empty turns
 * tracking off). Production builds only, so local dev isn't counted.
 * `spa`: count client-side route changes as page views too.
 */
const CF_ANALYTICS_TOKEN =
  process.env.NODE_ENV === "production" ? (process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN ?? "f8df945b818b452abce98d044db19508") : "";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Monetag's tag stamps attributes (e.g. data-fp) on <html> before React
    // hydrates; that mismatch is expected and harmless.
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Keep Monetag's loader in the server-rendered head. Their verifier
            may look for the installation snippet, not only the resulting
            dynamically-created script element. */}
        {ADS_ENABLED && (
          <script
            dangerouslySetInnerHTML={{
              __html:
                "(function(s){s.dataset.zone='11920062';s.src='https://nap5k.com/tag.min.js'})([document.documentElement,document.body].filter(Boolean).pop().appendChild(document.createElement('script')))",
            }}
          />
        )}
      </head>
      <body className="min-h-app text-slate-900 antialiased">
        {children}
        {CF_ANALYTICS_TOKEN && (
          <Script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: CF_ANALYTICS_TOKEN, spa: true })}
            strategy="afterInteractive"
          />
        )}
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
