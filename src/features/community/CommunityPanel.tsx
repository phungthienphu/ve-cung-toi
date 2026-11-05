'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import './community.css';
import { useCommunityRealtime } from './RealtimeProvider';
import { PlayerSearch } from './PlayerSearch';
import { SupportPanel } from './SupportPanel';
import { isCommunityAccount } from './community-store';
import { invalidateCommunity, patchCommunityResource, useCommunityResource } from './resource-cache';
type User = { playerId: string; name: string; username?: string };
type Outgoing = { id: string; account: string; peer: string; text: string; createdAt: string; failed: boolean };
type Message = { _id: string; from: string; to?: string; text: string; createdAt: string };
type MessagePage = { me: string; peer: User; messages: Message[]; nextCursor: string | null };
type Conversation = User & {lastMessage?: {text:string;createdAt:string}|null;unread:number};
type Data = { blocked: string[]; me: string; users: User[]; search: User[]; online: string[]; edges: { from: string; to: string; status: string }[]; messages: Message[]; unread: { _id: string; count: number }[] };
export async function socialAction(action: string, to: string, extra: Record<string, string> = {}) {
  const endpoint = ['message','read'].includes(action) ? '/api/community/messages' : ['request','accept','remove','block','unblock','report'].includes(action) ? '/api/community/contacts' : '/api/community';
  const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, to, ...extra }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  const kind = action === 'message' ? 'message' : action === 'read' ? 'read' : ['invite','dismiss'].includes(action) ? 'invite' : 'friends';
  invalidateCommunity({ kind, actor: data.me ?? '', peer: to });
  return data;
}
function Avatar({ name, online }: { name: string; online?: boolean }) {
  return <span className="chat-avatar" aria-label={online ? 'Đang online' : undefined}>{name.trim().slice(0, 1).toUpperCase() || '?'}{online && <i />}</span>;
}
export function CommunityPanel({ roomPath, compact = false }: { roomPath?: string; compact?: boolean } = {}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const { status, data: session } = useSession();
  const guest = status !== 'authenticated';
  const [loginPrompt, setLoginPrompt] = useState(false);
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;
  const realtime = useCommunityRealtime();
  const [guestData, setGuestData] = useState<Data>();
  const [input, setInput] = useState(() => params.get('q')?.slice(0,60) ?? '');
  const [q, setQ] = useState(() => params.get('q')?.slice(0,60) ?? '');
  const [peer, setPeer] = useState(() => params.get('peer') ?? '');
  const [text, setText] = useState('');
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const sendQueue = useRef<Promise<void>>(Promise.resolve());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);
  const [pendingAction, setPendingAction] = useState<{ action: string; to: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [older, setOlder] = useState<Message[]>([]);
  const [hasOlder, setHasOlder] = useState(true);
  const [olderCursor, setOlderCursor] = useState<string | null | undefined>();
  const paging = useRef(false);
  const [tab, setTab] = useState<'friends' | 'requests' | 'blocked' | 'support'>(() => params.get('tab') === 'support' ? 'support' : params.get('tab') === 'requests' ? 'requests' : 'friends');
  const end = useRef<HTMLDivElement>(null);
  const loginLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => { if (loginPrompt) loginLink.current?.focus(); }, [loginPrompt]);
  const room = roomPath ?? params.get('room') ?? '';
  useEffect(() => { const id = setTimeout(() => setQ(input), 300); return () => clearTimeout(id); }, [input]);
  const account = session?.user?.playerId ?? '';
  const routePeer = params.get('peer') ?? '';
  const routeTab = params.get('tab');
  const routeQuery = params.get('q') ?? '';
  useEffect(() => { setPeer(routePeer); setOlder([]); setOlderCursor(undefined); setHasOlder(true); setText(''); }, [routePeer, account]);
  useEffect(() => { if (routeTab === 'requests' || routeTab === 'support') setTab(routeTab); }, [routeTab]);
  useEffect(() => { setInput(routeQuery.slice(0,60)); }, [routeQuery]);
  const messagePath = `/api/community/messages?peer=${encodeURIComponent(peer)}`;
  const notifications = useCommunityResource<{ unread: Data['unread']; friendRequests: number; friendCount: number }>('/api/community/notifications');
  const conversations = useCommunityResource<Data & { conversations: Conversation[] }>(!guest && tab === 'friends' && q.length < 2 ? '/api/community/conversations' : null);
  const contacts = useCommunityResource<Data>(!guest && (tab === 'requests' || tab === 'blocked') && q.length < 2 ? `/api/community/contacts?tab=${tab}` : null);
  const search = useCommunityResource<Data>(!guest && q.length >= 2 ? `/api/community/contacts?tab=search&q=${encodeURIComponent(q)}` : null);
  const thread = useCommunityResource<MessagePage>(!guest && peer ? messagePath : null);
  const data: Data | undefined = guest ? guestData : {
    me: account, users: [...(conversations.data?.users ?? []), ...(contacts.data?.users ?? []), ...(thread.data?.peer ? [thread.data.peer] : [])].filter((u,i,all)=>all.findIndex(v=>v.playerId===u.playerId)===i),
    edges: [...(conversations.data?.edges ?? []), ...(contacts.data?.edges ?? []), ...(search.data?.edges ?? [])],
    search: search.data?.search ?? [], messages: thread.data?.messages ?? [],
    unread: notifications.data?.unread ?? [], blocked: contacts.data?.blocked ?? [], online: realtime.online,
  };
  const loadError = thread.error || contacts.error || conversations.error || search.error || notifications.error;
  useEffect(() => {
    if (!guest) return;
    const controller = new AbortController();
    void fetch(`/api/community/search?q=${encodeURIComponent(q)}`, {signal:controller.signal}).then(async response=>{
      const body=await response.json();if(!response.ok)throw new Error(body.error);if(!controller.signal.aborted)setGuestData(body);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>controller.abort();
  }, [q, guest]);
  const latestMessageId = data?.messages.at(-1)?._id;
  const incoming = !!data?.messages.some(m => m.from === peer);
  useEffect(() => {
    if (peer && incoming && !document.hidden) void socialAction('read', peer).catch(() => {});
  }, [peer, latestMessageId, incoming]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [peer, latestMessageId, outgoing]);
  async function act(action: string, to: string, extra: Record<string, string> = {}) {
    if (guest) { setLoginPrompt(true); return false; }
    if (acting.current) return false;
    acting.current = true; setPendingAction({ action, to });
    setBusy(true); setError('');
    try { const result = await socialAction(action, to, extra); if (action === 'message' && result.message && selectedPeer.current === to) { patchCommunityResource<MessagePage>(account, messagePath, previous => previous ? { ...previous, messages: [...previous.messages.filter(m => m._id !== result.message._id), result.message] } : previous); } else if (['remove','block'].includes(action) && to === peer) { setPeer(''); } if (result.realtime === false) setNotice('Đã lưu, nhưng chưa đẩy realtime được. Đang chờ kết nối Party.'); if (action === 'invite' && result.realtime !== false) setNotice('Đã gửi lời mời vào phòng.'); if (action === 'report' && result.realtime !== false) setNotice('Đã gửi báo cáo đến quản trị viên.'); return true; }
    catch (e) { setError((e as Error).message); return false; }
    finally { acting.current = false; setPendingAction(null); setBusy(false); }
  }
  function enqueue(item: Outgoing) {
    setOutgoing(list => [...list.filter(m => m.id !== item.id), { ...item, failed: false }]);
    // Preserve submission order without locking the composer while the network runs.
    sendQueue.current = sendQueue.current.then(async () => {
      try {
        if (!isCommunityAccount(item.account)) { setOutgoing(list => list.filter(m => m.id !== item.id)); return; }
        const result = await socialAction('message', item.peer, { text: item.text });
        if (!result.message) throw new Error('Chưa xác nhận được tin nhắn.');
        patchCommunityResource<MessagePage>(item.account, `/api/community/messages?peer=${encodeURIComponent(item.peer)}`, previous => previous ? {
          ...previous, messages: [...previous.messages.filter(m => m._id !== result.message._id), result.message],
        } : previous);
        setOutgoing(list => list.filter(m => m.id !== item.id));
      } catch {
        setOutgoing(list => list.map(m => m.id === item.id ? { ...m, failed: true } : m));
      }
    });
  }
  function send() {
    const submitted = text.trim();
    if (!submitted || !thread.data || guest) return;
    setText('');
    enqueue({ id: crypto.randomUUID(), account, peer, text: submitted, createdAt: new Date().toISOString(), failed: false });
  }
  async function more() {
    const cursor = olderCursor === undefined ? thread.data?.nextCursor : olderCursor;
    if (!cursor || paging.current) return;
    paging.current = true;
    const activePeer = peer;
    try {
      const res = await fetch(`${messagePath}&cursor=${encodeURIComponent(cursor)}`);
      const body: MessagePage = await res.json(); if (!res.ok) throw new Error('Chưa tải được tin cũ.');
      if (selectedPeer.current !== activePeer) return;
      setOlder(prev => [...body.messages, ...prev]); setHasOlder(!!body.nextCursor);
      setOlderCursor(body.nextCursor);
    } catch (e) { if(selectedPeer.current === activePeer)setError((e as Error).message); }
    finally { paging.current = false; }
  }
  const selectedPeer = useRef(peer); selectedPeer.current = peer;
  function select(id: string) { if (busy) return; setPeer(id); setOlder([]); setHasOlder(true); setOlderCursor(undefined); setText(''); setError(''); }

  const person = thread.data?.peer;
  const accepted = data?.users.filter(u => data.edges.some(e => e.status === 'accepted' && (e.from === u.playerId || e.to === u.playerId))) ?? [];
  const pending = data?.users.filter(u => data.edges.some(e => e.status === 'pending' && (e.from === u.playerId || e.to === u.playerId))) ?? [];
  const messages = [...older, ...(data?.messages ?? [])].filter((m, i, a) => a.findIndex(n => n._id === m._id) === i);
  return <section className={`chat-app ${compact ? 'chat-app-compact' : ''}`} data-chat-open={!!peer} data-search-active={q.trim().length >= 2 && !peer}>
    <div className="chat-contacts">
      {!guest && !realtime.connected && <p className="chat-connection" role="status">Đang kết nối realtime…</p>}
      <header className="chat-list-header"><small>CÙNG NHAU VUI HƠN</small><h1>Bạn bè & chat <span>{notifications.data?.friendCount ?? accepted.length}</span></h1></header>
      <PlayerSearch value={input} onChange={setInput} suggest={false} />
      {guest && <p className="chat-guest-note">Tìm người chơi tự do. Đăng nhập để kết bạn và chat riêng.</p>}
      {room && !guest && <p className="chat-room-note">Mời bạn vào phòng · {room.split('/').at(-1)}</p>}
      <nav className="chat-tabs" aria-label="Danh sách bạn bè">{([['friends', 'Bạn bè'], ['requests', `Lời mời${notifications.data?.friendRequests ? ` (${notifications.data.friendRequests})` : ''}`], ['blocked', 'Đã chặn'], ['support', 'Hỗ trợ']] as const).map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => { if (guest && id !== 'friends' && id !== 'support') { setLoginPrompt(true); return; } setTab(id); setInput(''); }}>{label}</button>)}</nav>
      <div className={`chat-contact-scroll ${tab === 'support' ? 'chat-support-scroll' : ''}`}>{tab === 'support' ? <SupportPanel /> : <>
        {(!data || (contacts.loading && !contacts.data) || (conversations.loading && !conversations.data) || (search.loading && !search.data)) && <p className="chat-empty" role="status">Đang tải…</p>}
        {q.length >= 2 ? <><h2>Kết quả tìm kiếm</h2>{data?.search.length === 0 && <p className="chat-empty">Không tìm thấy người chơi.</p>}{data?.search.map(u => <div className="chat-person" key={u.playerId}><Avatar name={u.name} /><div><strong><Link href={`/players/${encodeURIComponent(u.playerId)}`}>{u.name}</Link></strong><small>{u.username ? `@${u.username}` : 'Người chơi'}</small></div><span className="chat-person-actions">{guest ? <><button onClick={() => setLoginPrompt(true)}>Chat</button><button onClick={() => setLoginPrompt(true)}>+ Kết bạn</button></> : data.edges.some(e => e.status === 'accepted' && (e.from === u.playerId || e.to === u.playerId)) ? <><button onClick={() => select(u.playerId)}>Chat</button>{room && <button disabled={busy} onClick={() => void act('invite', u.playerId, { path: room })}>Mời vào phòng</button>}</> : <button disabled={busy || data.edges.some(e => e.from === u.playerId || e.to === u.playerId)} onClick={() => void act('request', u.playerId)}>{data.edges.some(e => e.from === u.playerId || e.to === u.playerId) ? 'Đang chờ' : pendingAction?.to === u.playerId ? 'Đang gửi…' : '+ Kết bạn'}</button>}</span></div>)}</> : tab === 'blocked' ? <>{!data?.blocked.length && <p className="chat-empty">Bạn chưa chặn ai.</p>}{data?.blocked.map(id => <div className="chat-person" key={id}><span>Người chơi đã chặn</span><button disabled={busy} onClick={() => void act('unblock', id)}>Bỏ chặn</button></div>)}</> : tab === 'requests' ? <>{!pending.length && <p className="chat-empty">Chưa có lời mời kết bạn.</p>}{pending.map(u => {
          const incoming = data?.edges.some(e => e.from === u.playerId && e.to === data.me);
          return <div className="chat-request" key={u.playerId}><div className="chat-person"><Avatar name={u.name} /><div><strong>{u.name}</strong><small>{pendingAction?.to === u.playerId ? 'Đang cập nhật…' : incoming ? 'Muốn kết bạn với bạn' : 'Đang chờ phản hồi'}</small></div></div><div className="chat-request-actions">{incoming && <button disabled={busy} onClick={() => void act('accept', u.playerId)}>Chấp nhận</button>}<button disabled={busy} onClick={() => void act('remove', u.playerId)}>{incoming ? 'Từ chối' : 'Hủy lời mời'}</button></div></div>;
        })}</> : <>{accepted.length === 0 && <div className="chat-empty"><span className="chat-empty-icon">☏</span><strong>{guest ? 'Bạn đang tìm ai?' : room ? 'Rủ bạn vào phòng nhé' : 'Rủ bạn vào chơi nhé'}</strong><p>{guest ? 'Nhập ít nhất 2 ký tự tên hoặc username để tìm người chơi.' : 'Tìm tên người chơi phía trên để kết bạn và bắt đầu trò chuyện.'}</p></div>}{accepted.map(u => {
          const unread = data?.unread.find(n => n._id === u.playerId)?.count ?? 0;
          const online = realtime.online.includes(u.playerId);
          return <div className="chat-friend-row" key={u.playerId}><button className="chat-person chat-person-select" aria-pressed={peer === u.playerId} key={u.playerId} onClick={() => select(u.playerId)}><Avatar name={u.name} online={online} /><span><strong>{u.name}</strong><small>{conversations.data?.conversations.find(c=>c.playerId===u.playerId)?.lastMessage?.text ?? (online ? 'Đang online · Rủ vào chơi' : 'Hiện không online')}</small></span>{unread > 0 ? <b className="chat-count">{unread}</b> : <span className="chat-chevron">›</span>}</button>{room && <button className="chat-quick-invite" disabled={busy} onClick={() => void act('invite', u.playerId, { path: room })}>Mời vào phòng</button>}</div>;
        })}</>}
      </>}</div>
    </div>
    <div className="chat-conversation">
      {person ? <><header className="chat-thread-header"><button className="chat-back" aria-label="Về danh sách bạn bè" onClick={() => setPeer('')}>‹</button><Avatar name={person.name} online={realtime.online.includes(peer)} /><div><strong>{person.name}</strong><small>{realtime.online.includes(peer) ? 'Đang online' : 'Hiện không online'}</small></div><details className="chat-options"><summary aria-label="Tùy chọn cuộc trò chuyện">•••</summary><nav><a href={`/players/${encodeURIComponent(peer)}`}>Xem hồ sơ</a><button disabled={busy} onClick={() => { if (confirm('Hủy kết bạn với người chơi này?')) void act('remove', peer).then(ok => { if (ok) setPeer(''); }); }}>Hủy kết bạn</button><button disabled={busy} onClick={() => { if (confirm('Chặn người chơi này?')) void act('block', peer).then(ok => { if (ok) setPeer(''); }); }}>Chặn người chơi</button><button disabled={busy} onClick={() => { const reason = prompt('Lý do báo cáo'); if (reason) void act('report', peer, { text: reason }); }}>Báo cáo</button></nav></details></header>
      {room && <button className="chat-invite" disabled={busy} onClick={() => void act('invite', peer, { path: room })}>＋ Mời vào phòng đang chơi</button>}
      <div className="chat-messages" role="log" aria-label="Tin nhắn">{hasOlder && thread.data?.nextCursor && <button className="chat-load-older" onClick={() => void more()}>Xem tin cũ hơn</button>}{thread.loading && !thread.data && <p role="status" className="chat-empty">Đang tải tin nhắn…</p>}{!thread.loading && messages.length === 0 && <div className="chat-empty"><Avatar name={person.name} /><strong>Chào {person.name} một tiếng nhé!</strong><p>Cuộc vui bắt đầu từ một tin nhắn.</p></div>}{messages.map(m => <div className={`chat-message ${m.from === data?.me ? 'chat-message-mine' : ''}`} key={m._id}><p>{m.text}</p><time dateTime={m.createdAt} title={new Date(m.createdAt).toLocaleString('vi-VN')}>{new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></div>)}{outgoing.filter(m => m.account === account && m.peer === peer).map(m => <div className="chat-message chat-message-mine" key={m.id}><p>{m.text}</p>{m.failed ? <button type="button" onClick={() => enqueue(m)}>Chưa gửi được · Thử lại</button> : <small role="status">Đang gửi…</small>}</div>)}<div ref={end} /></div>
      <form className="chat-compose" onSubmit={e => { e.preventDefault(); send(); }}><textarea aria-label="Tin nhắn" value={text} onChange={e => setText(e.target.value)} maxLength={1000} required rows={1} placeholder="Nhắn gì đó…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (text.trim()) e.currentTarget.form?.requestSubmit(); } }} /><button aria-label="Gửi tin nhắn" disabled={!text.trim() || !thread.data}><svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true"><path d="m3 3 19 9-19 9 4-9-4-9Zm4 9h15" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg></button></form></> : peer && thread.loading ? <p className="chat-empty" role="status">Đang tải tin nhắn…</p> : <div className="chat-empty chat-welcome"><span className="chat-empty-icon">☏</span><h2>Chơi vui hơn cùng bạn bè</h2><p>Chọn một người bạn để trò chuyện hoặc mời vào phòng.</p></div>}
    </div>
    {loginPrompt && <div className="chat-login-overlay" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setLoginPrompt(false); } if (e.key === 'Tab') { e.preventDefault(); const dialog = e.currentTarget; const buttons = dialog.querySelectorAll<HTMLElement>('a,button'); const next = document.activeElement === buttons[0] ? buttons[1] : buttons[0]; next?.focus(); } }}><div className="chat-login-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-login-title"><h2 id="chat-login-title">Kết nối cùng bạn bè</h2><p>Đăng nhập để chat riêng, kết bạn và mời nhau vào game. Bạn vẫn có thể chơi bằng link và chat trong game như trước.</p><Link ref={loginLink} href={loginHref}>Đăng nhập</Link><button onClick={() => setLoginPrompt(false)}>Để sau</button></div></div>}
    {notice && !error && <p className="chat-error chat-notice" role="status">{notice}<button aria-label="Đóng thông báo" onClick={() => setNotice('')}>✕</button></p>}
    {(error || loadError) && <p className="chat-error" role="alert">{error || loadError}{loadError && <button onClick={()=>void Promise.all([thread.reload(),contacts.reload(),conversations.reload(),search.reload(),notifications.reload()])}>Thử lại</button>}<button aria-label="Đóng thông báo" onClick={() => setError('')}>✕</button></p>}
  </section>;
}
