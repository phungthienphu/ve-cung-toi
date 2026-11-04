import { actor, failure, isAdminEmail, sameOrigin } from '@/features/community/server';
import { Friendship, PlayerBlock } from '@/server/models/Community';
import { signEnvelope } from '@shared/community/auth';
import { realtimeSecret } from '@/features/community/realtime-server';
import { takeLimit } from '@/features/account/server/rate-limit';
export async function POST(req:Request){
  try{
    if(!sameOrigin(req))throw new Error('403');
    const user=await actor();
    if(!await takeLimit('realtime-ticket',user.playerId,30,60000))throw new Error('429');
    const edges=await Friendship.find({status:'accepted',$or:[{from:user.playerId},{to:user.playerId}]}).lean();
    const blocks=await PlayerBlock.find({$or:[{from:user.playerId},{to:user.playerId}]}).lean();
    const excluded=new Set(blocks.flatMap(b=>[b.from,b.to]));
    const friends=edges.map(e=>e.from===user.playerId?e.to:e.from).filter(id=>!excluded.has(id)).slice(0,2000);
    const ticket=await signEnvelope(realtimeSecret(),'community-connect',{playerId:user.playerId,friends,admin:isAdminEmail(user.email),expires:Date.now()+300000});
    return Response.json({ticket},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return failure(e);}
}
