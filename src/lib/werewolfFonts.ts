import { Playfair_Display, Manrope } from "next/font/google";

// Scoped to the werewolf game only (applied via werewolfFontClass on the
// root wrapper) — a dramatic high-contrast serif for headers ("ma mị",
// gothic-folklore feel fitting a village mystery game) paired with a clean
// modern sans for the actual reading (chat, instructions). Cinzel was the
// first pick but doesn't ship Vietnamese diacritics — this one does.
const displayFont = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-ww-display",
});

const bodyFont = Manrope({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-ww-body",
});

export const werewolfFontClass = `${displayFont.variable} ${bodyFont.variable} font-ww-body`;
