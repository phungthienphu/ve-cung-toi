'use client';
import Link from 'next/link';
import { SupportPanel } from './SupportPanel';
import './community.css';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AdminSection } from './admin-sections';
type Data = {
  total: number;
  users: { playerId: string; name: string; email: string; username?: string; disabledAt?: string; isAdmin?: boolean }[];
  games: { id: string; title: string; enabled: boolean }[];
  impressions: { _id: { day: string; path: string }; count: number }[];
  reports: { _id: string; from: string; to: string; reason: string; createdAt: string }[];
  audit: { _id: string; actor: string; action: string; target: string; createdAt: string }[];
};
const date = (value: string) => new Date(value).toLocaleString('vi-VN');
export function AdminPanel({ section }: { section: AdminSection }) {
  const [data, setData] = useState<Data>();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => { const id = setTimeout(() => { setQuery(q); setPage(0); }, 300); return () => clearTimeout(id); }, [q]);
  useEffect(() => {
    const ctrl = new AbortController();
    void fetch(`/api/admin?q=${encodeURIComponent(query)}&page=${page}`, { signal: ctrl.signal }).then(async r => {
      const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); setError('');
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => ctrl.abort();
  }, [query, page, revision]);
  async function update(action: string, target: string, enabled: boolean, label: string) {
    if (!confirm(`${enabled ? 'Mở' : 'Khóa'} ${label}?`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, target, enabled }) });
      if (!r.ok) throw new Error((await r.json()).error);
      setRevision(v => v + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const views = data?.impressions.reduce((n, i) => n + i.count, 0) ?? 0;
  const gameViews = data?.impressions.filter(i => i._id.path !== '/').reduce((n, i) => n + i.count, 0) ?? 0;
  const daily = new Map<string, number>();
  data?.impressions.forEach(i => daily.set(i._id.day, (daily.get(i._id.day) ?? 0) + i.count));
  const days = Array.from({ length: 14 }, (_, i) => { const day = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10); return { day, count: daily.get(day) ?? 0 }; });
  const max = Math.max(1, ...days.map(d => d.count));
  return <>{error && <div className="admin-alert" role="alert">{error}<button onClick={() => setRevision(v => v + 1)}>Thử lại</button></div>}{!data ? <div className="admin-card admin-empty">Đang tải dữ liệu…</div> : <>
    {section === 'overview' && <><div className="admin-stats">{[['Tài khoản', data.total, 'Người chơi đã đăng ký'], ['Game đang bật', `${data.games.filter(g => g.enabled).length}/${data.games.length}`, 'Trong danh mục'], ['Lượt xem', views, '30 ngày gần nhất'], ['Lượt vào game', gameViews, '30 ngày gần nhất']].map(([label, value, note]) => <div className="admin-card admin-stat" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}</div><div className="admin-card"><div className="admin-card-heading"><h2>Hoạt động truy cập</h2><Link href="/admin/impressions">Xem thống kê →</Link></div><p className="admin-muted">14 ngày gần nhất · Số lượt xem, không phải số người duy nhất</p><div className="admin-chart" aria-label="Lượt xem theo ngày">{days.map(d => <div key={d.day} title={`${d.day}: ${d.count} lượt`}><span>{d.count || ''}</span><i style={{ height: `${Math.max(2, d.count / max * 120)}px` }} /><small>{d.day.slice(5)}</small></div>)}</div></div><div className="admin-overview-grid"><div className="admin-card"><h2>Trạng thái trò chơi</h2>{data.games.map(g => <div className="admin-list-row" key={g.id}><span>{g.title}</span><span className={`admin-badge ${g.enabled ? 'positive' : 'muted'}`}>{g.enabled ? 'Hoạt động' : 'Bảo trì'}</span></div>)}</div><div className="admin-card"><div className="admin-card-heading"><h2>Báo cáo gần đây</h2><Link href="/admin/reports">Xem tất cả →</Link></div>{data.reports.length === 0 ? <p className="admin-empty">Chưa có báo cáo từ người chơi.</p> : data.reports.slice(0, 4).map(r => <div className="admin-list-row" key={r._id}><span>{r.reason}</span><small>{date(r.createdAt)}</small></div>)}</div></div></>}
    {section === 'feedback' && <div className="admin-card"><SupportPanel admin /></div>}
    {section === 'users' && <div className="admin-card"><div className="admin-card-heading"><h2>Danh sách tài khoản <span className="admin-badge">{data.total}</span></h2><input aria-label="Tìm tài khoản" placeholder="Tìm tên, username hoặc email…" value={q} onChange={e => setQ(e.target.value)} /></div><div className="admin-table-wrap"><table><thead><tr><th>Người chơi</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th className="admin-right">Thao tác</th></tr></thead><tbody>{data.users.map(u => <tr key={u.playerId}><td><strong>{u.name || 'Chưa đặt tên'}</strong><small>{u.username ? `@${u.username}` : u.playerId}</small></td><td>{u.email}</td><td><span className="admin-badge">{u.isAdmin ? 'Quản trị viên' : 'Người chơi'}</span></td><td><span className={`admin-badge ${u.disabledAt ? 'danger' : 'positive'}`}>{u.disabledAt ? 'Đã khóa' : 'Hoạt động'}</span></td><td className="admin-right"><button disabled={busy || u.isAdmin} className={u.disabledAt ? '' : 'admin-button-danger'} onClick={() => void update('user', u.playerId, !!u.disabledAt, u.name || u.email)}>{u.disabledAt ? 'Mở khóa' : 'Khóa'}</button></td></tr>)}</tbody></table>{data.users.length === 0 && <p className="admin-empty">Không tìm thấy tài khoản phù hợp.</p>}</div><footer className="admin-pagination"><span>{data.total} tài khoản · Trang {page + 1}</span><div><button disabled={!page} onClick={() => setPage(p => p - 1)}>← Trước</button><button disabled={(page + 1) * 25 >= data.total} onClick={() => setPage(p => p + 1)}>Sau →</button></div></footer></div>}
    {section === 'games' && <><div className="admin-notice">Tắt game ẩn thẻ trên trang chủ và chặn truy cập giao diện mới. Phòng Cloudflare đang chạy vẫn tiếp tục.</div><div className="admin-game-grid">{data.games.map(g => <div className="admin-card admin-game" key={g.id}><span className="admin-game-icon">▦</span><span className={`admin-badge ${g.enabled ? 'positive' : 'muted'}`}>{g.enabled ? 'Đang hoạt động' : 'Đang bảo trì'}</span><h2>{g.title}</h2><p className="admin-muted">Mã trò chơi: {g.id}</p><button disabled={busy} onClick={() => void update('game', g.id, !g.enabled, g.title)}>{g.enabled ? 'Chuyển sang bảo trì' : 'Mở lại trò chơi'}</button></div>)}</div></>}
    {section === 'impressions' && <div className="admin-card"><div className="admin-card-heading"><h2>Lượt xem trong 30 ngày</h2><span className="admin-badge">{views} lượt</span></div><p className="admin-muted">Thống kê từ khi triển khai, không gồm dữ liệu Cloudflare cũ. Lưu tối đa 90 ngày.</p><div className="admin-table-wrap"><table><thead><tr><th>Ngày (UTC)</th><th>Trang / game</th><th className="admin-right">Lượt xem</th></tr></thead><tbody>{data.impressions.map(i => <tr key={i._id.day + i._id.path}><td>{i._id.day}</td><td>{i._id.path === '/' ? 'Trang chủ' : i._id.path}</td><td className="admin-right"><strong>{i.count}</strong></td></tr>)}</tbody></table>{data.impressions.length === 0 && <p className="admin-empty">Chưa có lượt xem được ghi nhận.</p>}</div></div>}
    {section === 'reports' && <div className="admin-card"><div className="admin-card-heading"><h2>Phản ánh từ người chơi</h2><span className="admin-badge">50 báo cáo mới nhất</span></div>{data.reports.length === 0 && <p className="admin-empty">Chưa có báo cáo. Các phản ánh mới sẽ xuất hiện tại đây.</p>}{data.reports.map(r => <article className="admin-report" key={r._id}><div><span className="admin-badge danger">Báo cáo người chơi</span><time>{date(r.createdAt)}</time></div><p>{r.reason}</p><small>Người gửi: {r.from} · Người bị báo cáo: {r.to}</small><Link href={`/admin/users?q=${encodeURIComponent(r.to)}`}>Xem người dùng →</Link></article>)}</div>}
    {section === 'audit' && <div className="admin-card"><div className="admin-card-heading"><h2>Lịch sử thao tác</h2><span className="admin-badge">30 thao tác mới nhất</span></div><div className="admin-table-wrap"><table><thead><tr><th>Thời gian</th><th>Quản trị viên</th><th>Thao tác</th><th>Đối tượng</th></tr></thead><tbody>{data.audit.map(a => <tr key={a._id}><td>{date(a.createdAt)}</td><td>{a.actor}</td><td><span className="admin-badge">{a.action.startsWith('user') ? 'Tài khoản' : 'Trò chơi'} · {a.action.endsWith('true') ? 'Mở' : 'Khóa'}</span></td><td>{a.target}</td></tr>)}</tbody></table>{data.audit.length === 0 && <p className="admin-empty">Chưa có thao tác quản trị.</p>}</div></div>}
  </>}</>;
}
