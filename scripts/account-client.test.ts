import assert from 'node:assert/strict';
import { getOrCreateGuestId, getOrCreatePlayerId, renewGuestId, setAccountPlayerId } from '../src/lib/player';
import { flushGuestProgress, transferGuestProgress } from '../src/features/account/client/guest-progress';
import { readHillProgress, transferHillCache, syncHillProgress } from '../src/features/hill/client/progress';
const values = new Map<string,string>();
const storage = {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)};
Object.defineProperty(globalThis,'window',{value:{localStorage:storage},configurable:true});
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});

async function main() {
  const guest=getOrCreateGuestId(), account='abcde12345';
  assert.equal(getOrCreatePlayerId(),guest);
  setAccountPlayerId(account); assert.equal(getOrCreatePlayerId(),account); assert.equal(getOrCreateGuestId(),guest);
  setAccountPlayerId(null); assert.equal(getOrCreatePlayerId(),guest);
  const run={runId:'review-run-123456789',playerId:guest,name:'Review',map:'tea',vehicle:'jeep',seed:20261102,day:null,distance:200,coins:20,duration:30};
  storage.setItem(`vct_hill_${guest}`,JSON.stringify({wallet:{coins:9999,unlocked:['monster']},bests:{'tea:all':200},pending:[run]}));
  storage.setItem(`vct_hill_${account}`,JSON.stringify({wallet:{coins:50,unlocked:['jeep']},bests:{'tea:all':300},pending:[]}));
  transferHillCache(guest,account); transferHillCache(guest,account);
  const moved=readHillProgress(account);
  assert.equal(moved.wallet.coins,50,'cache import never trusts a guest-supplied balance');
  assert.deepEqual(moved.wallet.unlocked,['jeep']);
  assert.equal(moved.bests['tea:all'],300);
  assert.equal(moved.pending.length,1); assert.equal(moved.pending[0].playerId,account);
  assert.equal(readHillProgress(guest).pending.length,0);
  const fetchOriginal=globalThis.fetch;
  globalThis.fetch=async (_url,options)=> options?.method === 'POST' ? new Response(JSON.stringify({error:'Session expired'}),{status:403}) : new Response(JSON.stringify({coins:50,unlocked:['jeep']}));
  try { await assert.rejects(syncHillProgress(account),/Session expired/); assert.equal(readHillProgress(account).pending.length,1,'expired auth never discards a pending run'); }
  finally { globalThis.fetch=fetchOriginal; }
  const next=renewGuestId(); assert.notEqual(next,guest); assert.equal(getOrCreatePlayerId(),next);
  let merges = 0;
  globalThis.fetch = async (url, options) => {
    if (url === '/api/account/merge') { merges++; return new Response(JSON.stringify({ok:true})); }
    if (options?.method === 'POST') return new Response(JSON.stringify({wallet:{coins:50,unlocked:['jeep']}}));
    if (String(url).includes(next)) return new Response(JSON.stringify({error:'Guest was already transferred'}),{status:409});
    return new Response(JSON.stringify({coins:50,unlocked:['jeep']}));
  };
  try {
    await flushGuestProgress(next);
    const first = transferGuestProgress(next,account), second = transferGuestProgress(next,account);
    assert.equal(first,second,'repeated initialization shares one in-flight transfer');
    await Promise.all([first,second]);
    assert.equal(merges,1,'retired guest can retry ownership check without duplicate merge requests');
    assert.notEqual(getOrCreateGuestId(),next,'successful retry retires the stale guest ID');
  } finally { globalThis.fetch=fetchOriginal; }
  console.log('Account client passed: guest/account identity, logout identity, idempotent cache move, max record, no trusted local balance, and retained runs on expired sessions.');
}
void main();
