'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { newsDate, type HomeNews, type NewsPage } from '../data/news';

export function NewsList({ items, readThrough }: { items: HomeNews[]; readThrough: string }) {
  return <ol className="home-news-list">{items.map(item => <li key={item.id}>
    <Link href={item.href} className="home-news-item"><div className="home-news-image"><Image src={item.image} alt="" fill sizes="48px" style={{ objectFit: 'cover' }} /></div><div><div className="home-news-meta">{Date.parse(item.publishedAt) > (Date.parse(readThrough) || 0) && <span className="home-unread-label">Mới</span>}<span>{item.game}</span><time dateTime={item.publishedAt}>{newsDate(item.publishedAt)}</time></div><p>{item.title}</p></div></Link>
  </li>)}</ol>;
}
export function NewsPreview({ initial, readThrough, onExpand }: { initial: NewsPage; readThrough: string; onExpand: () => void }) {
  return <aside className="home-news-sidebar" aria-label="Bảng tin"><h2 className="home-wood-title">📰 Bảng tin</h2><div className="home-news-panel"><NewsList items={initial.items} readThrough={readThrough} />{initial.items.length === 0 && <p className="home-empty">Chưa có tin mới. Quay lại sau nhé!</p>}{initial.nextCursor && <button className="home-news-more" onClick={onExpand}>Xem thêm cập nhật <span aria-hidden>→</span></button>}</div></aside>;
}
export function NewsSheet({ initial, open, expandedOnOpen, readThrough, onClose }: { initial: NewsPage; open: boolean; expandedOnOpen: boolean; readThrough: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scrollRoot = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const closeRef = useRef(onClose); closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    setItems(initial.items); setCursor(initial.nextCursor); setExpanded(expandedOnOpen); setError(''); setLoading(false); busy.current = false;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { request.current?.abort(); element.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [open, initial, expandedOnOpen]);

  const loadMore = useCallback(async () => {
    if (!cursor || busy.current) return;
    busy.current = true; setLoading(true); setError('');
    const controller = new AbortController(); request.current = controller;
    try {
      const response = await fetch(`/api/news?cursor=${encodeURIComponent(cursor)}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Không tải được tin. Bạn thử lại nhé.');
      const page: NewsPage = await response.json();
      if (controller.signal.aborted) return;
      setItems(current => [...current, ...page.items.filter(item => !current.some(existing => existing.id === item.id))]); setCursor(page.nextCursor);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được tin.');
    } finally {
      if (!controller.signal.aborted) { busy.current = false; setLoading(false); }
    }
  }, [cursor]);

  useEffect(() => {
    if (!open || !expanded || !cursor || loading || error) return;
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void loadMore(); }, { root: scrollRoot.current, rootMargin: '160px' });
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [open, expanded, cursor, loading, error, loadMore]);

  return <dialog ref={dialog} className="home-news-dialog" aria-labelledby="home-news-heading" onCancel={event => { event.preventDefault(); closeRef.current(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeRef.current(); } }}>
    <span className="home-sheet-handle" aria-hidden />
    <header className="home-sheet-header"><h2 id="home-news-heading" className="home-wood-title">📰 Bảng tin</h2><button className="home-icon-button" aria-label="Đóng bảng tin" onClick={onClose} autoFocus>✕</button></header>
    <div className="home-sheet-scroll" ref={scrollRoot}><NewsList items={items} readThrough={readThrough} />{items.length === 0 && <p className="home-empty">Chưa có tin mới. Quay lại sau nhé!</p>}
      {cursor && !expanded && <button className="home-button home-news-load" onClick={() => { setExpanded(true); void loadMore(); }}>Xem thêm cập nhật ↓</button>}
      {expanded && cursor && <div ref={sentinel} className="home-news-sentinel"><button className="home-news-more" disabled={loading} onClick={() => void loadMore()}>{loading ? 'Đang tải thêm tin…' : error ? 'Thử tải lại' : 'Tải thêm tin'}</button></div>}
      {error && <p className="home-news-error" role="alert">{error}</p>}{expanded && !cursor && <p className="home-news-end" role="status">Bạn đã xem hết tin cập nhật rồi 🐷</p>}
    </div>
  </dialog>;
}
