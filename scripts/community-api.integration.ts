/** Isolated database + local-only account review server. No real mail or accounts. */
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { encode } from 'next-auth/jwt';
config({path:'.env.local',quiet:true});
const base='http://localhost:3014';
async function main(){
 const {roomGame}=await import('../src/features/community/room-path');
 assert.equal(roomGame('/room/ABCDEF')?.id,'draw');assert.equal(roomGame('/con-duong-hoang-kim/solo'),undefined);assert.equal(roomGame('/con-duong-hoang-kim/friends'),undefined);assert.equal(roomGame('/tank-game/ABCDEF?next=https://evil.invalid'),undefined);
 const {AccountUser}=await import('../src/server/models/AccountUser');
 const {Friendship,ChatMessage,PlayerBlock,RoomInvite,PlayerReport,AdminAudit,GameSetting,Impression,SupportMessage}=await import('../src/server/models/Community');
 await mongoose.connect(process.env.MONGODB_URI!,{dbName:'vct_account_review_20261104'});
 const ids=[randomUUID(),randomUUID(),randomUUID()];const users=ids.map((playerId,i)=>({playerId,googleSubject:randomUUID(),email:`${playerId}@example.invalid`,emailNormalized:`${playerId}@example.invalid`,name:`Social fixture ${i}`,sessionVersion:0}));
 const cookies=await Promise.all(ids.map(playerId=>encode({secret:'account-review-only-secret-not-for-production',salt:'authjs.session-token',token:{playerId,sessionVersion:0},maxAge:3600})));
 async function call(i:number,path:string,body?:unknown,origin=base){return fetch(base+path,{headers:{...(i>=0?{Cookie:`authjs.session-token=${cookies[i]}`} : {}),Origin:origin,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});}
 const action=(i:number,action:string,to:string,extra={})=>call(i,'/api/community',{action,to,...extra});
 try{
 await AccountUser.insertMany(users);
 const guestResponse=await call(-1,'/api/feedback/guest',{name:'Guest feedback fixture',text:'Guest feedback test'});
 assert.equal(guestResponse.status,200);
 const guestFeedback=await SupportMessage.findOne({guest:true,guestName:'Guest feedback fixture'}).lean();
 assert.ok(guestFeedback);
 assert.equal((await call(-1,'/api/feedback')).status,401);
 await SupportMessage.deleteMany({guest:true,guestName:'Guest feedback fixture'});
 assert.equal((await call(-1,'/api/feedback/guest',{name:'',text:'missing name'})).status,400);
 assert.equal((await call(-1,'/api/feedback/guest',{name:'Guest',text:'test'},'https://evil.invalid')).status,403);

 assert.equal((await call(-1,'/api/community')).status,401);
 const publicSearch = await call(-1,'/api/community/search?q=Social%20fixture');
 assert.equal(publicSearch.status,200);
 const publicData = await publicSearch.json();
 assert.ok(publicData.search.some((u:{playerId:string})=>u.playerId===ids[0]));
 assert.ok(!JSON.stringify(publicData).includes('@example.invalid'));
 assert.equal(publicData.messages.length,0);
 assert.equal((await action(-1,'request',ids[0])).status,401);
 assert.equal((await action(-1,'message',ids[0],{text:'guest'})).status,401);
 assert.equal((await call(0,'/api/admin')).status,403);
 assert.equal((await call(0,'/api/community',{action:'heartbeat'},'https://evil.invalid')).status,403);
 assert.equal((await action(0,'message',ids[1],{text:'not friends'})).status,403);
 assert.equal((await action(0,'request',ids[1])).status,200);
 assert.equal((await action(0,'accept',ids[1])).status,200);
 assert.equal((await action(0,'message',ids[1],{text:'still pending'})).status,403);
 assert.equal((await action(1,'accept',ids[0])).status,200);
 assert.equal((await action(0,'message',ids[1],{text:'Hello <script>text only</script>'})).status,200);
 const result=await (await call(1,`/api/community?peer=${ids[0]}`)).json();assert.equal(result.messages.length,1);assert.equal(result.unread[0].count,1);assert.ok(!JSON.stringify(result.users).includes('@example.invalid'));
 const stranger=await (await call(2,`/api/community?peer=${ids[0]}`)).json();assert.equal(stranger.messages.length,0);
 await action(1,'read',ids[0]);assert.equal(await ChatMessage.countDocuments({to:ids[1],readAt:null}),0);
 assert.equal((await action(0,'invite',ids[1],{path:'https://evil.invalid'})).status,400);
 assert.equal((await action(0,'invite',ids[1],{path:'/tank-game/ABCDEF'})).status,200);
 const inbox=await (await call(1,'/api/community')).json();assert.equal(inbox.invitations.length,1);
 await action(1,'dismiss',ids[0]);assert.equal((await (await call(1,'/api/community')).json()).invitations.length,0);
 await action(1,'block',ids[0]);assert.equal((await action(0,'message',ids[1],{text:'blocked'})).status,403);
 assert.equal((await (await call(0,`/api/community?peer=${ids[1]}`)).json()).messages.length,0);
 await action(1,'unblock',ids[0]);assert.equal((await action(0,'message',ids[1],{text:'no longer friends'})).status,403);

 await AccountUser.updateOne({playerId:ids[2]},{$set:{email:'review-admin@example.invalid'}});

 assert.equal((await call(0,'/api/feedback?admin=1')).status,403);
 assert.equal((await call(2,'/api/feedback',{admin:true,owner:ids[0],text:'unsolicited'})).status,403);
 assert.equal((await call(0,'/api/feedback',{text:'Need help'})).status,200);
 assert.equal((await (await call(1,`/api/feedback?owner=${ids[0]}`)).json()).messages.length,0,'other user cannot read support thread');
 const supportInbox=await (await call(2,'/api/feedback?admin=1')).json();assert.ok(supportInbox.threads.some((t:{_id:string})=>t._id===ids[0]));
 assert.equal((await call(2,'/api/feedback',{admin:true,owner:ids[0],text:'How can we help?'})).status,200);
 const supportThread=await (await call(0,'/api/feedback')).json();assert.equal(supportThread.messages.length,2);assert.equal(supportThread.messages[1].fromAdmin,true);
 const dashboard=await call(2,'/api/admin');assert.equal(dashboard.status,200);
 const dashboardData=await dashboard.json();assert.ok(!JSON.stringify(dashboardData.users).includes('googleSubject'));assert.ok(!JSON.stringify(dashboardData.users).includes('passwordHash'));
 assert.equal((await call(2,'/api/admin',{action:'user',target:ids[2],enabled:false})).status,403,'cannot lock admin');
 assert.equal((await call(2,'/api/admin',{action:'user',target:ids[0],enabled:false})).status,200);
 assert.equal((await call(0,'/api/community')).status,401);
 assert.equal((await call(2,'/api/admin',{action:'user',target:ids[0],enabled:true})).status,200);
 const previousSetting=await GameSetting.findOne({gameId:'tank'}).lean() as {enabled:boolean} | null;
 try {
 assert.equal((await call(2,'/api/admin',{action:'game',target:'tank',enabled:false})).status,200);
 const maintenance=await call(-1,'/tank-game');assert.ok((await maintenance.text()).includes('Game đang bảo trì'));
 assert.equal((await call(2,'/api/admin',{action:'game',target:'tank',enabled:true})).status,200);
 } finally {if(previousSetting)await GameSetting.updateOne({gameId:'tank'},{$set:{enabled:previousSetting.enabled}});else await GameSetting.deleteOne({gameId:'tank'});}
 assert.ok(await AdminAudit.countDocuments({actor:ids[2]})>=4);
 
 assert.equal((await call(0,'/api/community')).status,401);
 assert.equal((await call(-1,'/api/account/password/forgot',{})).status,503);
 assert.equal((await call(-1,'/api/account/password/reset',{})).status,503);
 const eventId=randomUUID();for(let i=0;i<2;i++)assert.equal((await call(-1,'/api/impressions',{path:'/',eventId})).status,204);
 assert.equal(await Impression.countDocuments({eventId}),1);await Impression.deleteOne({eventId});
 console.log('Community HTTP passed: session guards, CSRF, friendship consent, private chat, unread/read, invite path safety, dismiss, blocks, revocation, disabled recovery, impression dedup, admin authorization, user lock/unlock, self protection, game maintenance, audit and private player-initiated support.');
 }finally{
 await SupportMessage.deleteMany({guest:true,guestName:'Guest feedback fixture'});
 await AccountUser.deleteMany({playerId:{$in:ids}});
 for(const model of [Friendship,ChatMessage,PlayerBlock,RoomInvite,PlayerReport])await model.deleteMany({$or:[{from:{$in:ids}},{to:{$in:ids}}]});
 await SupportMessage.deleteMany({owner:{$in:ids}});
 await AdminAudit.deleteMany({actor:{$in:ids}});
 // No production settings touched; fixtures never mutate game configuration.
 void GameSetting;await mongoose.disconnect();
 }
}
main().catch(e=>{console.error('Community HTTP failed',{name:e?.name,actual:e?.actual,expected:e?.expected,location:e?.stack?.split('\n').find((s:string)=>s.includes('/scripts/'))});process.exitCode=1;});
