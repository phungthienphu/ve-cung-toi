import type { Metadata } from "next";

// The tutor's own class: lessons and progress stay out of search.
export const metadata: Metadata = {
  title: "Sổ tay Math Quest",
  description: "Sổ tay bài học theo chương — xem lại những bài đã học.",
  robots: { index: false, follow: false },
};

export default function MathQuestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
