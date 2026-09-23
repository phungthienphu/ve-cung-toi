import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f5ff",
          100: "#e6ebff",
          200: "#c3ceff",
          300: "#9fb0ff",
          400: "#5b78ff",
          500: "#3854ff",
          600: "#2a3fd6",
          700: "#212fa8",
          800: "#1a257f",
          900: "#141c5c",
        },
        // Sampled from the hero illustration (chalkboard/pig artwork) so the
        // landing/join screens feel like one piece with it, instead of a
        // cold blue SaaS panel bolted onto a warm hand-drawn scene.
        cream: {
          50: "#fbf6ec",
          100: "#f5ead2",
          200: "#ecdcb8",
        },
        clay: {
          500: "#c1613f",
          600: "#a84f31",
          700: "#8c4028",
        },
        ink: "#3e2f22",
        // Draw-guess only: "correct guess" / success accent (sage) and
        // countdown-urgency accent (gold) — the warm home/lobby screens
        // never needed either until the in-game screen's redesign unified
        // onto this same clay/cream palette instead of the old cold blue.
        sage: {
          100: "#e3ecdc",
          500: "#5f7a52",
          600: "#4c6341",
        },
        gold: {
          100: "#f6e6c4",
          500: "#c98a2c",
          600: "#a86f1e",
        },
      },
      fontFamily: {
        "draw-display": ["var(--font-draw-display)", "ui-rounded", "system-ui", "sans-serif"],
        "draw-body": ["var(--font-draw-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        "ww-display": ["var(--font-ww-display)", "Georgia", "serif"],
        "ww-body": ["var(--font-ww-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
