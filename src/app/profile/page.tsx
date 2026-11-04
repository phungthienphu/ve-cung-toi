import Link from 'next/link';
import type { Metadata } from 'next';
import { auth, googleLoginEnabled } from '@/auth';
import { AccountMenu } from '@/features/account/components/AccountMenu';
import { getAccountProfile } from '@/features/account/server/profile';
import './profile.css';

export const metadata: Metadata = { title: 'Hồ sơ & thành tích', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
const number = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);

export default async function ProfilePage() {
  const session = googleLoginEnabled ? await auth() : null;
  if (!session?.user?.playerId) return <main className="player-profile"><div className="profile-shell"><Link href="/">← Trang chủ</Link><h1>Hồ sơ của bạn</h1><p>Đăng nhập để xem thành tích và giữ tiến độ giữa các máy.</p><AccountMenu /></div></main>;
  let profile;
  try { profile = await getAccountProfile(session.user.playerId); }
  catch { return <main className="player-profile"><div className="profile-shell"><Link href="/">← Trang chủ</Link><h1>Chưa tải được thành tích</h1><p>Tiến độ vẫn được giữ. Bạn thử tải lại trang sau nhé.</p><Link href="/profile">Thử lại</Link></div></main>; }
  return <main className="player-profile"><div className="profile-shell">
    <nav><Link href="/">← Trang chủ</Link><AccountMenu /></nav>
    <header className="profile-identity">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {session.user.image ? <img src={session.user.image} alt="" referrerPolicy="no-referrer" width={72} height={72} /> : <span className="profile-avatar">{(session.user.name || 'B')[0]}</span>}
      <div><p>GÓC CỦA BẠN</p><h1>{session.user.name || 'Người chơi'}</h1><span>Thành tích của bạn, qua từng cuộc chơi.</span></div>
    </header>
    <h2>Con Đường Hoàng Kim</h2>
    <section className="profile-hill" aria-label="Tiến độ đua xe">
      <div><strong>{number(profile.coins)}</strong><span>Xu đua xe</span></div>
      <div><strong>{number(profile.vehicles)}</strong><span>Xe đã mở</span></div>
      <div><strong>{number(profile.hill?.played ?? 0)}</strong><span>Lượt chạy đã lưu</span></div>
      <div><strong>{number(profile.hill?.best ?? 0)} m</strong><span>Xa nhất</span></div>
      <Link href="/con-duong-hoang-kim">Vào garage →</Link>
    </section>
    <h2>Những cuộc chơi khác</h2>
    <p className="profile-note">Thống kê riêng cho từng game. Xu và vật phẩm không dùng chung.</p>
    <section className="profile-games">{profile.games.map(game => <article key={game.id}>
      <h3>{game.name}</h3>
      {game.stats ? <><div className="profile-numbers"><div><strong>{number(game.stats.played)}</strong><span>Trận đã lưu</span></div><div><strong>{number(game.stats.wins)}</strong><span>Trận thắng</span></div><div><strong>{Math.round(game.stats.wins / game.stats.played * 100)}%</strong><span>Tỉ lệ thắng</span></div></div><p>Lần gần nhất: {new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(game.stats.lastPlayed)}</p></> : <p>Chưa có trận được ghi nhận. Thành tích sẽ xuất hiện khi bạn hoàn thành trận online có lưu kết quả.</p>}
      <Link href={game.href}>Vào chơi →</Link>
    </article>)}</section>
    <aside className="profile-note">Chỉ tính kết quả mới có mã người chơi và được máy chủ phòng xác nhận. Trận cũ chỉ có tên, trận luyện tập không lưu và trận bị ngắt giữa chừng không được cộng. Brawler và Math Boss hiện chưa có thống kê tài khoản; Math Quest dùng hồ sơ học sinh riêng.</aside>
  </div></main>;
}
