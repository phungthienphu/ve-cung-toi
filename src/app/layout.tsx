import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vẽ Cùng Tôi",
  description: "Game vẽ - đoán chữ nhiều người chơi, kiểu Skribbl.io",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen text-slate-900 antialiased">{children}</body>
    </html>
  );
}
