import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ve-cung-toi.vercel.app";
export const SITE_NAME = "Chơi Cùng Tôi";

export interface GameSeo {
  title: string;
  description: string;
  /** Route prefix, e.g. "/werewolf". */
  path: string;
  /** 1200×630 share image under /public. */
  image: string;
  /** Where rooms live, if not under `path` (the drawing game uses /room). */
  roomPath?: string;
}

export const GAMES_SEO = {
  home: { title: SITE_NAME, description: "Game nhiều người chơi ngay trên trình duyệt, không cần tài khoản: vẽ đoán chữ, Ma Sói, xe tăng, bóng đá, Hải Chiến.", path: "", image: "/og/home.jpg" },
  draw: { title: "Vẽ Cùng Tôi", description: "Vẽ và đoán chữ cùng hội bạn, không cần tài khoản.", path: "/draw-guess", image: "/og/draw.jpg", roomPath: "/room" },
  werewolf: { title: "Ma Sói", description: "Suy luận, giấu vai và bỏ phiếu. Ai là sói trong đêm nay?", path: "/werewolf", image: "/og/werewolf.jpg" },
  tank: { title: "Đại Chiến Xe Tăng", description: "Bắn xe tăng cùng hội bạn, tối đa 8 người.", path: "/tank-game", image: "/og/tank.jpg" },
  soccer: { title: "Sân Cỏ Đẫm Máu", description: "Đá bóng 2 đội, 1vs1 đến 4vs4, có bot lấp chỗ.", path: "/soccer", image: "/og/soccer.jpg" },
  battleship: { title: "Hải Chiến", description: "Giấu hạm đội, đoán tọa độ, nã pháo. Solo, Hỗn chiến hoặc Đồng đội.", path: "/battleship", image: "/og/battleship.jpg" },
  leaderboard: { title: "Lịch sử trận đấu", description: "Các trận gần nhất của mọi game trên Chơi Cùng Tôi.", path: "/leaderboard", image: "/og/home.jpg" },
} satisfies Record<string, GameSeo>;

/** Full metadata for a page. Next.js replaces a parent's `openGraph` /
 * `twitter` objects wholesale instead of merging, so every route restates
 * them — otherwise a nested page would lose the image or keep the wrong title. */
export function seoMetadata(game: GameSeo, overrides: { title?: string; description?: string; path?: string } = {}): Metadata {
  const title = overrides.title ?? game.title;
  const description = overrides.description ?? game.description;
  const url = `${SITE_URL}${overrides.path ?? game.path}`;
  const images = [{ url: game.image, width: 1200, height: 630, alt: game.title }];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: SITE_NAME, images, locale: "vi_VN", type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [game.image] },
  };
}

/** For invite links (/game/ROOMID): names the room so the preview reads as an invitation. */
export function roomMetadata(game: GameSeo, roomId: string): Metadata {
  const code = decodeURIComponent(roomId).toUpperCase();
  const title = `Vào phòng ${code} · ${game.title}`;
  const metadata = seoMetadata(game, {
    title,
    description: `Bạn được mời vào phòng ${code} chơi ${game.title}. Bấm để vào chơi cùng!`,
    path: `${game.roomPath ?? game.path}/${code}`,
  });
  // Same tab title everywhere, without the site-name suffix.
  return { ...metadata, title: { absolute: title } };
}
