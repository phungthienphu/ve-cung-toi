/** Real local Party WebSockets + Auth.js + isolated MongoDB. Never print tickets. */
import {config} from 'dotenv';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import {encode} from 'next-auth/jwt';
config({path:'.env.local',quiet:true});
const base='http://localhost:3014';
type Event = {type:string;scope?:string;online?:string[]};
class Probe {
  events:Event[]=[]; socket:WebSocket;
  constructor(ticket:string){this.socket=new WebSocket(`ws://127.0.0.1:1999/parties/community/main?_pk=${randomUUID()}&ticket=${encodeURIComponent(ticket)}`);this.socket.addEventListener('message',e=>{this.events.push(JSON.parse(String(e.data)));});}
  async wait(test:(e:Event)=>boolean){const until=Date.now()+7000;while(Date.now()<until){const i=this.events.findIndex(test);if(i>=0)return this.events.splice(i,1)[0];await new Promise(r=>setTimeout(r,20));}throw new Error('Realtime event timeout');}
  close(){this.socket.close();}
}
async function main(){
  const {AccountUser}=await import('../src/server/models/AccountUser');const {Friendship,ChatMessage,RoomInvite,SupportMessage,AdminAudit}=await import('../src/server/models/Community');
  await mongoose.connect(process.env.MONGODB_URI!,{dbName:'vct_account_review_20261104'});
  const ids=[randomUUID(),randomUUID(),randomUUID()];const sockets:Probe[]=[];
  const cookies=await Promise.all(ids.map(playerId=>encode({secret:'account-review-only-secret-not-for-production',salt:'authjs.session-token',token:{playerId,sessionVersion:0},maxAge:3600})));
  const call=(i:number,path:string,body?:unknown)=>fetch(base+path,{headers:{Cookie:`authjs.session-token=${cookies[i]}`,Origin:base,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
  async function connect(i:number){const r=await call(i,'/api/community/realtime',{});assert.equal(r.status,200);const p=new Probe((await r.json()).ticket);sockets.push(p);await p.wait(e=>e.type==='ready');return p;}
  try{
    await AccountUser.insertMany(ids.map((playerId,i)=>({playerId,googleSubject:randomUUID(),name:`WS fixture ${i}`,email:i===2?'review-admin@example.invalid':`${playerId}@example.invalid`,sessionVersion:0})));
    await Friendship.create({key:[ids[0],ids[1]].sort().join(':'),from:ids[0],to:ids[1],status:'accepted'});
    const a=await connect(0),aTab=await connect(0),b=await connect(1),stranger=await connect(2);
    await a.wait(e=>e.type==='presence'&&!!e.online?.includes(ids[1]));
    await b.wait(e=>e.type==='presence'&&!!e.online?.includes(ids[0]));
    const cPresence=await stranger.wait(e=>e.type==='presence');assert.deepEqual(cPresence.online,[],'stranger cannot see presence');
    for(const p of sockets)p.events=[];
    const message=await call(0,'/api/community',{action:'message',to:ids[1],text:'WebSocket delivery'});assert.equal(message.status,200);assert.equal((await message.json()).realtime,true);
    await b.wait(e=>e.type==='changed'&&e.scope==='community');await aTab.wait(e=>e.type==='changed');
    assert.equal(stranger.events.some(e=>e.type==='changed'),false,'private change not broadcast to unrelated account');
    const inbox=await (await call(1,`/api/community?peer=${ids[0]}`)).json();assert.equal(inbox.messages[0].text,'WebSocket delivery');
    for(const p of sockets)p.events=[];
    assert.equal((await call(0,'/api/community',{action:'invite',to:ids[1],path:'/room/ABCDEF'})).status,200);
    await b.wait(e=>e.type==='changed');assert.equal((await (await call(1,'/api/community')).json()).invitations.length,1);
    for(const p of sockets)p.events=[];
    await call(0,'/api/feedback',{text:'Realtime support'});await stranger.wait(e=>e.type==='changed'&&e.scope==='support');
    assert.equal(b.events.some(e=>e.scope==='support'),false);
    await call(2,'/api/feedback',{admin:true,owner:ids[0],text:'Support reply'});await a.wait(e=>e.type==='changed'&&e.scope==='support');
    for(const p of sockets)p.events=[];
    a.close();await new Promise(r=>setTimeout(r,150));assert.equal(b.events.some(e=>e.type==='presence'&&!e.online?.includes(ids[0])),false,'second tab keeps user online');
    aTab.close();await b.wait(e=>e.type==='presence'&&!e.online?.includes(ids[0]));
    const rejected=new Probe('invalid');sockets.push(rejected);await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Invalid ticket timeout')),5000);rejected.socket.addEventListener('error',()=>{clearTimeout(timer);resolve();});});assert.equal(rejected.events.length,0);
    assert.equal((await fetch('http://127.0.0.1:1999/parties/community/main',{method:'POST',headers:{'x-community-event':'forged'}})).status,403);
    const {signEnvelope,verifyEnvelope}=await import('../shared/community/auth');
    const secret=process.env.COMMUNITY_REALTIME_SECRET!;
    const expired=await signEnvelope(secret,'community-connect',{playerId:ids[0],friends:[],admin:false,expires:Date.now()-1});assert.equal(await verifyEnvelope(secret,'community-connect',expired),null);
    const shortTicket=await signEnvelope(secret,'community-connect',{playerId:ids[0],friends:[ids[1]],admin:false,expires:Date.now()+1800});
    assert.equal(await verifyEnvelope(secret,'community-publish',shortTicket),null,'tickets cannot forge server publishes');
    const short=new Probe(shortTicket);sockets.push(short);await short.wait(e=>e.type==='ready');await short.wait(e=>e.type==='reauthenticate');short.close();
    b.events=[];await call(0,'/api/community',{action:'block',to:ids[1]});await b.wait(e=>e.type==='reauthenticate');b.close();
    const revoked=await connect(1);revoked.events=[];
    await call(2,'/api/admin',{action:'user',target:ids[1],enabled:false});await revoked.wait(e=>e.type==='revoked');
    assert.equal((await call(1,'/api/community/realtime',{})).status,401);

    console.log('Party realtime passed: authenticated socket, immediate private chat/invite/support events, unrelated-user isolation, multi-tab online/offline, forged-ticket rejection, forged publish rejection expiry alarms, friend-permission refresh and admin revocation.');
  }finally{
    sockets.forEach(p=>p.close());
    await AccountUser.deleteMany({playerId:{$in:ids}});for(const model of [Friendship,ChatMessage,RoomInvite])await model.deleteMany({$or:[{from:{$in:ids}},{to:{$in:ids}}]});await SupportMessage.deleteMany({owner:{$in:ids}});await AdminAudit.deleteMany({actor:{$in:ids}});await mongoose.disconnect();
  }
}
main().catch(e=>{console.error('Realtime test failed',{name:e?.name,actual:e?.actual,expected:e?.expected,location:e?.stack?.split('\n').find((s:string)=>s.includes('/scripts/')),timeout:e?.message==='Realtime event timeout'});process.exitCode=1;});
