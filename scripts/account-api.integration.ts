/** Requires the isolated custom Next review server described in google-login-setup.md. */
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { encode } from 'next-auth/jwt';
config({ path:'.env.local', quiet:true });
const base = 'http://localhost:3014';
const reviewSecret = 'account-review-only-secret-not-for-production';

async function main() {
  const { AccountUser } = await import('../src/server/models/AccountUser');
  const { HillWallet, HillRun } = await import('../src/server/models/Hill');
  if (!process.env.MONGODB_URI) throw new Error('Missing test DB connection');
  await mongoose.connect(process.env.MONGODB_URI,{ dbName:'vct_account_review_20261104' });
  const [account,other,guest] = Array.from({length:3},()=>randomBytes(5).toString('hex'));
  const ids = [account,other,guest];
  const cookie = async (id:string) => 'authjs.session-token=' + await encode({token:{sub:id,playerId:id,name:'API review'},secret:reviewSecret,salt:'authjs.session-token'});
  const ownCookie = await cookie(account), otherCookie = await cookie(other);
  const call = async (path:string,body?:unknown,session='') => {
    const res = await fetch(base + path,{ headers:{...(body ? {'Content-Type':'application/json',Origin:base}:{}),...(session?{Cookie:session}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{}) });
    return {status:res.status, data:await res.json()};
  };
  try {
    await Promise.all([AccountUser.init(),HillWallet.init(),HillRun.init()]);
    await AccountUser.create([{googleSubject:randomUUID(),playerId:account,email:'review@example.invalid'},{googleSubject:randomUUID(),playerId:other,email:'other@example.invalid'}]);
    const path = `/api/hill/wallet?playerId=${account}`;
    assert.equal((await call(path)).status,403,'anonymous cannot read account wallet');
    assert.equal((await call(path,undefined,otherCookie)).status,403,'another account cannot read wallet');
    assert.equal((await call(path,undefined,ownCookie)).status,200,'owner session can read wallet');
    assert.equal((await call(`/api/hill/wallet?playerId=${guest}`)).status,200,'guest wallet unchanged');
    const run = {runId:randomUUID(),playerId:account,name:'Review',map:'tea',vehicle:'jeep',seed:20261102,day:null,distance:200,coins:200,duration:30};
    assert.equal((await call('/api/hill/runs',run)).status,403);
    assert.equal((await call('/api/hill/runs',run,otherCookie)).status,403);
    const firstCredits = await Promise.all([call('/api/hill/runs',run,ownCookie),call('/api/hill/runs',run,ownCookie)]);
    firstCredits.forEach(r => { assert.equal(r.status,200); assert.equal(r.data.wallet.coins,200); });
    const duplicates = await Promise.all([call('/api/hill/runs',run,ownCookie),call('/api/hill/runs',run,ownCookie)]);
    duplicates.forEach(r => { assert.equal(r.status,200); assert.equal(r.data.wallet.coins,200); });
    assert.equal((await call('/api/hill/wallet',{playerId:account,vehicle:'beetle'})).status,403);
    assert.equal((await call('/api/hill/wallet',{playerId:account,vehicle:'beetle'},otherCookie)).status,403);
    const bought = await call('/api/hill/wallet',{playerId:account,vehicle:'beetle'},ownCookie);
    assert.equal(bought.status,200); assert.equal(bought.data.coins,50);
    const guestRun = {...run,runId:randomUUID(),playerId:guest};
    assert.equal((await call('/api/hill/runs',guestRun)).status,200);
    assert.equal((await call('/api/account/merge',{guestId:guest})).status,401);
    assert.equal((await call('/api/account/merge',{guestId:guest,coins:99999999,unlocked:['monster']},ownCookie)).status,200);
    assert.equal((await call('/api/account/merge',{guestId:guest},ownCookie)).status,200,'merge retries are safe');
    assert.equal((await call('/api/account/merge',{guestId:guest},otherCookie)).status,409);
    assert.equal((await call('/api/hill/runs',guestRun)).status,409,'old guest cannot credit after transfer');
    const retried = await call('/api/hill/runs',{...guestRun,playerId:account},ownCookie);
    assert.equal(retried.status,200); assert.equal(retried.data.wallet.coins,250,'pending run retarget/retry does not double credit');
    assert.equal(retried.data.wallet.unlocked.includes('monster'),false,'merge ignores client-supplied unlocks');
    const cloud = await call(path,undefined,ownCookie);
    assert.equal(cloud.data.bests['tea:all'],200,'cloud bests are available on another device');
    console.log('Account API passed: anonymous/wrong/owner sessions, purchases, protected run credit, guest compatibility, merge retries and replay after transfer.');
  } finally {
    await HillRun.deleteMany({playerId:{$in:ids}}); await HillWallet.deleteMany({playerId:{$in:ids}}); await AccountUser.deleteMany({playerId:{$in:ids}}); await mongoose.disconnect();
  }
}
main().catch(error => { console.error('Account API review failed:',{name:error?.name,code:error?.code,actual:error?.actual,expected:error?.expected,location:error?.stack?.split('\n').find((line:string)=>line.includes('/scripts/'))});process.exitCode=1;});
