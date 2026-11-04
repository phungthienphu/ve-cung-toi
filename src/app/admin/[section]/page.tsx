import { notFound } from 'next/navigation';
import { AdminPanel } from '@/features/community/AdminPanel';
import { ADMIN_SECTIONS } from '@/features/community/admin-sections';
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;const item=ADMIN_SECTIONS.find(s=>s.id===section);if(!item)notFound();return <AdminPanel section={item.id}/>;}
