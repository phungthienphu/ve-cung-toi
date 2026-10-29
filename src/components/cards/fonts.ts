import { Grenze_Gotisch } from "next/font/google";

// Blackletter for the fortune teller's voice and titles (one of the few
// gothic faces with Vietnamese glyphs). Used via the `.font-seance` class.
const seanceFont = Grenze_Gotisch({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "700", "800"],
  variable: "--font-seance",
});

export const seanceFontClass = seanceFont.variable;
