import type { Metadata } from "next";

// A classroom tool for the tutor's own students, so it stays out of search.
export const metadata: Metadata = {
  title: "Quái Máy Tính",
  description: "Đánh bại Quái Máy Tính bằng phép thuật tính nhẩm — trò mở màn của Math Quest.",
  robots: { index: false, follow: false },
};

export default function MathBossLayout({ children }: { children: React.ReactNode }) {
  return children;
}
