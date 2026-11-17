import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Serve original assets during the fallback deployment (no Images subscription).
  images: { unoptimized: process.env.CLOUDFLARE_WEB === 'true' },
  // Keep isolated review/build output away from a running local dev server.
  distDir: process.env.NEXT_BUILD_DIR || ".next",
};

export default nextConfig;
