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
      },
    },
  },
  plugins: [],
};

export default config;
