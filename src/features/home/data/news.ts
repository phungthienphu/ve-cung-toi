export interface HomeNews { id: string; publishedAt: string; game: string; title: string; href: string; image: string }
// Newest first, actual release dates from git history. Add releases here, never backdate IDs.
export const HOME_NEWS: HomeNews[] = [
  { id: 'layout-restored', publishedAt: '2026-11-03T13:25:34+07:00', game: 'Chơi Cùng Tôi', title: 'Khôi phục bố cục các game trên máy tính và điện thoại.', href: '/draw-guess', image: '/bg-ve-cung-toi.png' },
  { id: 'tank-bots-mobile', publishedAt: '2026-11-03T12:01:57+07:00', game: 'Xe Tăng', title: 'Có luyện tập offline, 5 bot và joystick di chuyển 8 hướng, ngắm bắn 360°.', href: '/tank-game', image: '/tank/tank-bg.png' },
  { id: 'hill-floating-islands', publishedAt: '2026-11-03T11:37:03+07:00', game: 'Hoàng Kim', title: 'Cầu trên không thành đảo cỏ lơ lửng, hết đảo là rơi tự do.', href: '/con-duong-hoang-kim', image: '/racing-with-me.png' },
  { id: 'hill-air-recovery', publishedAt: '2026-11-03T10:26:47+07:00', game: 'Hoàng Kim', title: 'Lật xe rồi xoay thẳng lại trên không sẽ thoát đếm ngược lật xe.', href: '/con-duong-hoang-kim', image: '/racing-with-me.png' },
  { id: 'hill-round-titles', publishedAt: '2026-11-03T09:20:39+07:00', game: 'Hoàng Kim', title: 'Danh hiệu cuối chặng được trao riêng cho từng tay đua.', href: '/con-duong-hoang-kim/friends', image: '/racing-with-me.png' },
  { id: 'hill-respawn-fuel', publishedAt: '2026-11-03T09:17:26+07:00', game: 'Hoàng Kim', title: 'Hết kẹt xe dưới đầu cầu, hồi sinh có thêm nhiên liệu để chạy tiếp.', href: '/con-duong-hoang-kim', image: '/racing-with-me.png' },
  { id: 'hill-race-audio', publishedAt: '2026-11-02T17:44:45+07:00', game: 'Hoàng Kim', title: 'Đường đua có nhạc nền, tiếng động cơ, tiếng phanh và tiếng té nước.', href: '/con-duong-hoang-kim', image: '/racing-with-me.png' },
  { id: 'hill-direction-dash', publishedAt: '2026-11-02T15:24:59+07:00', game: 'Hoàng Kim', title: 'Lao tới theo hướng đầu xe: lấy đà đúng lúc để vượt chướng ngại vật.', href: '/con-duong-hoang-kim', image: '/racing-with-me.png' },
];
export const NEWS_PAGE_SIZE = 5;
export function newsPage(cursor?: string | null) {
  const index = cursor ? HOME_NEWS.findIndex(item => item.id === cursor) : -1;
  if (cursor && index === -1) return null;
  const start = index + 1;
  const items = HOME_NEWS.slice(start, start + NEWS_PAGE_SIZE);
  return { items, nextCursor: start + items.length < HOME_NEWS.length ? items.at(-1)!.id : null };
}
export type NewsPage = NonNullable<ReturnType<typeof newsPage>>;
export function newsDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}
