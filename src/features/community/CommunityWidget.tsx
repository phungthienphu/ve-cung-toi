'use client';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCommunityRealtime } from './RealtimeProvider';
import { roomGame } from './room-path';
import { HOME_GAMES } from '@/features/home/data/games';
import { CommunityPanel, socialAction } from './CommunityPanel';
import './community.css';
type Invite={_id:string;from:string;fromName:string;path:string};
export function CommunityWidget(){const {data:session}=useSession();const path=usePathname();const realtime=useCommunityRealtime();const [invitations,setInvitations]=useState<Invite[]>([]);const [unread,setUnread]=useState(0);const [requests,setRequests]=useState(0);const [error,setError]=useState('');const [open,setOpen]=useState(false);const tracked=useRef({path:'',eventId:''});
useEffect(()=>{setInvitations([]);setUnread(0);setRequests(0);},[session?.user?.playerId]);
useEffect(()=>{if(['/verify-email','/reset-password'].includes(path)||path.startsWith('/admin'))return;const game=roomGame(path)??HOME_GAMES.find(g=>path===g.href||path.startsWith(g.href+'/'));if(!game&&path!=='/')return;if(tracked.current.path!==path)tracked.current={path,eventId:crypto.randomUUID()};const eventId=tracked.current.eventId;void fetch('/api/impressions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:game?.href??(path==='/'?'/':''),eventId})}).catch(()=>{});},[path]);
useEffect(()=>{
 if(!session?.user?.playerId||path.startsWith('/admin'))return;
 const ctrl=new AbortController();let version=0;
 const refresh=()=>{if(document.hidden)return;const current=++version;void fetch('/api/community',{signal:ctrl.signal}).then(async r=>{if(!r.ok)return;const d=await r.json();if(ctrl.signal.aborted||current!==version)return;setRequests(d.friendRequests??0);setInvitations(d.invitations);setUnread(d.unread.reduce((sum:number,n:{count:number})=>sum+n.count,0));}).catch(()=>{});};
 refresh();document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);
 return()=>{ctrl.abort();document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};
},[session?.user?.playerId,path,realtime.revision]);

if(path.startsWith('/admin'))return null;const count=unread+requests;const invite=invitations[0];const game=roomGame(path);async function dismiss(){try{await socialAction('dismiss',invite.from);setInvitations(list=>list.filter(i=>i.from!==invite.from));}catch(e){setError((e as Error).message);}}
return <><button className="community-launch" aria-label={open ? 'Đóng chat' : `Mở chat${count ? `, ${unread} tin chưa đọc, ${requests} lời mời kết bạn` : ''}`} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{game && !open && <span className="community-room-label">Mời bạn / Chat</span>}<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-4 3V11.5a10 10 0 0 1 20 0Z" fill="currentColor"/><path d="M6 11h10M6 15h6" stroke="#fffaf0" strokeWidth="2" strokeLinecap="round"/></svg>{count>0&&<span className="community-unread">{count>99?'99+':count}</span>}</button>{open&&<div className="community-drawer" role="dialog" aria-label="Bạn bè và chat" onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}><button className="community-close" onClick={()=>setOpen(false)} aria-label="Đóng khung chat">✕</button><CommunityPanel compact roomPath={game?path:undefined}/></div>}{!invite&&requests>0&&!open&&<aside className="community-toast" role="status"><strong>Bạn có {requests} lời mời kết bạn</strong><p>Mở danh sách để xem và phản hồi lời mời.</p><Link href="/community?tab=requests">Xem lời mời</Link></aside>}{invite&&<aside className="community-toast" role="alert"><strong>{invite.fromName} mời bạn vào phòng!</strong><p>{roomGame(invite.path)?.title}</p><Link href={invite.path} onClick={()=>void dismiss()}>Đồng ý</Link><button onClick={()=>void dismiss()}>Bỏ qua</button>{error&&<p>{error}</p>}</aside>}</>;
}
