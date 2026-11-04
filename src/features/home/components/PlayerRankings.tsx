'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { RANKING_GAMES, type RankingPage, type RankedPlayer, type GameRankingPreview, type RankingGame } from '@/features/community/ranking-config';

function Players({ items, game, start = 0 }: { items: RankedPlayer[]; game: RankingGame; start?: number }) {
  return <ol className="home-ranking-list" start={start + 1}>{items.map((player, index) => <li key={player.playerId}><Link href={`/players/${encodeURIComponent(player.playerId)}`}><span className="home-ranking-place">{start + index + 1}</span><span className="home-ranking-avatar">{player.name.slice(0, 1).toUpperCase() || '?'}</span><span className="home-ranking-name"><strong>{player.name}</strong><small>{player.username ? `@${player.username}` : 'Xem hồ sơ · Kết bạn'}</small></span><b>{Math.floor(player.score).toLocaleString('vi-VN')}<small>{game.unit}</small></b></Link></li>)}</ol>;
}
function GameRanking({ initial, game }: { initial: RankingPage; game: RankingGame }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initial.items);
  const [offset, setOffset] = useState(initial.nextOffset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    const element = dialog.current;
    element?.showModal(); document.body.style.overflow = 'hidden';
    return () => { request.current?.abort(); busy.current = false; setLoading(false); element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  async function more() {
    if (busy.current || offset === null) return;
    busy.current = true; setLoading(true); setError('');
    const controller = new AbortController(); request.current = controller;
    try {
      const response = await fetch(`/api/community/rankings?game=${game.id}&offset=${offset}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Chưa tải được xếp hạng. Thử lại nhé.');
      const page: RankingPage = await response.json();
      setItems(previous => [...previous, ...page.items].filter((player, index, all) => all.findIndex(p => p.playerId === player.playerId) === index)); setOffset(page.nextOffset);
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) { busy.current = false; setLoading(false); } }
  }
  return <><aside className="home-rankings" aria-label={`Top 3 · ${game.name}`}><h2 className="home-wood-title"><span aria-hidden="true">♛</span>{game.title}</h2><div className="home-news-panel"><p className="home-ranking-caption">{game.name} · Top 3</p>{initial.items.length ? <Players items={initial.items} game={game}/> : <div className="home-ranking-empty"><span aria-hidden="true">☆</span><strong>Bảng vàng đang chờ bạn</strong><p>Chưa có người chơi đủ điểm xếp hạng.</p></div>}<button className="home-news-more" onClick={() => { setItems(initial.items); setOffset(initial.nextOffset); setError(''); setOpen(true); }}>Xem thêm <span aria-hidden="true">→</span></button></div></aside><dialog ref={dialog} className="home-ranking-dialog" aria-labelledby={`ranking-title-${game.id}`} onCancel={() => setOpen(false)} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}><header><div><small>CÙNG CHƠI · CÙNG KẾT NỐI</small><h2 id={`ranking-title-${game.id}`}>{game.title}</h2></div><button aria-label="Đóng bảng xếp hạng" onClick={() => setOpen(false)}>×</button></header><p className="home-ranking-caption">{game.name} · {game.metric}. Bấm vào người chơi để xem hồ sơ và kết bạn.</p><div className="home-ranking-scroll" onScroll={e => { const el = e.currentTarget; if (!error && el.scrollHeight - el.scrollTop - el.clientHeight < 100) void more(); }}><Players items={items} game={game}/>{!items.length && <p className="home-ranking-empty">Chưa có người chơi đủ điểm. Bạn có thể tìm bạn bằng tên hoặc username.</p>}{error && <p role="alert">{error}</p>}{offset !== null && <button className="home-news-more" disabled={loading} onClick={() => void more()}>{loading ? 'Đang tải…' : error ? 'Thử lại' : 'Xem thêm người chơi'}</button>}</div></dialog></>;
}

export function PlayerRankings() {
  const [games,setGames]=useState<GameRankingPreview[]>([]);
  const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setError('');
    void fetch('/api/community/rankings?game=all',{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error('Chưa tải được bảng xếp hạng.');
      const data=await response.json();setGames(data.games);setLoaded(true);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>controller.abort();
  },[attempt]);
  if(!loaded)return <aside className="home-rankings"><h2 className="home-wood-title">Bảng vàng người chơi</h2><div className="home-news-panel home-ranking-empty" role="status">{error || 'Đang tải thành tích…'}{error&&<button className="home-news-more" onClick={()=>setAttempt(value=>value+1)}>Thử lại</button>}</div></aside>;
  return <div className="home-ranking-stack">{RANKING_GAMES.map(game => <GameRanking key={game.id} game={game} initial={games.find(item=>item.gameId===game.id)?.page ?? {items:[],nextOffset:null}}/>)}</div>;
}
