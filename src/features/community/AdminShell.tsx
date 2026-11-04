'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ADMIN_SECTIONS } from './admin-sections';
import './admin.css';
export function AdminShell({children,name,fonts}:{children:React.ReactNode;name:string;fonts:string}){
  const path=usePathname();const [open,setOpen]=useState(false);
  const section=ADMIN_SECTIONS.find(s=>path===(s.id==='overview'?'/admin':`/admin/${s.id}`))??ADMIN_SECTIONS[0];
  return <main className={`admin-workspace ${fonts}`}><aside className={`admin-sidebar ${open?'is-open':''}`}><Link className="admin-brand" href="/admin"><span>CT</span><div>Chơi Cùng Tôi<small>TRUNG TÂM QUẢN TRỊ</small></div></Link><p className="admin-nav-label">QUẢN LÝ HỆ THỐNG</p><nav aria-label="Quản trị">{ADMIN_SECTIONS.map(s=><Link key={s.id} href={s.id==='overview'?'/admin':`/admin/${s.id}`} aria-current={section.id===s.id?'page':undefined} onClick={()=>setOpen(false)}><span aria-hidden="true">{s.icon}</span>{s.label}</Link>)}</nav><div className="admin-sidebar-bottom"><Link href="/">← Về trang chơi game</Link><div className="admin-identity"><span>{name.slice(0,1)}</span><div><strong>{name}</strong><small>Quản trị viên</small></div></div></div></aside>{open&&<button className="admin-backdrop" aria-label="Đóng menu" onClick={()=>setOpen(false)}/>}<div className="admin-main"><header className="admin-topbar"><button className="admin-mobile-menu" aria-label="Mở menu quản trị" aria-expanded={open} onClick={()=>setOpen(!open)}>☰</button><span>Hệ thống <b>/</b> {section.label}</span><Link href="/">Mở website ↗</Link></header><div className="admin-content"><div className="admin-page-heading"><small>ADMIN WORKSPACE</small><h1>{section.label}</h1><p>{section.description}</p></div>{children}</div></div></main>;
}
