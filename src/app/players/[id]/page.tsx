import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { dbConnect } from '@/server/db/mongodb';
import { ProfileActions } from '@/features/community/ProfileActions';
import { actor } from '@/features/community/server';
import { AccountUser } from '@/server/models/AccountUser';
import { PlayerBlock } from '@/server/models/Community';
import { getAccountProfile } from '@/features/account/server/profile';
import { AuthSurface } from '@/features/account/components/AuthSurface';
import { homeFonts } from '@/features/home/fonts';
import '@/features/account/components/auth-pages.css';
import '@/features/community/community.css';
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;await dbConnect();const session=await auth();let me;if(session?.user){try{me=await actor();}catch{notFound();}}
  if(me&&await PlayerBlock.exists({$or:[{from:me.playerId,to:id},{from:id,to:me.playerId}]}))notFound();
  const user=await AccountUser.findOne({playerId:id,disabledAt:null}).select('name username').lean();if(!user)notFound();
  const profile=await getAccountProfile(id);
  return <AuthSurface fonts={homeFonts} wide backHref="/community" backLabel="Về bạn bè"><section className="community-panel player-profile"><header className="profile-header"><span className="profile-avatar">{user.name.slice(0,1).toUpperCase()}</span><div><small>HỒ SƠ NGƯỜI CHƠI</small><h1>{user.name}</h1><p>{user.username&&`@${user.username}`}</p></div></header><ProfileActions playerId={id}/><h2>Thành tích</h2><p>Đua xe: {Math.round(profile.hill?.best??0)} m · {profile.hill?.played??0} lượt</p>{profile.games.map(g=><p key={g.id}>{g.name}: {g.stats?.played??0} trận · {g.stats?.wins??0} thắng</p>)}</section></AuthSurface>;
}
