import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", ".next-*/**", ".open-next/**",
      ".wrangler/**", "out/**", "build/**", "next-env.d.ts", "party/**", "scripts/**", "shared/**"],
  },
];

export default eslintConfig;
