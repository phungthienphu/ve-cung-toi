'use client';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { socialAction } from './CommunityPanel';
import { useCommunityRealtime } from './RealtimeProvider';
export function ProfileActions({ playerId }: { playerId: string }) {
  const { data: session, status } = useSession();
  const realtime = useCommunityRealtime();
  const [relation, setRelation] = useState<'none'|'pending'|'incoming'|'accepted'|'loading'>('loading');
  const [login, setLogin] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!login) return;
    const element = dialog.current; element?.showModal();
    return () => element?.close();
  }, [login]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (status !== 'authenticated') return;
    const controller = new AbortController();
    void fetch(`/api/community/contacts?tab=relation&peer=${encodeURIComponent(playerId)}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Chưa tải được thông tin kết bạn.');
      const data = await response.json();
      const edge = data.edges.find((e: {from:string;to:string}) => e.from === playerId || e.to === playerId);
      setRelation(!edge ? 'none' : edge.status === 'accepted' ? 'accepted' : edge.from === playerId ? 'incoming' : 'pending');
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [playerId, status, realtime.revision]);
  async function request() {
    if (status !== 'authenticated') { setLogin(true); return; }
    setBusy(true); setError('');
    try { await socialAction(relation === 'incoming' ? 'accept' : 'request', playerId); setRelation(relation === 'incoming' ? 'accepted' : 'pending'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (session?.user?.playerId === playerId) return <p className="profile-own">Đây là hồ sơ của bạn.</p>;
  return <div className="profile-actions"><button disabled={busy || status === 'loading' || (status === 'authenticated' && ['loading','pending','accepted'].includes(relation))} onClick={() => void request()}>{relation === 'accepted' && status === 'authenticated' ? '✓ Bạn bè' : relation === 'incoming' && status === 'authenticated' ? 'Chấp nhận kết bạn' : relation === 'pending' && status === 'authenticated' ? 'Đã gửi lời mời' : '+ Kết bạn'}</button>{status === 'authenticated' && relation === 'accepted' ? <Link href={`/community?peer=${encodeURIComponent(playerId)}`}>Nhắn tin</Link> : <button onClick={() => { if (status !== 'authenticated') setLogin(true); else setError('Hãy kết bạn trước để bắt đầu trò chuyện.'); }}>Nhắn tin</button>}{login && <dialog ref={dialog} className="profile-login" aria-label="Đăng nhập để kết nối" onCancel={() => setLogin(false)}><p>Đăng nhập để kết bạn và nhắn tin với người chơi này.</p><Link href={`/login?next=${encodeURIComponent(`/players/${playerId}`)}`}>Đăng nhập</Link><button onClick={() => setLogin(false)}>Để sau</button></dialog>}{error && <p role="alert">{error}</p>}</div>;
}
