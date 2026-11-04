import { notFound } from 'next/navigation';
import { actor } from '@/features/community/server';
import { AdminShell } from '@/features/community/AdminShell';
import { homeFonts } from '@/features/home/fonts';
export default async function Layout({children}:{children:React.ReactNode}){let user;try{user=await actor(true);}catch{notFound();}return <AdminShell fonts={homeFonts} name={user.name || 'Quản trị viên'}>{children}</AdminShell>;}
