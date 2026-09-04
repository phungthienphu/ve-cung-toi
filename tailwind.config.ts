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
      },
    },
  },
  plugins: [],
};

export default config;
