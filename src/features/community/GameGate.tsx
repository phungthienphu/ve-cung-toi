import Link from 'next/link';
import { dbConnect } from '@/server/db/mongodb';
import { GameSetting } from '@/server/models/Community';
export async function GameGate({id,children}:{id:string;children:React.ReactNode}){
  let disabled = false;
  try { await dbConnect(); disabled = !!await GameSetting.exists({gameId:id,enabled:false}); } catch { /* Guest games stay available during database outages. */ }
  if(disabled)return <main style={{padding:40,textAlign:'center'}}><h1>Game đang bảo trì</h1><p>Quay lại chơi sau nhé.</p><Link href="/">Về trang chủ</Link></main>;
  return children;
}
