'use client';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCommunityRealtime } from './RealtimeProvider';
import { useCallback, useEffect, useState } from 'react';
type Message = { _id:string;text:string;fromAdmin:boolean;createdAt:string };
type Thread = { _id:string;name:string;text:string;createdAt:string;unread:number;guest?:boolean };
export function SupportPanel({admin=false}:{admin?:boolean}) {
  const realtime=useCommunityRealtime();
  const {status}=useSession();
  const guest=!admin&&status!=='authenticated';
  const pathname=usePathname();
  const [threads,setThreads]=useState<Thread[]>([]);const [owner,setOwner]=useState('');const [messages,setMessages]=useState<Message[]>([]);const [older,setOlder]=useState<Message[]>([]);const [hasOlder,setHasOlder]=useState(true);const [text,setText]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const load=useCallback(async(signal?:AbortSignal)=>{
    const r=await fetch(`/api/feedback?${admin?'admin=1&':''}${owner?`owner=${encodeURIComponent(owner)}`:''}`,{signal});const body=await r.json();if(!r.ok)throw new Error(body.error);if(body.threads)setThreads(body.threads);else setMessages(body.messages);
    if(!admin||owner)void fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({admin,owner,action:'read'})}).catch(()=>{});
  },[admin,owner]);
  useEffect(()=>{const ctrl=new AbortController();const refresh=()=>{if(!guest&&!document.hidden)void load(ctrl.signal).catch(e=>{if(e.name!=='AbortError')setError(e.message);});};refresh();return()=>{ctrl.abort();};},[load,realtime.supportRevision,guest]);
  async function more(){const first=older[0]??messages[0];if(!first)return;try{const r=await fetch(`/api/feedback?${admin?'admin=1&':''}${owner?`owner=${encodeURIComponent(owner)}&`:''}before=${encodeURIComponent(first.createdAt)}`);const body=await r.json();if(!r.ok)throw new Error(body.error);setOlder(prev=>[...body.messages,...prev]);setHasOlder(body.messages.length===50);}catch(e){setError((e as Error).message);}}
  async function send(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({admin,owner,text})});const result=await r.json();if(!r.ok)throw new Error(result.error);setText('');await load();if(result.realtime===false)setError('Tin đã lưu nhưng chưa đẩy realtime được. Đang chờ kết nối Party.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  if(guest)return <GuestFeedback loginHref={`/login?next=${encodeURIComponent(pathname)}`}/>;
  const guestThread=admin&&owner.startsWith('guest:');
  return <div className={`support-panel ${admin?'support-admin':''}`}>{error&&<p className="support-error" role="alert">{error}</p>}{admin&&!owner?<><div className="admin-card-heading"><h2>Hộp thư người chơi</h2><span className="admin-badge">{threads.length} cuộc trò chuyện gần nhất</span></div>{threads.length===0&&<p className="admin-empty">Chưa có người chơi liên hệ hỗ trợ.</p>}{threads.map(t=><button className="support-thread" key={t._id} onClick={()=>{setOwner(t._id);setMessages([]);setOlder([]);setHasOlder(true);}}><span className="chat-avatar">{t.name.slice(0,1)}</span><span><strong>{t.name}{t.guest ? ' · Khách' : ''}</strong><small>{t.text}</small></span><time>{new Date(t.createdAt).toLocaleDateString('vi-VN')}</time>{t.unread>0&&<b className="chat-count">{t.unread}</b>}</button>)}</>:<><header className="support-header">{admin&&<button onClick={()=>{setOwner('');setOlder([]);}}>← Hộp thư</button>}<strong>{admin?'Trả lời người chơi':'Nhắn quản trị viên'}</strong><small>{admin?owner:'Góp ý, báo lỗi hoặc cần trợ giúp? Nhắn tại đây nhé.'}</small></header><div className="support-messages" role="log" aria-label="Tin nhắn hỗ trợ">{hasOlder&&messages.length>=50&&<button className="chat-load-older" onClick={()=>void more()}>Xem tin cũ hơn</button>}{messages.length===0&&<div className="chat-empty"><span className="chat-empty-icon">✉</span><strong>Chúng mình luôn lắng nghe</strong><p>Gửi tin nhắn để bắt đầu. Quản trị viên sẽ phản hồi khi có thể.</p></div>}{[...older,...messages].filter((m,i,a)=>a.findIndex(n=>n._id===m._id)===i).map(m=><div key={m._id} className={`chat-message ${m.fromAdmin===admin?'chat-message-mine':''}`}><small>{m.fromAdmin?'Quản trị viên':'Người chơi'}</small><p>{m.text}</p><time>{new Date(m.createdAt).toLocaleString('vi-VN')}</time></div>)}</div>{guestThread ? <p className="support-guest-note">Góp ý từ khách chưa đăng nhập. Người gửi không có hộp thư để nhận phản hồi.</p> : <form className="chat-compose" onSubmit={send}><textarea aria-label="Tin nhắn hỗ trợ" value={text} onChange={e=>setText(e.target.value)} rows={2} maxLength={1000} required placeholder="Viết tin nhắn cho quản trị viên…"/><button disabled={busy||!text.trim()} aria-label="Gửi hỗ trợ">➤</button></form>}</>}</div>;
}


function GuestFeedback({loginHref}:{loginHref:string}) {
  const [step,setStep]=useState<'choice'|'form'|'sent'>('choice');
  const [name,setName]=useState('');
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function send(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError('');
    try {
      const r=await fetch('/api/feedback/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,text})});
      const result=await r.json();if(!r.ok)throw new Error(r.status===429?'Bạn đã gửi nhiều góp ý. Hãy thử lại sau ít phút.':result.error);
      setStep('sent');setText('');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="support-panel"><header className="support-header"><strong>Nhắn quản trị viên</strong><small>Góp ý của bạn giúp cuộc chơi tốt hơn.</small></header><div className="support-guest-body">{step==='choice'?<><span className="chat-empty-icon">✉</span><h2>Bạn muốn đăng nhập trước không?</h2><p>Đăng nhập để trò chuyện và nhận phản hồi từ quản trị viên. Hoặc để lại tên và góp ý ngay, không cần tài khoản.</p><Link className="support-primary" href={loginHref}>Đăng nhập để trò chuyện</Link><button className="support-secondary" onClick={()=>setStep('form')}>Tiếp tục bằng khách</button></>:step==='sent'?<div role="status"><span className="chat-empty-icon">✓</span><h2>Đã gửi góp ý!</h2><p>Cảm ơn {name}. Quản trị viên đã nhận được góp ý của bạn.</p><button className="support-secondary" onClick={()=>setStep('form')}>Gửi góp ý khác</button></div>:<form className="support-guest-form" onSubmit={send}><button type="button" className="support-choice-back" onClick={()=>setStep('choice')}>← Quay lại</button><h2>Để lại góp ý</h2><p>Bạn không cần đăng nhập. Góp ý này không có hộp thư nhận phản hồi.</p><label>Tên của bạn<input autoComplete="nickname" value={name} onChange={e=>setName(e.target.value)} maxLength={60} required placeholder="Bạn muốn được gọi là gì?"/></label><label>Nội dung<textarea value={text} onChange={e=>setText(e.target.value)} maxLength={1000} rows={5} required placeholder="Góp ý hoặc báo lỗi cho chúng mình…"/></label>{error&&<p className="support-error" role="alert">{error}</p>}<button className="support-primary" disabled={busy||!name.trim()||!text.trim()}>{busy?'Đang gửi…':'Gửi góp ý'}</button></form>}</div></div>;
}
