import { GAMES_SEO, seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata(GAMES_SEO.hill, { title: "Đua cùng bạn bè · Con Đường Hoàng Kim", path: "/con-duong-hoang-kim/friends" });

export default function HillFriendsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
