import { Baloo_2, Manrope } from "next/font/google";

// Scoped to the draw-guess game only (applied via drawFontClass on each
// screen's root element) — the other games keep the root layout's default
// system font, so this never affects tank/soccer/brawler.
const displayFont = Baloo_2({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  variable: "--font-draw-display",
});

const bodyFont = Manrope({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-draw-body",
});

export const drawFontClass = `${displayFont.variable} ${bodyFont.variable} font-draw-body`;
