/** Isolated review DB: validates independent per-game scores and merged identities. */
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
config({path:'.env.local',quiet:true});
process.env.MONGODB_DB_NAME='vct_account_review_20261104';
async function main(){
  const {dbConnect}=await import('../src/server/db/mongodb');
  const {AccountUser}=await import('../src/server/models/AccountUser');
  const {default:GameHistory}=await import('../src/server/models/GameHistory');
  const {HillWallet,HillRun}=await import('../src/server/models/Hill');
  const {loadRankingPage}=await import('../src/features/community/rankings');
  await dbConnect();
  const ids:string[]=Array.from({length:5},()=>randomUUID());const guest=randomUUID();const roomId=randomUUID();
  try{
    await AccountUser.insertMany(ids.map((playerId,i)=>({playerId,email:`${playerId}@example.invalid`,name:`Ranking fixture ${i}`,disabledAt:i===4?new Date():null})));
    await HillWallet.create({playerId:guest,mergedTo:ids[0]});
    await GameHistory.create({roomId,gameType:'tank',verifiedReport:true,playedAt:new Date(),players:[
      ...ids.map((playerId,i)=>({playerId,name:'Fixture',score:(5-i)*10,won:i===0})),
      {playerId:guest,name:'Merged guest',score:40,won:true},
      {playerId:ids[1],name:'Bot',isBot:true,score:9999,won:true},
    ]});
    await GameHistory.create({roomId,gameType:'draw',verifiedReport:true,playedAt:new Date(),players:[{playerId:ids[1],name:'Fixture',score:900,won:true}]});
    await GameHistory.create({roomId,gameType:'tank',verifiedReport:false,playedAt:new Date(),players:[{playerId:ids[2],name:'Unverified',score:9999,won:true}]});
    const tank=(await loadRankingPage('tank',0,1000)).items.filter(row=>ids.includes(row.playerId));
    assert.deepEqual(tank.map(row=>row.score),[50,40,30,20]);
    const draw=(await loadRankingPage('draw',0,1000)).items.filter(row=>ids.includes(row.playerId));
    assert.equal(draw.length,1);assert.equal(draw[0].playerId,ids[1]);assert.equal(draw[0].score,900);
    const first=await loadRankingPage('tank',0,3);assert.equal(first.items.length,3);assert.equal(first.nextOffset,3);
    await HillRun.create({runId:randomUUID(),playerId:guest,name:'Fixture',map:'test',vehicle:'jeep',seed:1,distance:123,duration:30,coins:0});
    const hill=(await loadRankingPage('hill',0,1000)).items.find(row=>row.playerId===ids[0]);assert.equal(hill?.score,123);
    console.log('Rankings passed: per-game isolation, top-three pagination, verified-only match scores, bot exclusion, disabled accounts, merged guest dedup and hill records.');
  }finally{
    await GameHistory.deleteMany({roomId});await HillRun.deleteMany({playerId:guest});await HillWallet.deleteMany({playerId:guest});await AccountUser.deleteMany({playerId:{$in:ids}});await mongoose.disconnect();
  }
}
main().catch(error=>{console.error('Ranking test failed:',error.message);process.exitCode=1;});
