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
      </body>
    </html>
  );
}
